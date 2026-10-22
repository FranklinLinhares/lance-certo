-- Lance Certo: avisos dentro do app (o sino no menu) e alertas de preço.
-- Os avisos são criados pelo banco quando algo acontece; cada conta só lê e
-- marca como lidos os seus.

create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  texto text not null,
  link text not null,
  lido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists avisos_empresa on avisos (empresa_id, lido, criado_em desc);

alter table avisos enable row level security;
create policy "cada conta lê os próprios avisos" on avisos
  for select to authenticated using (empresa_id = auth.uid());
create policy "cada conta marca os próprios avisos como lidos" on avisos
  for update to authenticated using (empresa_id = auth.uid()) with check (empresa_id = auth.uid());
revoke insert, delete on avisos from anon, authenticated;

-- Alerta de preço: "me avise quando aparecer arroz a até R$ 5/kg".
create table if not exists alertas_preco (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  produto text not null,
  produto_chave text not null,
  unidade unidade_medida not null,
  preco_maximo numeric(12, 2) not null check (preco_maximo > 0),
  criado_em timestamptz not null default now()
);
create index if not exists alertas_preco_chave on alertas_preco (produto_chave);

alter table alertas_preco enable row level security;
create policy "cada conta gerencia os próprios alertas" on alertas_preco
  for all to authenticated using (empresa_id = auth.uid()) with check (empresa_id = auth.uid());

-- Números como no Brasil: 3,8 kg e R$ 3,80.
create or replace function br_numero(v numeric) returns text
language sql immutable as $$ select replace(trim_scale(v)::text, '.', ',') $$;
create or replace function br_reais(v numeric) returns text
language sql immutable as $$ select 'R$ ' || replace(to_char(v, 'FM999999990.00'), '.', ',') $$;

-- Leilão novo: avisa quem pode dar lance (no raio ou convidado) e vende aquela categoria.
create or replace function avisar_leilao_novo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into avisos (empresa_id, texto, link)
  select f.id,
         format('Leilão novo perto de você: %s %s de %s', br_numero(new.quantidade), new.unidade, new.produto),
         '/pedidos/' || new.id
  from empresas f
  where f.id <> new.comprador_id
    and (cardinality(f.categorias) = 0 or new.categoria = any (f.categorias))
    and fornecedor_pode_ver(new, f.id);
  return new;
end;
$$;
drop trigger if exists avisar_leilao_novo on pedidos;
create trigger avisar_leilao_novo after insert on pedidos
  for each row when (new.status = 'aberto') execute function avisar_leilao_novo();

-- Lance novo: avisa o comprador. Leilão fechado: avisa quem venceu.
create or replace function avisar_lance()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pedido pedidos;
begin
  select * into v_pedido from pedidos where id = new.pedido_id;
  insert into avisos (empresa_id, texto, link)
  values (v_pedido.comprador_id,
          format('Lance novo no seu leilão de %s: %s por %s', v_pedido.produto, br_reais(new.preco_unitario), v_pedido.unidade),
          '/pedidos/' || v_pedido.id);
  return new;
end;
$$;
drop trigger if exists avisar_lance on lances;
create trigger avisar_lance after insert on lances for each row execute function avisar_lance();

create or replace function avisar_vencedor()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into avisos (empresa_id, texto, link)
  select l.fornecedor_id, format('Você venceu o leilão de %s. Combine a entrega com o comprador.', new.produto),
         '/pedidos/' || new.id
  from lances l where l.id = new.lance_vencedor_id;
  return new;
end;
$$;
drop trigger if exists avisar_vencedor on pedidos;
create trigger avisar_vencedor after update of lance_vencedor_id on pedidos
  for each row when (new.lance_vencedor_id is not null and old.lance_vencedor_id is distinct from new.lance_vencedor_id)
  execute function avisar_vencedor();

-- Pedido pela vitrine: avisa o vendedor; a resposta avisa o comprador.
create or replace function avisar_reserva()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into avisos (empresa_id, texto, link)
    select new.fornecedor_id, format('%s quer comprar %s %s de %s. Aceite ou recuse.', c.nome, br_numero(new.quantidade), new.unidade, new.produto),
           '/negocios'
    from empresas c where c.id = new.comprador_id;
  elsif new.situacao in ('aceita', 'recusada') and old.situacao = 'aguardando' then
    insert into avisos (empresa_id, texto, link)
    select new.comprador_id,
           case new.situacao
             when 'aceita' then format('%s aceitou seu pedido de %s. Combine a entrega pelo WhatsApp.', f.nome, new.produto)
             else format('%s recusou seu pedido de %s.', f.nome, new.produto)
           end,
           '/negocios'
    from empresas f where f.id = new.fornecedor_id;
  end if;
  return new;
end;
$$;
drop trigger if exists avisar_reserva on reservas;
create trigger avisar_reserva after insert or update of situacao on reservas
  for each row execute function avisar_reserva();

-- Oferta nova (ou que baixou de preço) dentro de um alerta de preço de quem pode comprá-la.
create or replace function avisar_alerta_preco()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.preco_unitario >= old.preco_unitario and old.ativa then
    return new;
  end if;
  insert into avisos (empresa_id, texto, link)
  select distinct a.empresa_id,
         format('Alerta de preço: %s a %s por %s na vitrine', new.produto, br_reais(new.preco_unitario), new.unidade),
         '/vitrine/' || new.id
  from alertas_preco a
  where a.produto_chave = new.produto_chave
    and a.unidade = new.unidade
    and new.preco_unitario <= a.preco_maximo
    and a.empresa_id <> new.fornecedor_id
    and comprador_pode_ver(new, a.empresa_id);
  return new;
end;
$$;
drop trigger if exists avisar_alerta_preco on ofertas;
create trigger avisar_alerta_preco after insert or update of preco_unitario, ativa on ofertas
  for each row when (new.ativa and new.valida_ate > now()) execute function avisar_alerta_preco();

revoke execute on function avisar_leilao_novo, avisar_lance, avisar_vencedor, avisar_reserva, avisar_alerta_preco from public;

notify pgrst, 'reload schema';
