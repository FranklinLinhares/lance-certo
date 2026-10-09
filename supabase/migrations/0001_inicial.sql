-- Lance Certo: esquema inicial
-- Empresas (compradores e fornecedores), vitrine de ofertas, pedidos com leilão
-- reverso, lances e histórico de compras.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type papel_empresa as enum ('comprador', 'fornecedor');
create type tipo_documento as enum ('cnpj', 'cpf_caf', 'cpf_ie');
create type categoria_alimento as enum (
  'hortifruti', 'graos', 'carnes', 'laticinios', 'bebidas', 'mercearia'
);
create type unidade_medida as enum ('kg', 'l', 'un', 'duzia');
create type status_pedido as enum ('aberto', 'encerrado', 'fechado', 'cancelado');
create type origem_compra as enum ('leilao', 'vitrine', 'externa');

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------

create table empresas (
  id uuid primary key references auth.users (id) on delete cascade,
  papel papel_empresa not null,
  tipo_documento tipo_documento not null default 'cnpj',
  documento text not null unique,          -- CNPJ ou CPF, só dígitos
  registro_rural text,                      -- CAF ou inscrição estadual de produtor rural
  agricultor boolean not null default false,
  nome text not null,
  telefone text not null,
  cidade text not null,
  uf char(2) not null,
  lat double precision not null,
  lng double precision not null,
  raio_km integer not null default 30 check (raio_km between 1 and 500),
  categorias categoria_alimento[] not null default '{}',
  criado_em timestamptz not null default now(),
  -- Compradores só com CNPJ. Fornecedores com CPF só se forem agricultores
  -- com CAF ou inscrição de produtor rural.
  constraint documento_valido check (
    (tipo_documento = 'cnpj' and length(documento) = 14)
    or (
      papel = 'fornecedor' and agricultor
      and tipo_documento in ('cpf_caf', 'cpf_ie')
      and length(documento) = 11
      and coalesce(registro_rural, '') <> ''
    )
  )
);

-- Distância em km entre dois pontos (fórmula de haversine).
create function distancia_km(lat1 double precision, lng1 double precision,
                             lat2 double precision, lng2 double precision)
