import type { criarClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>;

// WhatsApp de quem já fez negócio com a conta logada; os demais não aparecem.
export async function buscarTelefones(supabase: Cliente, ids: (string | null | undefined)[]) {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unicos.length === 0) return new Map<string, string>();
  const { data } = await supabase.rpc("telefones_de_negocio", { p_ids: unicos });
  return new Map(((data ?? []) as { id: string; telefone: string }[]).map((t) => [t.id, t.telefone]));
}
