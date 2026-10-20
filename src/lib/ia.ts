import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORIAS, UNIDADES, type ReferenciaPreco } from "@/lib/dominio";

// Agente de IA do Lance Certo: transforma texto livre em item estruturado e
// pesquisa preços de referência na internet.

const MODELO = "claude-opus-5-5";

export function iaDisponivel() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const cliente = () => new Anthropic();

const ItemSchema = z.object({
  produto: z.string().describe("Nome claro do produto, como um comprador escreveria"),
  produto_chave: z
    .string()
    .describe("Identificador normalizado, minúsculo, sem acento, palavras separadas por hífen, sem marca nem embalagem"),
  categoria: z.enum(Object.keys(CATEGORIAS) as [keyof typeof CATEGORIAS, ...(keyof typeof CATEGORIAS)[]]),
  unidade: z.enum(Object.keys(UNIDADES) as [keyof typeof UNIDADES, ...(keyof typeof UNIDADES)[]]),
  quantidade: z.number().nullable().describe("Quantidade convertida para a unidade escolhida"),
  preco_unitario: z.number().nullable().describe("Preço por unidade padronizada, se o texto informar"),
  especificacoes: z.string().describe("Tipo, classe, corte, embalagem, validade e outros detalhes; vazio se não houver"),
  validade_minima_dias: z.number().nullable(),
});
export type ItemEstruturado = z.infer<typeof ItemSchema>;

const INSTRUCOES_ITEM = `Você organiza anúncios de compra e venda de alimentos para um app de negociação entre empresas na Paraíba.
Receba um texto livre e devolva o item estruturado.
- Padronize a unidade para kg, l, un ou duzia e converta quantidade e preço para essa unidade (ex.: "10 caixas de 20 kg a R$ 90 a caixa" vira 200 kg a 4,50/kg).
- produto_chave deve ser igual para o mesmo produto escrito de formas diferentes: "arroz agulhinha tipo 1 pct 5kg" e "arroz branco tipo 1" viram "arroz-branco-tipo-1".
- Não invente quantidade, preço ou validade que o texto não informou: use null.`;

export async function estruturarItem(texto: string): Promise<ItemEstruturado> {
  const resposta = await cliente().messages.parse({
    model: MODELO,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ItemSchema) },
    system: INSTRUCOES_ITEM,
    messages: [{ role: "user", content: texto }],
  });
  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
    throw new Error("A IA não conseguiu entender o texto. Preencha os campos manualmente.");
  }
  return resposta.parsed_output;
}

const ReferenciaSchema = z.object({
  minimo: z.number().nullable(),
  medio: z.number().nullable(),
  maximo: z.number().nullable(),
  resumo: z.string().describe("Duas ou três frases em português sobre o preço encontrado e de onde veio"),
  fontes: z.array(z.object({ titulo: z.string(), url: z.string(), preco: z.number().nullable() })),
  preco_maximo_sugerido: z.number().nullable().describe("Teto realista para o leilão, por unidade"),
});

// Pesquisa preços na internet e devolve uma faixa de referência por unidade.
// Primeiro pesquisa com busca na web, depois organiza o resultado em JSON.
export async function pesquisarPreco(params: {
  produto: string;
  especificacoes?: string;
  unidade: keyof typeof UNIDADES;
  cidade: string;
  uf: string;
  precoMedioNoApp?: number | null;
}): Promise<ReferenciaPreco> {
  const unidade = UNIDADES[params.unidade];
  const pedido = `Pesquise o preço atual de atacado de "${params.produto}"${
    params.especificacoes ? ` (${params.especificacoes})` : ""
  } para compra por empresas em ${params.cidade}/${params.uf}, Brasil.
Converta todos os preços para R$ por ${unidade}.
Priorize cotações recentes de CEASA (especialmente CEASA-PB e CEASA-PE), CONAB, atacarejos e distribuidores da região. Se só encontrar preço de varejo, diga isso.
Liste cada fonte com título, URL e preço por ${unidade}.`;

  const pesquisa = await cliente()
    .beta.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "BR", region: params.uf, city: params.cidade } }],
      messages: [{ role: "user", content: pedido }],
    })
    .finalMessage();

  if (pesquisa.stop_reason === "refusal") {
    throw new Error("A pesquisa de preço não pôde ser feita agora.");
  }
  const textoPesquisa = pesquisa.content
    .map((bloco) => (bloco.type === "text" ? bloco.text : ""))
    .join("");

  const contextoApp =
    params.precoMedioNoApp != null
      ? `\nNo próprio app, compradores da região pagaram em média R$ ${params.precoMedioNoApp} por ${unidade} nos últimos 30 dias.`
      : "";

  const organizado = await cliente().messages.parse({
    model: MODELO,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ReferenciaSchema) },
    messages: [
      {
        role: "user",
        content: `Organize esta pesquisa de preço de "${params.produto}" em R$ por ${unidade}. Use só valores que aparecem na pesquisa; deixe null o que não houver.${contextoApp}\n\n<pesquisa>\n${textoPesquisa}\n</pesquisa>`,
      },
    ],
  });
  if (!organizado.parsed_output) {
    throw new Error("Não foi possível organizar a pesquisa de preço.");
  }
  return { ...organizado.parsed_output, unidade: params.unidade };
}

