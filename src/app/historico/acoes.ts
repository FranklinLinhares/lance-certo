"use server";

import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";
import { idsMarcados, ocultar } from "@/lib/ocultos";
import { CATEGORIAS, UNIDADES, chaveDoProduto } from "@/lib/dominio";

export type EstadoHistorico = { erro?: string; ok?: boolean };

// Compras feitas fora do app também entram no histórico de preços.
export async function registrarCompraExterna(_: EstadoHistorico, form: FormData): Promise<EstadoHistorico> {
  const { supabase, empresa } = await exigirEmpresa();
  const produto = String(form.get("produto") ?? "").trim();
  const categoria = String(form.get("categoria"));
  const unidade = String(form.get("unidade"));
  const quantidade = Number(String(form.get("quantidade")).replace(",", "."));
  const preco = Number(String(form.get("preco_unitario")).replace(",", "."));
  if (!produto || !(quantidade > 0) || !(preco > 0)) return { erro: "Preencha produto, quantidade e preço." };
  if (!(categoria in CATEGORIAS) || !(unidade in UNIDADES)) return { erro: "Escolha a categoria e a unidade." };

  const { error } = await supabase.from("compras").insert({
    comprador_id: empresa.id,
    fornecedor_nome: String(form.get("fornecedor_nome") ?? "").trim() || null,
    produto,
    produto_chave: chaveDoProduto(produto),
    categoria,
    unidade,
    quantidade,
    preco_unitario: preco,
    origem: "externa",
    data: form.get("data") || undefined,
  });
  if (error) return { erro: error.message };
  revalidatePath("/historico");
  return { ok: true };
}

// Tira produtos de Meus preços (cada id é "produto_chave|unidade").
export async function ocultarHistorico(form: FormData) {
  const { supabase } = await exigirEmpresa();
  await ocultar(supabase, "historico", idsMarcados(form));
  revalidatePath("/historico");
}
