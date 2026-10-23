import type { criarClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>;

export type TipoOculto = "oferta" | "pedido" | "compra" | "reserva" | "historico";

// Itens que a conta tirou da própria lista; para a outra parte eles continuam lá.
export async function buscarOcultos(supabase: Cliente, tipo: TipoOculto) {
  const { data } = await supabase.from("ocultos").select("item").eq("tipo", tipo);
  return new Set((data ?? []).map((o) => o.item as string));
}

export async function ocultar(supabase: Cliente, tipo: TipoOculto, itens: string[]) {
  if (itens.length === 0) return;
  const { error } = await supabase.from("ocultos").upsert(
    itens.map((item) => ({ tipo, item })),
    { onConflict: "empresa_id,tipo,item", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

// Ids marcados nas caixinhas de seleção (no máximo 200 por vez).
export function idsMarcados(form: FormData) {
  return [...new Set(form.getAll("ids").map(String).filter(Boolean))].slice(0, 200);
}
