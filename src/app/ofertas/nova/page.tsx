import { exigirEmpresa } from "@/lib/sessao";
import { buscarContatos } from "@/lib/contatos";
import { FormularioNovaOferta } from "./FormularioNovaOferta";

export default async function NovaOferta() {
  const { supabase, empresa } = await exigirEmpresa();
  return <FormularioNovaOferta clientes={await buscarContatos(supabase, empresa.id, "cliente")} />;
}
