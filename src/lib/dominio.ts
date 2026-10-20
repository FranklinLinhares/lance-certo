// Tipos e rótulos compartilhados, espelhando o esquema do banco.

export const CATEGORIAS = {
  hortifruti: "Hortifrúti",
  graos: "Grãos e cereais",
  carnes: "Carnes e frios",
  laticinios: "Laticínios",
  bebidas: "Bebidas",
  mercearia: "Mercearia seca",
} as const;
export type Categoria = keyof typeof CATEGORIAS;

export const UNIDADES = {
  kg: "kg",
  l: "litro",
  un: "unidade",
  duzia: "dúzia",
} as const;
export type Unidade = keyof typeof UNIDADES;

// Modo atual da conta: a mesma pessoa compra ou vende e troca quando quiser.
export type Papel = "comprador" | "fornecedor";

export const NEGOCIA_COM = {
  todos: "Empresas e pessoas físicas",
  pj: "Só empresas (CNPJ)",
  pf: "Só pessoas físicas (CPF)",
} as const;
export type NegociaCom = keyof typeof NEGOCIA_COM;

export type Empresa = {
  id: string;
  papel: Papel;
  tipo_documento: "cnpj" | "cpf" | "cpf_caf" | "cpf_ie";
  documento: string;
  registro_rural: string | null;
  agricultor: boolean;
  nome: string; // nome fantasia da empresa, ou o nome da pessoa física
  nome_completo: string | null;
  endereco: string | null;
  negocia_com: NegociaCom;
  telefone: string;
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
  raio_km: number;
  categorias: Categoria[];
};

export type ReferenciaPreco = {
  minimo: number | null;
  medio: number | null;
  maximo: number | null;
  unidade: Unidade;
  resumo: string;
  fontes: { titulo: string; url: string; preco: number | null }[];
  preco_maximo_sugerido: number | null;
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function reais(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return "–";
  return moeda.format(Number(valor));
}

export function porUnidade(valor: number | string | null | undefined, unidade: Unidade) {
  return `${reais(valor)}/${UNIDADES[unidade]}`;
}

export function dataHora(valor: string | Date) {
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Fortaleza",
  });
}

// "Arroz Branco Tipo 1" -> "arroz-branco-tipo-1". Usado quando a IA não está disponível.
export function chaveDoProduto(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
