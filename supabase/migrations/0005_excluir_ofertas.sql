-- Lance Certo: o vendedor pode excluir as próprias ofertas.
-- As compras já feitas ficam no histórico; o vínculo com a oferta vira nulo
-- (compras.oferta_id é "on delete set null").

create policy "fornecedor exclui as próprias ofertas" on ofertas
  for delete to authenticated using (fornecedor_id = auth.uid());
