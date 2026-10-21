-- Lance Certo: dados pessoais só para quem precisa deles.
-- Qualquer conta lia CPF/CNPJ, telefone, endereço e a localização exata de
-- todas as outras. Agora as outras contas veem só o perfil público; cada conta
-- lê os próprios dados por minha_empresa() e o telefone de quem já fez negócio
-- com ela por telefones_de_negocio().

revoke select on empresas from anon, authenticated;
grant select (id, papel, nome, nome_completo, tipo_documento, agricultor, cidade, uf,
              raio_km, categorias, negocia_com, criado_em)
  on empresas to authenticated;

create or replace function minha_empresa()
returns setof empresas
language sql stable
security definer set search_path = public
as $$
  select * from empresas where id = auth.uid()
$$;

-- Telefone (WhatsApp) só da própria conta e de quem tem compra registrada com ela.
create or replace function telefones_de_negocio(p_ids uuid[])
returns table (id uuid, telefone text)
language sql stable
security definer set search_path = public
as $$
  select e.id, e.telefone
  from empresas e
  where e.id = any (p_ids)
    and (
      e.id = auth.uid()
      or exists (
        select 1 from compras c
        where (c.comprador_id = auth.uid() and c.fornecedor_id = e.id)
           or (c.fornecedor_id = auth.uid() and c.comprador_id = e.id)
      )
    )
$$;

revoke execute on function minha_empresa, telefones_de_negocio from public;
grant execute on function minha_empresa, telefones_de_negocio to authenticated;
