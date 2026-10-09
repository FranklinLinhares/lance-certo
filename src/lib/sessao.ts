import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Empresa } from "@/lib/dominio";

// Usuário logado com empresa cadastrada; senão manda para o passo que falta.
export async function exigirEmpresa() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Empresa>();
  if (!empresa) redirect("/cadastro");

  return { supabase, user, empresa };
}