const SupermercadosSchema = z.object({
  resumo: z.string().describe("Duas ou três frases em português sobre os preços encontrados e onde está mais barato"),
  precos: z.array(
    z.object({
      loja: z.string().describe("Nome do supermercado, hipermercado ou atacarejo"),
      cidade: z.string(),
      preco: z.number().describe("Preço em R$ convertido para a unidade pedida"),
      descricao: z.string().describe("Produto como aparece no site, com marca e embalagem"),
      fonte: z.enum(["site", "encarte", "aplicativo", "outro"]),
      data: z.string().nullable().describe("Data ou validade do preço, se aparecer"),
      url: z.string(),
    }),
  ),
});
export type PrecoSupermercado = z.infer<typeof SupermercadosSchema>["precos"][number];
export type PesquisaSupermercados = z.infer<typeof SupermercadosSchema>;

// Pesquisa o preço de varejo do produto nos sites, aplicativos e encartes de
// supermercados e hipermercados até `raioKm` da cidade da pessoa.
export async function pesquisarSupermercados(params: {
  produto: string;
  unidade: keyof typeof UNIDADES;
  cidade: string;
  uf: string;
  raioKm: number;
}): Promise<PesquisaSupermercados> {
  const unidade = UNIDADES[params.unidade];
  const pedido = `Pesquise o preço atual de "${params.produto}" em supermercados, hipermercados e atacarejos
que tenham loja em ${params.cidade}/${params.uf} ou em cidades até ${params.raioKm} km de distância, no Brasil.
Procure nos sites e lojas online das redes (por exemplo Atacadão, Assaí, Carrefour, Mix Mateus, Bompreço e redes locais da Paraíba),
nos aplicativos e nos encartes de ofertas da semana.
Para cada preço encontrado, informe a loja, a cidade, o produto como aparece (marca e embalagem), o preço convertido para R$ por ${unidade},
se veio do site, do encarte ou do aplicativo, a data ou validade do preço e o link.
Não invente preços: liste só o que encontrar.`;

  const pesquisa = await cliente()
    .beta.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", country: "BR", region: params.uf, city: params.cidade } }],
      messages: [{ role: "user", content: pedido }],
    })
    .finalMessage();

  if (pesquisa.stop_reason === "refusal") {
    throw new Error("A pesquisa de preço não pôde ser feita agora.");
  }
  const textoPesquisa = pesquisa.content
    .map((bloco) => (bloco.type === "text" ? bloco.text : ""))
    .join("");

  const organizado = await cliente().messages.parse({
    model: MODELO,
    max_tokens: 6000,
    output_config: { effort: "low", format: zodOutputFormat(SupermercadosSchema) },
    messages: [
      {
        role: "user",
        content: `Organize esta pesquisa de preços de "${params.produto}" em supermercados, com preços em R$ por ${unidade}, do mais barato para o mais caro. Use só valores que aparecem na pesquisa.\n\n<pesquisa>\n${textoPesquisa}\n</pesquisa>`,
      },
    ],
  });
  if (!organizado.parsed_output) {
    throw new Error("Não foi possível organizar a pesquisa de preço.");
  }
  const resultado = organizado.parsed_output;
  return { ...resultado, precos: [...resultado.precos].sort((a, b) => a.preco - b.preco) };
}
