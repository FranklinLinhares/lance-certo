-- Lance Certo: a vitrine também mostra as ofertas da própria conta, marcadas
-- como "Sua oferta" no app, para ninguém achar que a oferta sumiu.

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
    and (f.id = c.id or se_alcancam(c.id, f.id))
    and (
      termo is null or termo = ''
      or o.produto ilike '%' || termo || '%'
      or o.produto_chave ilike '%' || replace(termo, ' ', '-') || '%'
    )
  order by o.produto_chave, o.preco_unitario
$$;

notify pgrst, 'reload schema';
