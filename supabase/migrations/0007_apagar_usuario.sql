-- Lance Certo: permite apagar um usuário que venceu algum leilão.
-- Apagar o usuário apaga a empresa e os lances dela. O lance vencedor ainda
-- estava ligado ao pedido do comprador, e o banco recusava a exclusão
-- ("Database error deleting user"). Agora o pedido fica sem vencedor; a compra
-- continua no histórico do comprador.
alter table pedidos drop constraint pedidos_lance_vencedor_fk;
alter table pedidos
  add constraint pedidos_lance_vencedor_fk
  foreign key (lance_vencedor_id) references lances (id) on delete set null;
