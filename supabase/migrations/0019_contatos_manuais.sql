-- Lance Certo: contatos cadastrados à mão.
-- Além das contas do app, cada conta pode guardar fornecedores e clientes que
-- ainda não usam o Lance Certo, com nome, telefone, e-mail, documento e cidade.
-- Esses contatos ficam só na agenda de quem cadastrou (não entram em convites
-- de leilão ou oferta, porque não têm conta).

create table if not exists contatos_manuais (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references empresas (id) on delete cascade,
  tipo text not null check (tipo in ('fornecedor', 'cliente')),
  nome text not null check (length(trim(nome)) between 2 and 120),
  telefone text check (length(telefone) <= 20),
  email text check (length(email) <= 120),
  documento text check (length(documento) <= 14),
  cidade text check (length(cidade) <= 80),
  uf char(2),
  observacao text check (length(observacao) <= 500),
  criado_em timestamptz not null default now()
);
create index if not exists contatos_manuais_dono_idx on contatos_manuais (dono_id);

alter table contatos_manuais enable row level security;
create policy "cada conta gerencia os próprios contatos manuais" on contatos_manuais
  for all to authenticated
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()));
