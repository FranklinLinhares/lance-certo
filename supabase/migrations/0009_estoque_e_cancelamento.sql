-- Lance Certo: comprar todo o estoque e cancelar só leilão aberto.

-- comprar_oferta zera a quantidade e desativa a oferta quando o comprador leva
-- tudo; antes o check "> 0" desfazia a compra.
alter table ofertas drop constraint if exists ofertas_quantidade_disponivel_check;
alter table ofertas add constraint ofertas_quantidade_disponivel_check
  check (quantidade_disponivel >= 0);

-- Antes, um pedido já fechado (com compra no histórico) podia virar cancelado.
drop policy if exists "comprador cancela os próprios pedidos" on pedidos;
create policy "comprador cancela os próprios pedidos" on pedidos
  for update to authenticated using (comprador_id = auth.uid() and status = 'aberto')
  with check (comprador_id = auth.uid() and status = 'cancelado');
