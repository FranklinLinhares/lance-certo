-- Lance Certo: limite diário de uso da IA por conta, para a conta da Anthropic
-- não ser gasta por uma pessoa só.

create table if not exists uso_ia (
  empresa_id uuid not null references empresas (id) on delete cascade,
  dia date not null default current_date,
  tipo text not null check (tipo in ('item', 'pesquisa')),
  usos integer not null default 0,
  primary key (empresa_id, dia, tipo)
);
alter table uso_ia enable row level security;
create policy "cada conta vê o próprio uso da IA" on uso_ia
  for select to authenticated using (empresa_id = auth.uid());

-- Conta um uso e recusa quando passa do limite do dia:
-- 'item' (preencher com IA) até 30; 'pesquisa' (preço ou supermercados) até 10.
create or replace function registrar_uso_ia(p_tipo text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_limite integer := case p_tipo when 'item' then 30 when 'pesquisa' then 10 end;
  v_usos integer;
begin
  if v_limite is null then
    raise exception 'Tipo de uso da IA desconhecido.';
  end if;
  if not exists (select 1 from empresas where id = auth.uid()) then
    raise exception 'Complete seu cadastro primeiro.';
  end if;
  insert into uso_ia (empresa_id, tipo, usos) values (auth.uid(), p_tipo, 1)
  on conflict (empresa_id, dia, tipo) do update set usos = uso_ia.usos + 1
  returning usos into v_usos;
  if v_usos > v_limite then
    raise exception 'Você chegou ao limite de % usos por dia desta função da IA. Tente de novo amanhã.', v_limite;
  end if;
  return v_limite - v_usos;
end;
$$;

revoke execute on function registrar_uso_ia from public;
grant execute on function registrar_uso_ia to authenticated;
