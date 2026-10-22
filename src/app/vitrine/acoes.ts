"use server";

import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";

export type EstadoCompra = { erro?: string; ok?: string };

// Envia o pedido de compra ao vendedor; a quantidade fica reservada até ele responder.
export async function comprarOferta(_: EstadoCompra, form: FormData): Promise<EstadoCompra> {
  const { supabase } = await exigirEmpresa();
  const quantidade = Number(String(form.get("quantidade")).replace(",", "."));
  const { error } = await supabase.rpc("reservar_oferta", {
    p_oferta: String(form.get("oferta")),
    p_quantidade: quantidade,
  });
  if (error) return { erro: error.message };
  revalidatePath("/vitrine");
  revalidatePath("/negocios");
  return { ok: "Pedido enviado ao vendedor. A quantidade fica reservada até ele responder." };
}
