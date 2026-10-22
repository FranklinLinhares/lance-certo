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

  // Os dados completos (documento, telefone, localização) só pela função da própria conta.
  const { data: empresa } = await supabase.rpc("minha_empresa").maybeSingle<Empresa>();
  if (!empresa) redirect("/cadastro");

  return { supabase, user, empresa };
}
