-- Lance Certo: público de cada oferta e vitrine com as próprias ofertas
-- * O vendedor escolhe em cada oferta se vende para todos, só para empresas
--   (CNPJ) ou só para pessoas físicas (CPF).
-- * A vitrine informa se quem vende é empresa ou pessoa física, para o
--   comprador filtrar, e também lista as ofertas da própria conta (o app as
--   marca como "Sua oferta").

alter table ofertas
  add column if not exists vende_para text not null default 'todos'
    check (vende_para in ('todos', 'pj', 'pf'));

-- Substitui buscar_ofertas na vitrine: devolve também o tipo de quem vende e
-- o público da oferta. É uma função nova para não precisar apagar a antiga.
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
    and (
      f.id = c.id
      or (se_alcancam(c.id, f.id) and aceita_negociar(o.vende_para, c.tipo_documento::text))
    )
    and (
      termo is null or termo = ''
      or o.produto ilike '%' || termo || '%'
      or o.produto_chave ilike '%' || replace(termo, ' ', '-') || '%'
    )
  order by o.produto_chave, o.preco_unitario
$$;
revoke execute on function vitrine_ofertas from public;
grant execute on function vitrine_ofertas to authenticated;

-- O comprador fecha negócio com uma oferta da vitrine.
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
  if not se_alcancam(v_comprador.id, v_oferta.fornecedor_id) then
    raise exception 'Esta oferta está fora do seu raio de compra.';
  end if;
  if not aceita_negociar(v_oferta.vende_para, v_comprador.tipo_documento::text) then
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

notify pgrst, 'reload schema';
