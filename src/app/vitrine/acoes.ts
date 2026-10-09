"use server";

import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";

export type EstadoCompra = { erro?: string; ok?: string };

export async function comprarOferta(_: EstadoCompra, form: FormData): Promise<EstadoCompra> {
  const { supabase } = await exigirEmpresa();
  const quantidade = Number(String(form.get("quantidade")).replace(",", "."));
  const { error } = await supabase.rpc("comprar_oferta", {
    p_oferta: String(form.get("oferta")),
    p_quantidade: quantidade,
  });
  if (error) return { erro: error.message };
  revalidatePath("/vitrine");
  return { ok: "Compra registrada. Combine a entrega com o fornecedor pelo WhatsApp." };
}
