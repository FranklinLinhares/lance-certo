"use server";

import { redirect } from "next/navigation";
import { exigirEmpresa } from "@/lib/sessao";

// Troca a conta entre comprar e vender, como no BlaBlaCar (oferecer ou pegar carona).
export async function trocarModo(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  const papel = form.get("papel") === "fornecedor" ? "fornecedor" : "comprador";
  if (papel !== empresa.papel) {
    await supabase.from("empresas").update({ papel }).eq("id", empresa.id);
  }
  redirect(papel === "fornecedor" ? "/pedidos" : "/vitrine");
}
