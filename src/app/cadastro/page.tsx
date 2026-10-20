import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Empresa } from "@/lib/dominio";
import { FormularioEmpresa } from "./formulario";

export default async function Cadastro() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: empresa } = await supabase.from("empresas").select("*").eq("id", user.id).maybeSingle<Empresa>();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{empresa ? "Meu cadastro" : "Complete seu cadastro"}</h1>
      <p className="text-stone-600">Uma conta só para comprar e vender.</p>
      <FormularioEmpresa empresa={empresa} email={user.email ?? ""} />
    </div>
  );
}
