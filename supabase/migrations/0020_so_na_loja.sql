-- Ofertas "só na loja": promoção exposta na vitrine, sem compra pelo app.
alter table ofertas add column if not exists so_na_loja boolean not null default false;

-- Pedido pela vitrine não vale para promoção só na loja.
create or replace function bloquear_reserva_so_na_loja()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from ofertas where id = new.oferta_id and so_na_loja) then
    raise exception 'Esta promoção é só na loja: o produto não é vendido pelo app.';
  end if;
  return new;
end;
$$;
revoke execute on function bloquear_reserva_so_na_loja() from public, anon, authenticated;

drop trigger if exists reservas_so_na_loja on reservas;
create trigger reservas_so_na_loja before insert on reservas
  for each row execute function bloquear_reserva_so_na_loja();

-- A vitrine passa a dizer se a oferta é só na loja e, nesse caso, o WhatsApp da loja,
-- que o vendedor aceitou mostrar ao marcar a opção.
drop function if exists vitrine_ofertas(text);
create function vitrine_ofertas(termo text default null)
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
         round(distancia_km(c.lat, c.lng, f.lat, f.lng)::numeric, 1)::double precision,
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
