-- Distância em faixas: com 0,1 km de precisão dava para achar o endereço de
-- alguém mudando a própria localização algumas vezes e cruzando as distâncias.
-- Até 10 km mostra o km inteiro de cima (mínimo 1); acima disso, de 5 em 5 km.
create or replace function distancia_em_faixa(km double precision)
returns double precision
language sql immutable
set search_path = public
as $$
  select case when km < 10 then greatest(1, ceil(km)) else ceil(km / 5) * 5 end
$$;
revoke execute on function distancia_em_faixa(double precision) from public, anon;
grant execute on function distancia_em_faixa(double precision) to authenticated;

-- Função antiga da vitrine, sem uso desde a 0003, que ainda devolvia a distância exata.
drop function if exists buscar_ofertas(text);

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
         distancia_em_faixa(distancia_km(c.lat, c.lng, f.lat, f.lng)),
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
revoke execute on function pedidos_proximos() from public, anon;
grant execute on function pedidos_proximos() to authenticated;

create or replace function vitrine_ofertas(termo text default null)
returns table (
  id uuid, fornecedor_id uuid, fornecedor_nome text, agricultor boolean,
  fornecedor_pj boolean, vende_para text,
  cidade text, uf char(2), distancia_km double precision,
  produto text, produto_chave text, categoria categoria_alimento,
  unidade unidade_medida, preco_unitario numeric, quantidade_disponivel numeric,
  validade date, disponivel_a_partir date, valida_ate timestamptz, descricao text,
  so_na_loja boolean, telefone_loja text
)
language sql stable
security definer set search_path = public
as $$
  select o.id, f.id, f.nome, f.agricultor,
         f.tipo_documento::text = 'cnpj', o.vende_para,
         f.cidade, f.uf,
         distancia_em_faixa(distancia_km(c.lat, c.lng, f.lat, f.lng)),
         o.produto, o.produto_chave, o.categoria, o.unidade, o.preco_unitario,
         o.quantidade_disponivel, o.validade, o.disponivel_a_partir, o.valida_ate, o.descricao,
         o.so_na_loja, case when o.so_na_loja then f.telefone end
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
revoke execute on function vitrine_ofertas(text) from public, anon;
grant execute on function vitrine_ofertas(text) to authenticated;

notify pgrst, 'reload schema';
