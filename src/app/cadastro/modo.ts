"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirEmpresa } from "@/lib/sessao";

// Troca a conta entre comprar e vender, como no BlaBlaCar (oferecer ou pegar carona).
export async function trocarModo(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  const papel = form.get("papel") === "fornecedor" ? "fornecedor" : "comprador";
  if (papel !== empresa.papel) {
    await supabase.from("empresas").update({ papel }).eq("id", empresa.id);
  }
  // O menu fica no layout; sem isso o botão continua marcado no modo antigo.
  revalidatePath("/", "layout");
  redirect(papel === "fornecedor" ? "/pedidos" : "/vitrine");
}
