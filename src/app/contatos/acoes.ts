"use server";

import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";

export async function adicionarContato(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  const tipo = form.get("tipo") === "cliente" ? "cliente" : "fornecedor";
  await supabase
    .from("contatos")
    .upsert({ dono_id: empresa.id, contato_id: String(form.get("contato")), tipo }, { ignoreDuplicates: true });
  revalidatePath("/contatos");
}

export async function removerContato(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  await supabase
    .from("contatos")
    .delete()
    .eq("dono_id", empresa.id)
    .eq("contato_id", String(form.get("contato")))
    .eq("tipo", String(form.get("tipo")));
  revalidatePath("/contatos");
}
