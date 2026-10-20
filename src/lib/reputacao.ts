import type { criarClienteServidor } from "@/lib/supabase/server";

export type Reputacao = {
  empresa_id: string;
  nota_vendedor: number | null;
  avaliacoes_vendedor: number;
  nota_comprador: number | null;
  avaliacoes_comprador: number;
  vendas: number;
  compras: number;
};

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>;

// Reputação de várias contas de uma vez, indexada pelo id.
export async function buscarReputacao(supabase: Cliente, ids: string[]) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map<string, Reputacao>();
  const { data } = await supabase.rpc("reputacao", { p_ids: unicos });
  return new Map(((data ?? []) as Reputacao[]).map((r) => [r.empresa_id, r]));
}
