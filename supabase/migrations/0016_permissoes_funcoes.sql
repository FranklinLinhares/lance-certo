-- Lance Certo: fechar as funções do banco para quem não deve chamá-las.
-- As migrações anteriores tiravam a permissão de "public", mas o Supabase dá
-- permissão separada aos papéis anon (sem login) e authenticated (logado).
-- Com isso, qualquer pessoa podia chamar devolver_estoque direto pela API e
-- aumentar o estoque de qualquer oferta.

-- Sem login, nenhuma função do app pode ser chamada (as telas exigem login).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from anon', f.assinatura);
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from anon;

-- Funções internas: só o próprio banco as usa (outras funções e gatilhos).
revoke execute on function devolver_estoque(reservas) from authenticated;
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'avisar\_%'
  loop
    execute format('revoke execute on function %s from authenticated', f.assinatura);
  end loop;
end $$;

-- Caminho de busca fixo nas funções que ainda não tinham.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('distancia_km', 'aceita_negociar', 'br_numero', 'br_reais')
  loop
    execute format('alter function %s set search_path = public', f.assinatura);
  end loop;
end $$;
