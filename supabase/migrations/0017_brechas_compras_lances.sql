-- Lance Certo: três brechas em compras, lances e estoque.

-- 1. Compra "de fora do app" só pode ser do próprio comprador, sem ligar a
--    outra conta. Antes dava para registrar uma compra externa apontando
--    qualquer fornecedor_id e, com isso, ler o telefone dele em
--    telefones_de_negocio, inflar as vendas dele e montar avaliações falsas.
drop policy "comprador registra compras feitas fora do app" on compras;
create policy "comprador registra compras feitas fora do app" on compras
  for insert to authenticated
  with check (
    comprador_id = auth.uid() and origem = 'externa'
    and fornecedor_id is null and pedido_id is null and oferta_id is null
  );

-- 2. Lance e quantidade arredondados a centavos antes de comparar.
create or replace function dar_lance(p_pedido uuid, p_preco numeric,
                                     p_validade date default null, p_observacao text default null)
returns lances
language plpgsql
security definer set search_path = public
as $$
declare
  v_pedido pedidos;
  v_fornecedor empresas;
  v_referencia numeric;
  v_lance lances;
begin
  -- Arredonda antes de comparar: a coluna guarda centavos, então 4,996 viraria
  -- 5,00 e empataria com um lance de R$ 5,00 que já existe.
  p_preco := round(p_preco, 2);
  if p_preco is null or p_preco <= 0 then
    raise exception 'Informe um preço maior que zero.';
  end if;

  select * into v_fornecedor from empresas where id = auth.uid();
  if v_fornecedor is null or v_fornecedor.papel <> 'fornecedor' then
    raise exception 'Apenas fornecedores podem dar lances.';
  end if;

  select * into v_pedido from pedidos where id = p_pedido for update;
  if v_pedido is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_pedido.status <> 'aberto' or v_pedido.encerra_em <= now() then
    raise exception 'Este leilão já foi encerrado.';
  end if;
  if v_pedido.comprador_id = v_fornecedor.id then
    raise exception 'Você não pode dar lance no seu próprio leilão.';
  end if;
  if not fornecedor_pode_ver(v_pedido, v_fornecedor.id) then
    if v_pedido.convidados is null then
      raise exception 'Este pedido está fora do seu raio de entrega ou do raio do comprador.';
    end if;
    raise exception 'Este leilão é só para fornecedores convidados pelo comprador.';
  end if;
  if v_pedido.preco_maximo is not null and p_preco > v_pedido.preco_maximo then
    raise exception 'O lance precisa ser no máximo R$ % por unidade.', v_pedido.preco_maximo;
  end if;

  if v_pedido.lances_visiveis then
    select min(preco_unitario) into v_referencia from lances where pedido_id = p_pedido;
    if v_referencia is not null and p_preco >= v_referencia then
      raise exception 'O lance precisa ser menor que o menor lance atual (R$ %).', v_referencia;
    end if;
  else
    select min(preco_unitario) into v_referencia
    from lances where pedido_id = p_pedido and fornecedor_id = v_fornecedor.id;
    if v_referencia is not null and p_preco >= v_referencia then
      raise exception 'O novo lance precisa ser menor que o seu lance anterior (R$ %).', v_referencia;
    end if;
  end if;

  insert into lances (pedido_id, fornecedor_id, preco_unitario, validade, observacao)
  values (p_pedido, v_fornecedor.id, p_preco, p_validade, p_observacao)
  returning * into v_lance;

  if v_pedido.encerra_em - now() < interval '5 minutes' then
    update pedidos set encerra_em = now() + interval '5 minutes' where id = p_pedido;
  end if;

  return v_lance;
end;
$$;

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
  -- Arredonda antes de mexer no estoque: a coluna guarda centésimos, então
  -- 0,005 não tirava nada da oferta, mas virava reserva de 0,01.
  p_quantidade := round(p_quantidade, 2);
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade maior que zero.';
  end if;

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

-- 3. Devolver estoque não republica uma oferta que o vendedor encerrou.
--    Só reativa se ela tinha saído da vitrine por falta de estoque.
create or replace function devolver_estoque(v_reserva reservas)
returns void
language sql
security definer set search_path = public
as $$
  update ofertas
  set quantidade_disponivel = quantidade_disponivel + v_reserva.quantidade,
      ativa = ativa or (quantidade_disponivel = 0 and valida_ate > now())
  where id = v_reserva.oferta_id;
$$;
