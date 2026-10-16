import { connection } from "next/server";

// Página pública que confere a configuração do app sem mostrar nenhum segredo.
// Serve para descobrir por que o cadastro não funciona em produção.

type Item = { nome: string; ok: boolean | null; detalhe: string };

async function verificar(): Promise<Item[]> {
  await connection();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const itens: Item[] = [
    {
      nome: "Variável NEXT_PUBLIC_SUPABASE_URL",
      ok: Boolean(url),
      detalhe: url ? new URL(url).host : "não definida na Vercel",
    },
    {
      nome: "Variável NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ok: Boolean(chave),
      detalhe: chave ? `definida (${chave.startsWith("sb_publishable_") ? "chave publishable" : chave.startsWith("eyJ") ? "chave anon" : "formato desconhecido"})` : "não definida na Vercel",
    },
    {
      nome: "Variável ANTHROPIC_API_KEY (IA)",
      ok: process.env.ANTHROPIC_API_KEY ? true : null,
      detalhe: process.env.ANTHROPIC_API_KEY ? "definida" : "não definida (o app funciona sem IA)",
    },
  ];
  if (!url || !chave) return itens;

  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` };
  try {
    const resposta = await fetch(`${url}/auth/v1/settings`, { headers: cabecalhos, cache: "no-store" });
    if (!resposta.ok) {
      itens.push({ nome: "Login do Supabase", ok: false, detalhe: `o Supabase recusou a chave (HTTP ${resposta.status})` });
    } else {
      const config = (await resposta.json()) as { disable_signup?: boolean; mailer_autoconfirm?: boolean; external?: { email?: boolean } };
      itens.push({ nome: "Login do Supabase", ok: true, detalhe: "conectado" });
      itens.push({
        nome: "Cadastro por e-mail",
        ok: !config.disable_signup && config.external?.email !== false,
        detalhe: config.disable_signup ? "novos cadastros estão desativados no Supabase" : config.external?.email === false ? "login por e-mail desativado no Supabase" : "permitido",
      });
      itens.push({
        nome: "Confirmação de e-mail",
        ok: config.mailer_autoconfirm ? true : null,
        detalhe: config.mailer_autoconfirm ? "desligada: a conta é criada na hora" : "ligada: é preciso clicar no link do e-mail antes de entrar",
      });
    }
  } catch (e) {
    itens.push({ nome: "Login do Supabase", ok: false, detalhe: `não foi possível conectar (${(e as Error).message})` });
  }

  try {
    const resposta = await fetch(`${url}/rest/v1/empresas?select=id&limit=1`, { headers: cabecalhos, cache: "no-store" });
    const corpo = await resposta.text();
    const semTabela = /PGRST205|42P01|does not exist|Could not find the table/i.test(corpo);
    itens.push({
      nome: "Tabelas do banco",
      ok: resposta.ok,
      detalhe: resposta.ok ? "criadas" : semTabela ? "não encontradas: rode o SQL de supabase/migrations/0001_inicial.sql" : `erro HTTP ${resposta.status}`,
    });
  } catch (e) {
    itens.push({ nome: "Tabelas do banco", ok: false, detalhe: (e as Error).message });
  }
  return itens;
}

export default async function Diagnostico() {
  const itens = await verificar();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Diagnóstico do app</h1>
      <ul className="cartao divide-y divide-stone-100">
        {itens.map((i) => (
          <li key={i.nome} className="flex items-start gap-3 py-2">
            <span aria-hidden className="text-lg">{i.ok === true ? "✅" : i.ok === false ? "❌" : "⚠️"}</span>
            <div>
              <div className="font-medium">{i.nome}</div>
              <div className="text-sm text-stone-600">{i.detalhe}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-stone-500">Nenhuma chave é mostrada nesta página.</p>
    </div>
  );
}
