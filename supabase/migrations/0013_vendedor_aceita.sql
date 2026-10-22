-- Lance Certo: compra pela vitrine vira um pedido que o vendedor aceita ou recusa.
-- O estoque fica reservado enquanto o vendedor não responde. Ao aceitar, a compra
-- entra no histórico (e o WhatsApp de um para o outro é liberado); ao recusar,
-- ou se o comprador desistir antes, o estoque volta para a oferta.

create table if not exists reservas (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid references ofertas (id) on delete set null,
  comprador_id uuid not null references empresas (id) on delete cascade,
  fornecedor_id uuid not null references empresas (id) on delete cascade,
  produto text not null,
  produto_chave text not null,
  categoria categoria_alimento not null,
  unidade unidade_medida not null,
  quantidade numeric(12, 2) not null check (quantidade > 0),
  preco_unitario numeric(12, 2) not null check (preco_unitario > 0),
  situacao text not null default 'aguardando'
    check (situacao in ('aguardando', 'aceita', 'recusada', 'cancelada')),
  compra_id uuid references compras (id) on delete set null,
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);
create index if not exists reservas_fornecedor on reservas (fornecedor_id, situacao);
create index if not exists reservas_comprador on reservas (comprador_id, situacao);

alter table reservas enable row level security;
-- Só leitura para as duas partes; tudo o mais passa pelas funções abaixo.
create policy "reservas visíveis ao comprador e ao vendedor" on reservas
  for select to authenticated using (auth.uid() in (comprador_id, fornecedor_id));
revoke insert, update, delete on reservas from anon, authenticated;

-- Pedido de compra pela vitrine: as mesmas regras de antes, mas reserva em vez de comprar.
create or replace function reservar_oferta(p_oferta uuid, p_quantidade numeric)
returns reservas
language plpgsql
security definer set search_path = public
as $$
declare
  v_oferta ofertas;
  v_reserva reservas;
  v_comprador empresas;
begin
  select * into v_comprador from empresas where id = auth.uid();
  if v_comprador is null or v_comprador.papel <> 'comprador' then
    raise exception 'Apenas compradores podem comprar ofertas.';
  end if;

  select * into v_oferta from ofertas where id = p_oferta for update;
  if v_oferta is null or not v_oferta.ativa or v_oferta.valida_ate <= now() then
    raise exception 'Esta oferta não está mais disponível.';
  end if;
  if v_oferta.fornecedor_id = v_comprador.id then
    raise exception 'Você não pode comprar a sua própria oferta.';
  end if;
  if not comprador_pode_ver(v_oferta, v_comprador.id) then
    if v_oferta.convidados is not null then
      raise exception 'Esta oferta é só para clientes escolhidos pelo vendedor.';
    end if;
    if not se_alcancam(v_comprador.id, v_oferta.fornecedor_id) then
      raise exception 'Esta oferta está fora do seu raio de compra.';
    end if;
    raise exception 'Esta oferta é só para %.', case v_oferta.vende_para when 'pj' then 'empresas (CNPJ)' else 'pessoas físicas (CPF)' end;
  end if;
  if p_quantidade <= 0 or p_quantidade > v_oferta.quantidade_disponivel then
    raise exception 'Quantidade indisponível: o fornecedor tem % %.', v_oferta.quantidade_disponivel, v_oferta.unidade;
  end if;

  update ofertas
  set quantidade_disponivel = quantidade_disponivel - p_quantidade,
      ativa = quantidade_disponivel - p_quantidade > 0
  where id = p_oferta;

  insert into reservas (oferta_id, comprador_id, fornecedor_id, produto, produto_chave, categoria,
                        unidade, quantidade, preco_unitario)
  values (v_oferta.id, v_comprador.id, v_oferta.fornecedor_id, v_oferta.produto, v_oferta.produto_chave,
          v_oferta.categoria, v_oferta.unidade, p_quantidade, v_oferta.preco_unitario)
  returning * into v_reserva;
  return v_reserva;
end;
$$;

-- Devolve à oferta a quantidade de uma reserva que não virou compra.
create or replace function devolver_estoque(v_reserva reservas)
returns void
language sql
security definer set search_path = public
as $$
  update ofertas
  set quantidade_disponivel = quantidade_disponivel + v_reserva.quantidade,
      ativa = valida_ate > now()
  where id = v_reserva.oferta_id;
$$;

-- O vendedor aceita (a compra entra no histórico) ou recusa (o estoque volta).
create or replace function responder_reserva(p_reserva uuid, p_aceitar boolean)
returns reservas
language plpgsql
security definer set search_path = public
as $$
declare
  v_reserva reservas;
  v_compra compras;
begin
  select * into v_reserva from reservas where id = p_reserva for update;
  if v_reserva is null or v_reserva.fornecedor_id <> auth.uid() then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_reserva.situacao <> 'aguardando' then
    raise exception 'Este pedido já foi respondido.';
  end if;

  if p_aceitar then
    insert into compras (comprador_id, fornecedor_id, produto, produto_chave, categoria,
                         unidade, quantidade, preco_unitario, origem, oferta_id)
    values (v_reserva.comprador_id, v_reserva.fornecedor_id, v_reserva.produto,
            v_reserva.produto_chave, v_reserva.categoria, v_reserva.unidade, v_reserva.quantidade, v_reserva.preco_unitario, 'vitrine', v_reserva.oferta_id)
    returning * into v_compra;
    update reservas set situacao = 'aceita', compra_id = v_compra.id, respondido_em = now()
    where id = p_reserva returning * into v_reserva;
  else
    perform devolver_estoque(v_reserva);
    update reservas set situacao = 'recusada', respondido_em = now()
    where id = p_reserva returning * into v_reserva;
  end if;
  return v_reserva;
end;
$$;

-- O comprador desiste enquanto o vendedor ainda não respondeu.
create or replace function cancelar_reserva(p_reserva uuid)
returns reservas
language plpgsql
security definer set search_path = public
as $$
declare
  v_reserva reservas;
begin
  select * into v_reserva from reservas where id = p_reserva for update;
  if v_reserva is null or v_reserva.comprador_id <> auth.uid() then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_reserva.situacao <> 'aguardando' then
    raise exception 'O vendedor já respondeu este pedido.';
  end if;
  perform devolver_estoque(v_reserva);
  update reservas set situacao = 'cancelada', respondido_em = now()
  where id = p_reserva returning * into v_reserva;
  return v_reserva;
end;
$$;

-- A compra direta pela vitrine deixa de existir: tudo passa pelo aceite do vendedor.
drop function if exists comprar_oferta(uuid, numeric);

revoke execute on function reservar_oferta, devolver_estoque, responder_reserva, cancelar_reserva from public;
grant execute on function reservar_oferta, responder_reserva, cancelar_reserva to authenticated;

notify pgrst, 'reload schema';
