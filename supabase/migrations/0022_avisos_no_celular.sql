-- Avisos no celular: cada aviso novo do sino também chega como notificação no
-- celular de quem ativou. O banco guarda o endereço de notificação de cada aparelho
-- e, ao criar um aviso, chama /api/push do app, que entrega a notificação.

create table if not exists push_inscricoes (
  endpoint text primary key,
  empresa_id uuid not null references empresas (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);
create index if not exists push_inscricoes_empresa on push_inscricoes (empresa_id);

-- Só pelas funções abaixo: a tabela não fica aberta para leitura nem escrita.
alter table push_inscricoes enable row level security;
revoke all on push_inscricoes from anon, authenticated;

-- Ativa o aparelho para a conta logada. Um celular usado por outra conta passa
-- a avisar só a conta atual.
create or replace function registrar_celular(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from empresas where id = auth.uid()) then
    raise exception 'Entre na sua conta para receber avisos no celular.';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 1000
     or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Este navegador não enviou um endereço de notificação válido.';
  end if;
  insert into push_inscricoes (endpoint, empresa_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set empresa_id = excluded.empresa_id, p256dh = excluded.p256dh, auth = excluded.auth, criado_em = now();
end;
$$;
revoke execute on function registrar_celular(text, text, text) from public, anon;
grant execute on function registrar_celular(text, text, text) to authenticated;

create or replace function remover_celular(p_endpoint text)
returns void
language sql
security definer set search_path = public
as $$
  delete from push_inscricoes where endpoint = p_endpoint and empresa_id = auth.uid();
$$;
revoke execute on function remover_celular(text) from public, anon;
grant execute on function remover_celular(text) to authenticated;

-- Endereço do app e senha combinada ficam no cofre do Supabase (Vault), fora do código:
--   select vault.create_secret('https://SEU-APP/api/push', 'lance_certo_push_url');
--   select vault.create_secret('A MESMA SENHA DO PUSH_SEGREDO DA VERCEL', 'lance_certo_push_segredo');
create or replace function segredo_push(nome text)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v using nome;
  return v;
end;
$$;
revoke execute on function segredo_push(text) from public, anon, authenticated;

-- O app avisa que um aparelho não existe mais (desinstalado ou permissão retirada).
create or replace function apagar_celular_expirado(p_segredo text, p_endpoint text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_segredo is null or p_segredo is distinct from segredo_push('lance_certo_push_segredo') then
    raise exception 'Não autorizado.';
  end if;
  delete from push_inscricoes where endpoint = p_endpoint;
end;
$$;
revoke execute on function apagar_celular_expirado(text, text) from public;
grant execute on function apagar_celular_expirado(text, text) to anon, authenticated;

-- pg_net faz a chamada ao app sem travar quem criou o aviso.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net indisponível aqui; avisos no celular ficam desligados.';
end;
$$;

create or replace function enviar_aviso_celular()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_url text := segredo_push('lance_certo_push_url');
  v_segredo text := segredo_push('lance_certo_push_segredo');
  v_inscricoes jsonb;
begin
  if v_url is null or v_segredo is null or to_regnamespace('net') is null then
    return new;
  end if;
  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'keys', jsonb_build_object('p256dh', p256dh, 'auth', auth)))
    into v_inscricoes
  from push_inscricoes where empresa_id = new.empresa_id;
  if v_inscricoes is null then
    return new;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_url,
          jsonb_build_object('texto', new.texto, 'link', new.link, 'inscricoes', v_inscricoes),
          jsonb_build_object('Content-Type', 'application/json', 'x-segredo', v_segredo);
  return new;
exception when others then
  -- Falha na notificação nunca impede o aviso do sino.
  raise warning 'aviso no celular não enviado: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function enviar_aviso_celular() from public, anon, authenticated;

drop trigger if exists avisos_no_celular on avisos;
create trigger avisos_no_celular after insert on avisos
  for each row execute function enviar_aviso_celular();

notify pgrst, 'reload schema';
