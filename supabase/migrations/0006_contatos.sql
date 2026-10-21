-- Lance Certo: contatos (fornecedores e clientes) e convites
-- * Cada conta guarda os seus fornecedores e clientes, que são outras contas do app.
-- * Ao criar um leilão, o comprador escolhe se fica aberto para todos os
--   fornecedores próximos ou só para os fornecedores que selecionar.
-- * Ao publicar uma oferta, o vendedor escolhe se vende para todos os
--   compradores próximos ou só para os clientes que selecionar.
-- Convidados veem e participam mesmo fora do raio, porque foram escolhidos.

create table if not exists contatos (
  dono_id uuid not null references empresas (id) on delete cascade,
  contato_id uuid not null references empresas (id) on delete cascade,
  tipo text not null check (tipo in ('fornecedor', 'cliente')),
  criado_em timestamptz not null default now(),
  primary key (dono_id, contato_id, tipo),
  check (dono_id <> contato_id)
);
alter table contatos enable row level security;
create policy "cada conta vê os próprios contatos" on contatos
  for select to authenticated using (dono_id = auth.uid());
create policy "cada conta adiciona os próprios contatos" on contatos
  for insert to authenticated with check (dono_id = auth.uid());
create policy "cada conta remove os próprios contatos" on contatos
  for delete to authenticated using (dono_id = auth.uid());

-- Nulo = aberto para todos; senão, só as contas listadas.
alter table pedidos add column if not exists convidados uuid[];
alter table ofertas add column if not exists convidados uuid[];

-- Busca contas para adicionar como contato: pelo CPF/CNPJ completo ou pelo nome.
create or replace function encontrar_empresas(termo text)
returns table (id uuid, nome text, cidade text, uf char(2), pessoa_juridica boolean)
language sql stable
security definer set search_path = public
as $$
  select e.id, e.nome, e.cidade, e.uf, e.tipo_documento::text = 'cnpj'
  from empresas e
  where e.id <> auth.uid()
    and length(trim(termo)) >= 3
    and (
      (length(regexp_replace(termo, '\D', '', 'g')) >= 11 and e.documento = regexp_replace(termo, '\D', '', 'g'))
      or e.nome ilike '%' || trim(termo) || '%'
      or e.nome_completo ilike '%' || trim(termo) || '%'
    )
  order by e.nome
  limit 10
$$;

-- O fornecedor pode participar do leilão? Convidado sempre; senão, pelo raio.
create or replace function fornecedor_pode_ver(p_pedido pedidos, p_fornecedor uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select case
    when p_pedido.convidados is null then se_alcancam(p_pedido.comprador_id, p_fornecedor)
    else p_fornecedor = any (p_pedido.convidados)
  end
$$;

create or replace function pedidos_proximos()
returns table (
  id uuid, comprador_nome text, cidade text, uf char(2), distancia_km double precision,
  produto text, produto_chave text, categoria categoria_alimento, unidade unidade_medida,
  quantidade numeric, preco_maximo numeric, lances_visiveis boolean,
  encerra_em timestamptz, menor_lance numeric, total_lances bigint
)
language sql stable
security definer set search_path = public
as $$
  select p.id, c.nome, c.cidade, c.uf,
         round(distancia_km(c.lat, c.lng, f.lat, f.lng)::numeric, 1)::double precision,
         p.produto, p.produto_chave, p.categoria, p.unidade, p.quantidade, p.preco_maximo,
         p.lances_visiveis, p.encerra_em,
         case when p.lances_visiveis then (select min(l.preco_unitario) from lances l where l.pedido_id = p.id) end,
         (select count(*) from lances l where l.pedido_id = p.id)
  from pedidos p
  join empresas c on c.id = p.comprador_id
  join empresas f on f.id = auth.uid()
  where p.status = 'aberto'
    and p.encerra_em > now()
    and f.papel = 'fornecedor'
    and c.id <> f.id
    and fornecedor_pode_ver(p, f.id)
  order by p.encerra_em
$$;

create or replace function compradores_interessados(chave text)
returns bigint
language sql stable
security definer set search_path = public
as $$
  select count(distinct p.comprador_id)
  from pedidos p
  where p.status = 'aberto'
    and p.encerra_em > now()
    and p.produto_chave = chave
    and p.comprador_id <> auth.uid()
    and fornecedor_pode_ver(p, auth.uid())
$$;

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

-- O comprador pode ver e comprar a oferta? Convidado sempre; senão, raio e público da oferta.
create or replace function comprador_pode_ver(p_oferta ofertas, p_comprador uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select case
    when p_oferta.convidados is null then
      se_alcancam(p_comprador, p_oferta.fornecedor_id)
      and aceita_negociar(p_oferta.vende_para, (select tipo_documento::text from empresas where id = p_comprador))
    else p_comprador = any (p_oferta.convidados)
  end
$$;

create or replace function vitrine_ofertas(termo text default null)
returns table (
  id uuid, fornecedor_id uuid, fornecedor_nome text, agricultor boolean,
  fornecedor_pj boolean, vende_para text,
  cidade text, uf char(2), distancia_km double precision,
  produto text, produto_chave text, categoria categoria_alimento,
  unidade unidade_medida, preco_unitario numeric, quantidade_disponivel numeric,
  validade date, disponivel_a_partir date, valida_ate timestamptz, descricao text
)
language sql stable
security definer set search_path = public
as $$
  select o.id, f.id, f.nome, f.agricultor,
         f.tipo_documento::text = 'cnpj', o.vende_para,
         f.cidade, f.uf,
         round(distancia_km(c.lat, c.lng, f.lat, f.lng)::numeric, 1)::double precision,
         o.produto, o.produto_chave, o.categoria, o.unidade, o.preco_unitario,
         o.quantidade_disponivel, o.validade, o.disponivel_a_partir, o.valida_ate, o.descricao
  from ofertas o
  join empresas f on f.id = o.fornecedor_id
  join empresas c on c.id = auth.uid()
  where o.ativa
    and o.valida_ate > now()
    and (f.id = c.id or comprador_pode_ver(o, c.id))
    and (
      termo is null or termo = ''
      or o.produto ilike '%' || termo || '%'
      or o.produto_chave ilike '%' || replace(termo, ' ', '-') || '%'
    )
  order by o.produto_chave, o.preco_unitario
$$;

create or replace function comprar_oferta(p_oferta uuid, p_quantidade numeric)
returns compras
language plpgsql
security definer set search_path = public
as $$
declare
  v_oferta ofertas;
  v_compra compras;
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

  insert into compras (comprador_id, fornecedor_id, produto, produto_chave, categoria,
                       unidade, quantidade, preco_unitario, origem, oferta_id)
  values (v_comprador.id, v_oferta.fornecedor_id, v_oferta.produto, v_oferta.produto_chave,
          v_oferta.categoria, v_oferta.unidade, p_quantidade, v_oferta.preco_unitario,
          'vitrine', v_oferta.id)
  returning * into v_compra;

  return v_compra;
end;
$$;

revoke execute on function encontrar_empresas, fornecedor_pode_ver, comprador_pode_ver from public;
grant execute on function encontrar_empresas, fornecedor_pode_ver, comprador_pode_ver to authenticated;

notify pgrst, 'reload schema';
