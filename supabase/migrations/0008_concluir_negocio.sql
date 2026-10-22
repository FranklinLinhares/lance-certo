-- Lance Certo: avaliação só depois do negócio concluído
-- O comprador confirma que recebeu o produto e o vendedor confirma que entregou
-- e recebeu o pagamento. Só quando os dois confirmam é que cada um pode avaliar o outro.

alter table compras add column if not exists concluido_comprador_em timestamptz;
alter table compras add column if not exists concluido_fornecedor_em timestamptz;

-- Quem participou do negócio confirma a sua parte.
create or replace function concluir_negocio(p_compra uuid)
returns compras
language plpgsql
security definer set search_path = public
as $$
declare
  v_compra compras;
begin
  select * into v_compra from compras where id = p_compra for update;
  if v_compra is null or v_compra.fornecedor_id is null
     or auth.uid() not in (v_compra.comprador_id, v_compra.fornecedor_id) then
    raise exception 'Negócio não encontrado.';
  end if;

  if auth.uid() = v_compra.comprador_id then
    update compras set concluido_comprador_em = coalesce(concluido_comprador_em, now())
    where id = p_compra returning * into v_compra;
  else
    update compras set concluido_fornecedor_em = coalesce(concluido_fornecedor_em, now())
    where id = p_compra returning * into v_compra;
  end if;
  return v_compra;
end;
$$;

-- Avalia a outra parte de um negócio concluído. Avaliar de novo substitui a avaliação anterior.
create or replace function avaliar(p_compra uuid, p_nota integer, p_comentario text default null)
returns avaliacoes
language plpgsql
security definer set search_path = public
as $$
declare
  v_compra compras;
  v_avaliado uuid;
  v_como text;
  v_avaliacao avaliacoes;
begin
  select * into v_compra from compras where id = p_compra;
  if v_compra is null or auth.uid() not in (v_compra.comprador_id, coalesce(v_compra.fornecedor_id, v_compra.comprador_id)) then
    raise exception 'Negócio não encontrado.';
  end if;
  if v_compra.fornecedor_id is null then
    raise exception 'Compras feitas fora do app não podem ser avaliadas.';
  end if;
  if v_compra.concluido_comprador_em is null or v_compra.concluido_fornecedor_em is null then
    raise exception 'A avaliação abre quando comprador e vendedor confirmarem que o negócio foi concluído.';
  end if;
  if p_nota is null or p_nota not between 1 and 5 then
    raise exception 'Dê uma nota de 1 a 5 estrelas.';
  end if;

  if auth.uid() = v_compra.comprador_id then
    v_avaliado := v_compra.fornecedor_id;
    v_como := 'vendedor';
  else
    v_avaliado := v_compra.comprador_id;
    v_como := 'comprador';
  end if;

  insert into avaliacoes (compra_id, avaliador_id, avaliado_id, avaliado_como, nota, comentario)
  values (p_compra, auth.uid(), v_avaliado, v_como, p_nota, nullif(trim(p_comentario), ''))
  on conflict (compra_id, avaliador_id) do update
    set nota = excluded.nota, comentario = excluded.comentario, criado_em = now()
  returning * into v_avaliacao;
  return v_avaliacao;
end;
$$;

revoke execute on function concluir_negocio from public;
grant execute on function concluir_negocio to authenticated;

notify pgrst, 'reload schema';
