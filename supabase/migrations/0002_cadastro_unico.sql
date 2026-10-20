-- Lance Certo: cadastro único
-- Uma conta só para comprar e vender, como no BlaBlaCar. A coluna `papel` passa
-- a ser o modo atual (Comprar ou Vender), que a pessoa troca quando quiser.
-- Pessoa física entra com CPF; empresa com CNPJ escolhe com quem negocia.

alter type tipo_documento add value if not exists 'cpf';

alter table empresas
  add column if not exists nome_completo text,
  add column if not exists endereco text,
  -- Com quem a conta aceita negociar: todos, só empresas (CNPJ) ou só pessoas físicas (CPF).
  add column if not exists negocia_com text not null default 'todos'
    check (negocia_com in ('todos', 'pj', 'pf'));

-- O tipo é comparado como texto para o script rodar numa transação só, junto
-- com o novo valor 'cpf'.
alter table empresas drop constraint if exists documento_valido;
alter table empresas add constraint documento_valido check (
  (tipo_documento::text = 'cnpj' and length(documento) = 14)
  or (tipo_documento::text = 'cpf' and length(documento) = 11)
  or (
    tipo_documento::text in ('cpf_caf', 'cpf_ie')
    and length(documento) = 11
    and coalesce(registro_rural, '') <> ''
  )
);

-- A preferência de uma conta aceita o tipo de documento da outra?
create or replace function aceita_negociar(preferencia text, tipo_outro text)
returns boolean
language sql immutable
as $$
  select preferencia = 'todos' or (preferencia = 'pj') = (tipo_outro = 'cnpj')
$$;

-- Comprador e fornecedor se alcançam quando a distância cabe nos dois raios,
-- cada um aceita o tipo de pessoa do outro e não são a mesma conta.
create or replace function se_alcancam(comprador uuid, fornecedor uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((
    select c.id <> f.id
      and distancia_km(c.lat, c.lng, f.lat, f.lng) <= least(c.raio_km, f.raio_km)
      and aceita_negociar(c.negocia_com, f.tipo_documento::text)
      and aceita_negociar(f.negocia_com, c.tipo_documento::text)
    from empresas c, empresas f
    where c.id = comprador and f.id = fornecedor
  ), false)
$$;

-- Vitrine e leilões próximos passam a usar a mesma regra de alcance.
create or replace function buscar_ofertas(termo text default null)
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
    and se_alcancam(c.id, f.id)
    and (
      termo is null or termo = ''
      or o.produto ilike '%' || termo || '%'
      or o.produto_chave ilike '%' || replace(termo, ' ', '-') || '%'
    )
  order by o.produto_chave, o.preco_unitario
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
    and se_alcancam(c.id, f.id)
  order by p.encerra_em
$$;

revoke execute on function aceita_negociar from public;
grant execute on function aceita_negociar to authenticated;

notify pgrst, 'reload schema';
