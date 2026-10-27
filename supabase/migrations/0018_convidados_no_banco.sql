-- Ofertas e leilões "só para convidados" ficavam escondidos só na tela: a leitura
-- das tabelas era liberada para qualquer conta logada (using true), então a API
-- devolvia esses itens para quem não foi convidado.
-- Agora o banco só entrega um item com convidados para o dono e para os convidados.
-- Itens sem convidados continuam como antes. As telas da vitrine e dos leilões
-- usam funções próprias (vitrine_ofertas, pedidos_proximos), que não mudam.

drop policy "ofertas visíveis a usuários logados" on ofertas;
create policy "ofertas visíveis a usuários logados" on ofertas
  for select to authenticated using (
    convidados is null
    or fornecedor_id = (select auth.uid())
    or (select auth.uid()) = any (convidados)
  );

drop policy "pedidos visíveis a usuários logados" on pedidos;
create policy "pedidos visíveis a usuários logados" on pedidos
  for select to authenticated using (
    convidados is null
    or comprador_id = (select auth.uid())
    or (select auth.uid()) = any (convidados)
  );
