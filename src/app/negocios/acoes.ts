"use server";

import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";

export type EstadoAvaliacao = { erro?: string; ok?: boolean };

export async function avaliarNegocio(_: EstadoAvaliacao, form: FormData): Promise<EstadoAvaliacao> {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase.rpc("avaliar", {
    p_compra: String(form.get("compra")),
    p_nota: Number(form.get("nota")),
    p_comentario: String(form.get("comentario") ?? ""),
  });
  if (error) return { erro: error.message };
  revalidatePath("/negocios");
  return { ok: true };
}

// Comprador confirma que recebeu; vendedor confirma que entregou e recebeu o pagamento.
export async function concluirNegocio(form: FormData) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase.rpc("concluir_negocio", { p_compra: String(form.get("compra")) });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
