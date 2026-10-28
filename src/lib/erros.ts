// Mensagens de erro do banco em português. As funções do app (raise exception) já
// escrevem em português e passam direto; o resto vira um texto claro para o usuário.
type ErroBanco = { code?: string; message: string } | null | undefined;

const POR_CODIGO: Record<string, string> = {
  "23505": "Isso já está cadastrado.",
  "23514": "Algum campo tem um valor que não é aceito. Confira e tente de novo.",
  "23502": "Faltou preencher um campo obrigatório.",
  "23503": "Este item não existe mais. Atualize a página e tente de novo.",
  "22P02": "Algum valor está num formato inválido. Confira os números e datas.",
  "22003": "Algum número está grande demais.",
  "42501": "Você não tem permissão para fazer isso.",
  PGRST116: "Este item não foi encontrado. Atualize a página e tente de novo.",
};

export function mensagemDeErro(erro: ErroBanco): string {
  if (!erro) return "Não foi possível concluir agora. Tente de novo em instantes.";
  if (erro.code === "P0001") return erro.message;
  if (erro.code && POR_CODIGO[erro.code]) return POR_CODIGO[erro.code];
  if (/row-level security/i.test(erro.message)) return POR_CODIGO["42501"];
  console.error("Erro do banco:", erro);
  return "Não foi possível concluir agora. Tente de novo em instantes.";
}

// No navegador: queda de internet (TypeError) ou resposta que não é JSON (SyntaxError)
// chegam em inglês; as mensagens que o próprio app manda já estão em português.
export function mensagemDaTela(e: unknown): string {
  if (e instanceof TypeError || e instanceof SyntaxError || !(e instanceof Error) || !e.message) {
    return "O servidor não respondeu. Confira a internet e tente de novo.";
  }
  return e.message;
}
