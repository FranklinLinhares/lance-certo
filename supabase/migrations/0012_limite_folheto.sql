-- Lance Certo: leitura de folhetos de ofertas pela IA entra no limite diário de uso.
-- 'folheto' (ler um encarte e transformar em ofertas) até 5 por dia.

alter table uso_ia drop constraint if exists uso_ia_tipo_check;
alter table uso_ia add constraint uso_ia_tipo_check check (tipo in ('item', 'pesquisa', 'folheto'));

create or replace function registrar_uso_ia(p_tipo text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_limite integer := case p_tipo when 'item' then 30 when 'pesquisa' then 10 when 'folheto' then 5 end;
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

notify pgrst, 'reload schema';
