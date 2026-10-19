-- Lance Certo: correções em vitrine, cancelamento e lances.

-- ---------------------------------------------------------------------------
-- Vitrine: comprar todo o estoque de uma oferta
-- ---------------------------------------------------------------------------
-- comprar_oferta zera a quantidade e desativa a oferta quando o comprador leva
-- tudo; antes o check "> 0" desfazia a compra.
alter table ofertas drop constraint ofertas_quantidade_disponivel_check;
alter table ofertas add constraint ofertas_quantidade_disponivel_check
  check (quantidade_disponivel >= 0);

-- ---------------------------------------------------------------------------
-- Pedidos: só dá para cancelar um leilão que ainda está aberto
-- ---------------------------------------------------------------------------
-- Antes, um pedido já fechado (com compra no histórico) podia virar cancelado.
drop policy "comprador cancela os próprios pedidos" on pedidos;
create policy "comprador cancela os próprios pedidos" on pedidos
  for update to authenticated using (comprador_id = auth.uid() and status = 'aberto')
  with check (comprador_id = auth.uid() and status = 'cancelado');

-- ---------------------------------------------------------------------------
-- Lances: ninguém dá lance no próprio pedido
-- ---------------------------------------------------------------------------
-- Igual à versão de 0001, com a checagem do comprador. Sem ela, quem trocasse o
-- papel para fornecedor podia dar um lance falso no próprio leilão.

create or replace function dar_lance(p_pedido uuid, p_preco numeric,
                          p_validade date default null, p_observacao text default null)
returns lances
language plpgsql
security definer set search_path = public
as $$
declare
  v_pedido pedidos;
  v_fornecedor empresas;
  v_referencia numeric;
  v_lance lances;
begin
  select * into v_fornecedor from empresas where id = auth.uid();
  if v_fornecedor is null or v_fornecedor.papel <> 'fornecedor' then
    raise exception 'Apenas fornecedores podem dar lances.';
  end if;

  select * into v_pedido from pedidos where id = p_pedido for update;
  if v_pedido is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_pedido.comprador_id = v_fornecedor.id then
    raise exception 'Você não pode dar lance no seu próprio pedido.';
  end if;
  if v_pedido.status <> 'aberto' or v_pedido.encerra_em <= now() then
    raise exception 'Este leilão já foi encerrado.';
  end if;
  if not se_alcancam(v_pedido.comprador_id, v_fornecedor.id) then
    raise exception 'Este pedido está fora do seu raio de entrega ou do raio do comprador.';
  end if;
  if v_pedido.preco_maximo is not null and p_preco > v_pedido.preco_maximo then
    raise exception 'O lance precisa ser no máximo R$ % por unidade.', v_pedido.preco_maximo;
  end if;

  if v_pedido.lances_visiveis then
    select min(preco_unitario) into v_referencia from lances where pedido_id = p_pedido;
    if v_referencia is not null and p_preco >= v_referencia then
      raise exception 'O lance precisa ser menor que o menor lance atual (R$ %).', v_referencia;
    end if;
  else
    select min(preco_unitario) into v_referencia
    from lances where pedido_id = p_pedido and fornecedor_id = v_fornecedor.id;
    if v_referencia is not null and p_preco >= v_referencia then
      raise exception 'O novo lance precisa ser menor que o seu lance anterior (R$ %).', v_referencia;
    end if;
  end if;

  insert into lances (pedido_id, fornecedor_id, preco_unitario, validade, observacao)
  values (p_pedido, v_fornecedor.id, p_preco, p_validade, p_observacao)
  returning * into v_lance;

  if v_pedido.encerra_em - now() < interval '5 minutes' then
    update pedidos set encerra_em = now() + interval '5 minutes' where id = p_pedido;
  end if;

  return v_lance;
end;
$$;