returns double precision
language sql immutable
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- Comprador e fornecedor se alcançam quando a distância cabe nos dois raios:
-- o comprador aceita comprar até o raio dele e o fornecedor entrega até o dele.
create function se_alcancam(comprador uuid, fornecedor uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((
    select distancia_km(c.lat, c.lng, f.lat, f.lng) <= least(c.raio_km, f.raio_km)
    from empresas c, empresas f
    where c.id = comprador and f.id = fornecedor
  ), false)
$$;

-- ---------------------------------------------------------------------------
-- Vitrine: ofertas publicadas pelos fornecedores
-- ---------------------------------------------------------------------------

create table ofertas (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references empresas (id) on delete cascade,
  produto text not null,
  produto_chave text not null,             -- nome normalizado para agrupar ofertas iguais
  categoria categoria_alimento not null,
  unidade unidade_medida not null,
  preco_unitario numeric(12, 2) not null check (preco_unitario > 0),
  quantidade_disponivel numeric(12, 2) not null check (quantidade_disponivel > 0),
  validade date,
  disponivel_a_partir date,                -- para ofertas de safra
  valida_ate timestamptz not null default now() + interval '7 days',
  descricao text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create index ofertas_produto_chave on ofertas (produto_chave) where ativa;

-- ---------------------------------------------------------------------------
-- Pedidos (leilão reverso) e lances
-- ---------------------------------------------------------------------------

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references empresas (id) on delete cascade,
  produto text not null,
  produto_chave text not null,
  categoria categoria_alimento not null,
  unidade unidade_medida not null,
  quantidade numeric(12, 2) not null check (quantidade > 0),
  especificacoes text,
  validade_minima_dias integer check (validade_minima_dias >= 0),
  entrega_ate date,
  preco_maximo numeric(12, 2) check (preco_maximo > 0),
  -- true: fornecedores veem os preços dos concorrentes; false: só o comprador vê.
  lances_visiveis boolean not null default true,
  encerra_em timestamptz not null,
  status status_pedido not null default 'aberto',
  lance_vencedor_id uuid,
  referencia_preco jsonb,                  -- resultado da pesquisa de preço da IA
  criado_em timestamptz not null default now(),
  check (encerra_em > criado_em)
);
create index pedidos_abertos on pedidos (status, encerra_em);

create table lances (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos (id) on delete cascade,
  fornecedor_id uuid not null references empresas (id) on delete cascade,
  preco_unitario numeric(12, 2) not null check (preco_unitario > 0),
  validade date,
  observacao text,
  criado_em timestamptz not null default now()
);
create index lances_pedido on lances (pedido_id, preco_unitario);

alter table pedidos
  add constraint pedidos_lance_vencedor_fk
  foreign key (lance_vencedor_id) references lances (id);

-- ---------------------------------------------------------------------------
-- Histórico de compras
-- ---------------------------------------------------------------------------

create table compras (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references empresas (id) on delete cascade,
  fornecedor_id uuid references empresas (id) on delete set null,
  fornecedor_nome text,                    -- para compras feitas fora do app
  produto text not null,
  produto_chave text not null,
  categoria categoria_alimento not null,
  unidade unidade_medida not null,
  quantidade numeric(12, 2) not null check (quantidade > 0),
  preco_unitario numeric(12, 2) not null check (preco_unitario > 0),
  origem origem_compra not null,
  pedido_id uuid references pedidos (id) on delete set null,
  oferta_id uuid references ofertas (id) on delete set null,
  data date not null default current_date,
  criado_em timestamptz not null default now()
);
create index compras_comprador_produto on compras (comprador_id, produto_chave, data);

-- Preço médio pago por semana, por comprador e produto, com a variação em
-- relação à semana anterior.
create view historico_semanal
with (security_invoker = true)
as
with semanas as (
  select
    comprador_id,
    produto_chave,
    min(produto) as produto,
    unidade,
    date_trunc('week', data)::date as semana,
    round(sum(preco_unitario * quantidade) / sum(quantidade), 2) as preco_medio,
    sum(quantidade) as quantidade
  from compras
  group by comprador_id, produto_chave, unidade, date_trunc('week', data)
)
select
  *,
  round(
    100 * (preco_medio / nullif(lag(preco_medio) over w, 0) - 1), 1
  ) as variacao_pct
from semanas
window w as (partition by comprador_id, produto_chave, unidade order by semana);

-- ---------------------------------------------------------------------------
-- Funções de negócio
-- ---------------------------------------------------------------------------

-- Ofertas ativas que alcançam o comprador logado, opcionalmente filtradas por termo.
create function buscar_ofertas(termo text default null)
returns table (
  id uuid, fornecedor_id uuid, fornecedor_nome text, agricultor boolean,
  cidade text, uf char(2), distancia_km double precision,
  produto text, produto_chave text, categoria categoria_alimento,
  unidade unidade_medida, preco_unitario numeric, quantidade_disponivel numeric,
  validade date, disponivel_a_partir date, valida_ate timestamptz, descricao text
)
language sql stable
security definer set search_path = public
as $$
  select o.id, f.id, f.nome, f.agricultor, f.cidade, f.uf,
         round(distancia_km(c.lat, c.lng, f.lat, f.lng)::numeric, 1)::double precision,
         o.produto, o.produto_chave, o.categoria, o.unidade, o.preco_unitario,
         o.quantidade_disponivel, o.validade, o.disponivel_a_partir, o.valida_ate, o.descricao
  from ofertas o
  join empresas f on f.id = o.fornecedor_id
  join empresas c on c.id = auth.uid()
  where o.ativa
    and o.valida_ate > now()
    and distancia_km(c.lat, c.lng, f.lat, f.lng) <= least(c.raio_km, f.raio_km)
    and (
      termo is null or termo = ''
      or o.produto ilike '%' || termo || '%'
      or o.produto_chave ilike '%' || replace(termo, ' ', '-') || '%'
    )
  order by o.produto_chave, o.preco_unitario
$$;

-- Pedidos abertos que alcançam o fornecedor logado.
create function pedidos_proximos()
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
    and distancia_km(c.lat, c.lng, f.lat, f.lng) <= least(c.raio_km, f.raio_km)
  order by p.encerra_em
$$;

-- Quantos compradores próximos procuram um produto (pedidos abertos), para o
-- fornecedor saber se há interesse no que ele oferece.
create function compradores_interessados(chave text)
returns bigint
language sql stable
security definer set search_path = public
as $$
  select count(distinct p.comprador_id)
  from pedidos p
  where p.status = 'aberto'
    and p.encerra_em > now()
    and p.produto_chave = chave
    and se_alcancam(p.comprador_id, auth.uid())
$$;

-- Registra um lance. Regras:
--  * só fornecedores ao alcance do comprador, com o pedido aberto;
--  * abaixo do preço máximo, quando houver;
--  * leilão aberto: precisa ser menor que o menor lance atual;
--    leilão fechado: precisa ser menor que o último lance do próprio fornecedor;
--  * lance nos últimos 5 minutos prorroga o encerramento em 5 minutos.
create function dar_lance(p_pedido uuid, p_preco numeric,
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
  if not se_alcancam(v_pedido.comprador_id, v_fornecedor.id) then
    raise exception 'Este pedido está fora do seu raio de entrega ou do raio do comprador.';
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

-- O comprador escolhe o lance vencedor; a compra entra no histórico.
create function fechar_pedido(p_pedido uuid, p_lance uuid)
returns pedidos
language plpgsql
security definer set search_path = public
as $$
declare
  v_pedido pedidos;
  v_lance lances;
begin
  select * into v_pedido from pedidos where id = p_pedido for update;
  if v_pedido is null or v_pedido.comprador_id <> auth.uid() then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_pedido.status not in ('aberto', 'encerrado') then
    raise exception 'Este pedido já foi fechado ou cancelado.';
  end if;

  select * into v_lance from lances where id = p_lance and pedido_id = p_pedido;
  if v_lance is null then
    raise exception 'Lance não encontrado neste pedido.';
  end if;

  update pedidos set status = 'fechado', lance_vencedor_id = v_lance.id
  where id = p_pedido returning * into v_pedido;

  insert into compras (comprador_id, fornecedor_id, produto, produto_chave, categoria,
                       unidade, quantidade, preco_unitario, origem, pedido_id)
  values (v_pedido.comprador_id, v_lance.fornecedor_id, v_pedido.produto, v_pedido.produto_chave,
          v_pedido.categoria, v_pedido.unidade, v_pedido.quantidade, v_lance.preco_unitario,
          'leilao', v_pedido.id);

  return v_pedido;
end;
$$;

-- O comprador fecha negócio com uma oferta da vitrine.
create function comprar_oferta(p_oferta uuid, p_quantidade numeric)
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
  if not se_alcancam(v_comprador.id, v_oferta.fornecedor_id) then
    raise exception 'Esta oferta está fora do seu raio de compra.';
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

-- Preço médio pago no app por um produto nos últimos 30 dias, na região do usuário.
create function preco_medio_regional(chave text)
returns table (preco_medio numeric, compras bigint)
language sql stable
security definer set search_path = public
as $$
  select round(avg(c.preco_unitario), 2), count(*)
  from compras c
  join empresas comprador on comprador.id = c.comprador_id
  join empresas eu on eu.id = auth.uid()
  where c.produto_chave = chave
    and c.data >= current_date - 30
    and distancia_km(eu.lat, eu.lng, comprador.lat, comprador.lng) <= eu.raio_km
$$;

-- ---------------------------------------------------------------------------
-- Segurança (Row Level Security)
-- ---------------------------------------------------------------------------

alter table empresas enable row level security;
alter table ofertas enable row level security;
alter table pedidos enable row level security;
alter table lances enable row level security;
alter table compras enable row level security;

create policy "empresas visíveis a usuários logados" on empresas
  for select to authenticated using (true);
create policy "cada um cadastra a própria empresa" on empresas
  for insert to authenticated with check (id = auth.uid());
create policy "cada um edita a própria empresa" on empresas
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "ofertas visíveis a usuários logados" on ofertas
  for select to authenticated using (true);
create policy "fornecedor publica as próprias ofertas" on ofertas
  for insert to authenticated with check (
    fornecedor_id = auth.uid()
    and exists (select 1 from empresas where id = auth.uid() and papel = 'fornecedor')
  );
create policy "fornecedor edita as próprias ofertas" on ofertas
  for update to authenticated using (fornecedor_id = auth.uid()) with check (fornecedor_id = auth.uid());

create policy "pedidos visíveis a usuários logados" on pedidos
  for select to authenticated using (true);
create policy "comprador cria os próprios pedidos" on pedidos
  for insert to authenticated with check (
    comprador_id = auth.uid()
    and status = 'aberto'
    and lance_vencedor_id is null
    and exists (select 1 from empresas where id = auth.uid() and papel = 'comprador')
  );
-- Lances, fechamento e compras da vitrine passam pelas funções acima.
create policy "comprador cancela os próprios pedidos" on pedidos
  for update to authenticated using (comprador_id = auth.uid())
  with check (comprador_id = auth.uid() and status = 'cancelado');

-- O comprador vê todos os lances do seu pedido; o fornecedor vê os próprios e,
-- se o comprador permitiu, os dos concorrentes.
create policy "lances conforme a visibilidade do pedido" on lances
  for select to authenticated using (
    fornecedor_id = auth.uid()
    or exists (
      select 1 from pedidos p
      where p.id = pedido_id
        and (p.comprador_id = auth.uid() or p.lances_visiveis)
    )
  );

create policy "compras visíveis ao comprador e ao fornecedor" on compras
  for select to authenticated using (comprador_id = auth.uid() or fornecedor_id = auth.uid());
create policy "comprador registra compras feitas fora do app" on compras
  for insert to authenticated with check (comprador_id = auth.uid() and origem = 'externa');

-- Funções expostas só a usuários logados.
revoke execute on function buscar_ofertas, pedidos_proximos, compradores_interessados,
  dar_lance, fechar_pedido, comprar_oferta, preco_medio_regional, se_alcancam from public;
grant execute on function buscar_ofertas, pedidos_proximos, compradores_interessados,
  dar_lance, fechar_pedido, comprar_oferta, preco_medio_regional, se_alcancam to authenticated;

-- Lances em tempo real.
alter publication supabase_realtime add table lances, pedidos;
