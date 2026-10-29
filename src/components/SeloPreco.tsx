import { compararComMedia, type MediaMercado } from "@/lib/escudo";
import { porUnidade, type Unidade } from "@/lib/dominio";

const CORES = {
  abaixo: "bg-green-100 text-green-900",
  media: "bg-stone-100 text-stone-700",
  acima: "bg-red-100 text-red-900",
};

// Selo do escudo de preço: mostra se o preço está acima ou abaixo da média de mercado.
export function SeloPreco({ preco, mercado, unidade }: { preco: number; mercado: MediaMercado | null; unidade: Unidade }) {
  const selo = mercado && compararComMedia(Number(preco), mercado.media);
  if (!mercado || !selo) return null;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CORES[selo.tom]}`}
      title={`Média: ${porUnidade(mercado.media, unidade)} (${mercado.fonte})`}
    >
      {selo.texto}
    </span>
  );
}
