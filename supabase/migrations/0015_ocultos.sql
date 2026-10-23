-- Lance Certo: tirar itens da própria lista sem apagar o que é da outra parte.
-- Ofertas de outros vendedores, leilões de outros compradores, negócios e o
-- histórico de preços são compartilhados; "excluir" nessas telas só esconde
-- o item para quem excluiu.

create table if not exists ocultos (
  empresa_id uuid not null default auth.uid() references empresas (id) on delete cascade,
  tipo text not null check (tipo in ('oferta', 'pedido', 'compra', 'reserva', 'historico')),
  item text not null,
  criado_em timestamptz not null default now(),
  primary key (empresa_id, tipo, item)
);

alter table ocultos enable row level security;
create policy "cada conta gerencia os próprios ocultos" on ocultos
  for all to authenticated using (empresa_id = auth.uid()) with check (empresa_id = auth.uid());
