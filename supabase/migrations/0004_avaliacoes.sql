-- Lance Certo: avaliações de comprador e vendedor
-- Depois de cada negócio feito no app (leilão ou vitrine), o comprador avalia
-- o vendedor e o vendedor avalia o comprador, com nota de 1 a 5 e comentário,
-- como no BlaBlaCar e no Mercado Livre.

create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras (id) on delete cascade,
  avaliador_id uuid not null references empresas (id) on delete cascade,
  avaliado_id uuid not null references empresas (id) on delete cascade,
  avaliado_como text not null check (avaliado_como in ('vendedor', 'comprador')),
  nota smallint not null check (nota between 1 and 5),
  comentario text check (length(comentario) <= 500),
  criado_em timestamptz not null default now(),
  unique (compra_id, avaliador_id)
);
create index if not exists avaliacoes_avaliado on avaliacoes (avaliado_id, avaliado_como);

alter table avaliacoes enable row level security;
create policy "avaliações visíveis a usuários logados" on avaliacoes
  for select to authenticated using (true);
-- Avaliações entram só pela função avaliar, que confere quem participou do negócio.

-- Avalia a outra parte de um negócio. Avaliar de novo substitui a avaliação anterior.
create or replace function avaliar(p_compra uuid, p_nota integer, p_comentario text default null)
returns avaliacoes
language plpgsql
security definer set search_path = public
as $$
declare
  v_compra compras;
  v_avaliado uuid;
  v_como text;
  v_avaliacao avaliacoes;
begin
  select * into v_compra from compras where id = p_compra;
  if v_compra is null or auth.uid() not in (v_compra.comprador_id, coalesce(v_compra.fornecedor_id, v_compra.comprador_id)) then
    raise exception 'Negócio não encontrado.';
  end if;
  if v_compra.fornecedor_id is null then
    raise exception 'Compras feitas fora do app não podem ser avaliadas.';
  end if;
  if p_nota is null or p_nota not between 1 and 5 then
    raise exception 'Dê uma nota de 1 a 5 estrelas.';
  end if;

  if auth.uid() = v_compra.comprador_id then
    v_avaliado := v_compra.fornecedor_id;
    v_como := 'vendedor';
  else
    v_avaliado := v_compra.comprador_id;
    v_como := 'comprador';
  end if;

  insert into avaliacoes (compra_id, avaliador_id, avaliado_id, avaliado_como, nota, comentario)
  values (p_compra, auth.uid(), v_avaliado, v_como, p_nota, nullif(trim(p_comentario), ''))
  on conflict (compra_id, avaliador_id) do update
    set nota = excluded.nota, comentario = excluded.comentario, criado_em = now()
  returning * into v_avaliacao;
  return v_avaliacao;
end;
$$;

-- Reputação de cada conta: nota média e número de avaliações como vendedor e
-- como comprador, e quantos negócios fez no app.
create or replace function reputacao(p_ids uuid[])
returns table (
  empresa_id uuid,
  nota_vendedor numeric, avaliacoes_vendedor bigint,
  nota_comprador numeric, avaliacoes_comprador bigint,
  vendas bigint, compras bigint
)
language sql stable
security definer set search_path = public
as $$
  select e.id,
         round(avg(a.nota) filter (where a.avaliado_como = 'vendedor'), 1),
         count(a.id) filter (where a.avaliado_como = 'vendedor'),
         round(avg(a.nota) filter (where a.avaliado_como = 'comprador'), 1),
         count(a.id) filter (where a.avaliado_como = 'comprador'),
         (select count(*) from compras c where c.fornecedor_id = e.id),
         (select count(*) from compras c where c.comprador_id = e.id and c.fornecedor_id is not null)
  from empresas e
  left join avaliacoes a on a.avaliado_id = e.id
  where e.id = any (p_ids)
  group by e.id
$$;

revoke execute on function avaliar, reputacao from public;
grant execute on function avaliar, reputacao to authenticated;

notify pgrst, 'reload schema';
