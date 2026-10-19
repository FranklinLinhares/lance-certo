"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";
import { CATEGORIAS, UNIDADES, chaveDoProduto } from "@/lib/dominio";

export type EstadoForm = { erro?: string };

const numero = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function criarPedido(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase, empresa } = await exigirEmpresa();
  if (empresa.papel !== "comprador") return { erro: "Apenas compradores criam leilões." };

  const produto = String(form.get("produto") ?? "").trim();
  const categoria = String(form.get("categoria"));
  const unidade = String(form.get("unidade"));
  const quantidade = numero(form.get("quantidade"));
  const horas = Number(form.get("duracao_horas")) || 24;
  if (!produto || !quantidade) return { erro: "Informe o produto e a quantidade." };
  if (!(categoria in CATEGORIAS) || !(unidade in UNIDADES)) return { erro: "Escolha a categoria e a unidade." };

  const referencia = String(form.get("referencia_preco") || "");
  const { data, error } = await supabase
    .from("pedidos")
    .insert({
      comprador_id: empresa.id,
      produto,
      produto_chave: String(form.get("produto_chave") || "") || chaveDoProduto(produto),
      categoria,
      unidade,
      quantidade,
      especificacoes: String(form.get("especificacoes") ?? "").trim() || null,
      validade_minima_dias: numero(form.get("validade_minima_dias")),
      entrega_ate: form.get("entrega_ate") || null,
      preco_maximo: numero(form.get("preco_maximo")),
      lances_visiveis: form.get("lances_visiveis") === "sim",
      encerra_em: new Date(Date.now() + horas * 3_600_000).toISOString(),
      referencia_preco: referencia ? JSON.parse(referencia) : null,
    })
    .select("id")
    .single();
  if (error) return { erro: error.message };
  redirect(`/pedidos/${data.id}`);
}

export async function darLance(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirEmpresa();
  const pedido = String(form.get("pedido"));
  const preco = numero(form.get("preco"));
  if (!preco) return { erro: "Informe o preço por unidade." };
  const { error } = await supabase.rpc("dar_lance", {
    p_pedido: pedido,
    p_preco: preco,
    p_validade: form.get("validade") || null,
    p_observacao: String(form.get("observacao") ?? "").trim() || null,
  });
  if (error) return { erro: error.message };
  revalidatePath(`/pedidos/${pedido}`);
  return {};
}

export async function escolherVencedor(form: FormData) {
  const { supabase } = await exigirEmpresa();
  const pedido = String(form.get("pedido"));
  const { error } = await supabase.rpc("fechar_pedido", { p_pedido: pedido, p_lance: String(form.get("lance")) });
  if (error) throw new Error(error.message);
  revalidatePath(`/pedidos/${pedido}`);
}

export async function cancelarPedido(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  const pedido = String(form.get("pedido"));
  await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", pedido).eq("comprador_id", empresa.id).eq("status", "aberto");
  revalidatePath(`/pedidos/${pedido}`);
}
