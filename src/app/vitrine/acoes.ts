"use server";

import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";
import { buscarTelefones } from "@/lib/telefones";

export type EstadoCompra = { erro?: string; ok?: string; compra?: string; telefone?: string };

export async function comprarOferta(_: EstadoCompra, form: FormData): Promise<EstadoCompra> {
  const { supabase } = await exigirEmpresa();
  const fornecedor = String(form.get("fornecedor") ?? "");
  const quantidade = Number(String(form.get("quantidade")).replace(",", "."));
  const { data, error } = await supabase.rpc("comprar_oferta", {
    p_oferta: String(form.get("oferta")),
    p_quantidade: quantidade,
  });
  if (error) return { erro: error.message };
  revalidatePath("/vitrine");
  // Depois da compra o telefone do fornecedor fica disponível para a conta.
  const telefone = (await buscarTelefones(supabase, [fornecedor])).get(fornecedor);
  return { ok: "Compra registrada. Combine a entrega com o fornecedor pelo WhatsApp.", compra: (data as { id: string } | null)?.id, telefone };
}
