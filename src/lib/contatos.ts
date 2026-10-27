import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoContato = "fornecedor" | "cliente";
export type Contato = { id: string; nome: string; cidade: string; uf: string; pessoa_juridica: boolean };

// Contato cadastrado à mão: alguém que ainda não tem conta no app.
export type ContatoManual = {
  id: string; tipo: TipoContato; nome: string; telefone: string | null; email: string | null;
  documento: string | null; cidade: string | null; uf: string | null; observacao: string | null;
};

export async function buscarContatosManuais(supabase: SupabaseClient, dono: string, tipo: TipoContato): Promise<ContatoManual[]> {
  const { data } = await supabase
    .from("contatos_manuais")
    .select("id, tipo, nome, telefone, email, documento, cidade, uf, observacao")
    .eq("dono_id", dono)
    .eq("tipo", tipo)
    .order("nome")
    .returns<ContatoManual[]>();
  return data ?? [];
}

// Fornecedores ou clientes que a conta guardou em Meus contatos.
export async function buscarContatos(supabase: SupabaseClient, dono: string, tipo: TipoContato): Promise<Contato[]> {
  const { data } = await supabase
    .from("contatos")
    .select("contato:empresas!contatos_contato_id_fkey(id, nome, cidade, uf, tipo_documento)")
    .eq("dono_id", dono)
    .eq("tipo", tipo)
    .returns<{ contato: { id: string; nome: string; cidade: string; uf: string; tipo_documento: string } | null }[]>();
  return (data ?? [])
    .flatMap((c) => (c.contato ? [{ ...c.contato, pessoa_juridica: c.contato.tipo_documento === "cnpj" }] : []))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// Lê "Quem pode participar" do formulário: nulo = todos; senão, os contatos marcados.
// Só aceita contas que estão de fato nos contatos de quem publica.
export async function lerConvidados(
  supabase: SupabaseClient,
  dono: string,
  tipo: TipoContato,
  form: FormData,
): Promise<{ convidados: string[] | null; erro?: string }> {
  if (form.get("publico_convidados") !== "selecionados") return { convidados: null };
  const marcados = form.getAll("convidados").map(String);
  const permitidos = new Set((await buscarContatos(supabase, dono, tipo)).map((c) => c.id));
  const convidados = marcados.filter((id) => permitidos.has(id));
  if (convidados.length === 0) {
    return { convidados: null, erro: `Escolha pelo menos um ${tipo === "fornecedor" ? "fornecedor" : "cliente"}, ou deixe aberto para todos.` };
  }
  return { convidados };
}
