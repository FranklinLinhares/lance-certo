"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";
import { CATEGORIAS, UNIDADES, chaveDoProduto } from "@/lib/dominio";

export type EstadoOferta = { erro?: string };

export async function publicarOferta(_: EstadoOferta, form: FormData): Promise<EstadoOferta> {
  const { supabase, empresa } = await exigirEmpresa();
  if (empresa.papel !== "fornecedor") return { erro: "Apenas fornecedores publicam ofertas." };

  const produto = String(form.get("produto") ?? "").trim();
  const categoria = String(form.get("categoria"));
  const unidade = String(form.get("unidade"));
  const preco = Number(String(form.get("preco_unitario")).replace(",", "."));
  const quantidade = Number(String(form.get("quantidade_disponivel")).replace(",", "."));
  const diasValidaOferta = Number(form.get("dias_oferta")) || 7;

  if (!produto) return { erro: "Informe o produto." };
  if (!(categoria in CATEGORIAS) || !(unidade in UNIDADES)) return { erro: "Escolha a categoria e a unidade." };
  if (!(preco > 0) || !(quantidade > 0)) return { erro: "Informe preço e quantidade maiores que zero." };

  const { error } = await supabase.from("ofertas").insert({
    fornecedor_id: empresa.id,
    produto,
    produto_chave: String(form.get("produto_chave") || "") || chaveDoProduto(produto),
    categoria,
    unidade,
    preco_unitario: preco,
    quantidade_disponivel: quantidade,
    validade: form.get("validade") || null,
    disponivel_a_partir: form.get("disponivel_a_partir") || null,
    valida_ate: new Date(Date.now() + diasValidaOferta * 86_400_000).toISOString(),
    descricao: String(form.get("descricao") ?? "").trim() || null,
  });
  if (error) return { erro: error.message };
  revalidatePath("/ofertas");
  redirect("/ofertas");
}

export async function encerrarOferta(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  await supabase.from("ofertas").update({ ativa: false }).eq("id", String(form.get("id"))).eq("fornecedor_id", empresa.id);
  revalidatePath("/ofertas");
}
