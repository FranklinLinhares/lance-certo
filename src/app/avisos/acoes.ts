"use server";

import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";
import { UNIDADES, chaveDoProduto } from "@/lib/dominio";

export async function marcarTodosLidos() {
  const { supabase, empresa } = await exigirEmpresa();
  await supabase.from("avisos").update({ lido: true }).eq("empresa_id", empresa.id).eq("lido", false);
  revalidatePath("/", "layout");
}

export type EstadoAlerta = { erro?: string };

export async function criarAlerta(_: EstadoAlerta, form: FormData): Promise<EstadoAlerta> {
  const { supabase, empresa } = await exigirEmpresa();
  const produto = String(form.get("produto") ?? "").trim();
  const unidade = String(form.get("unidade"));
  const preco = Number(String(form.get("preco_maximo")).replace(",", "."));
  if (!produto) return { erro: "Informe o produto." };
  if (!(unidade in UNIDADES)) return { erro: "Escolha a unidade." };
  if (!(preco > 0)) return { erro: "Informe o preço máximo." };
  const { error } = await supabase.from("alertas_preco").insert({
    empresa_id: empresa.id,
    produto,
    produto_chave: chaveDoProduto(produto),
    unidade,
    preco_maximo: preco,
  });
  if (error) return { erro: error.message };
  revalidatePath("/avisos");
  return {};
}

export async function removerAlerta(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  await supabase.from("alertas_preco").delete().eq("id", String(form.get("id"))).eq("empresa_id", empresa.id);
  revalidatePath("/avisos");
}
