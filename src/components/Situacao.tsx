import type { ReactNode } from "react";

const TONS = {
  pedido: { cor: "border-amber-500 bg-amber-100 text-amber-950", icone: "⏳" },
  aceito: { cor: "border-green-600 bg-green-100 text-green-950", icone: "✅" },
  recusado: { cor: "border-red-500 bg-red-50 text-red-900", icone: "✖" },
  cancelado: { cor: "border-stone-400 bg-stone-100 text-stone-700", icone: "↩" },
};

export type TomSituacao = keyof typeof TONS;

// Faixa grande e colorida para a situação de um pedido: dá para ver de longe na lista.
export function Situacao({ tom, children }: { tom: TomSituacao; children: ReactNode }) {
  const { cor, icone } = TONS[tom];
  return (
    <div className={`flex items-start gap-2 rounded-lg border-l-8 px-3 py-2 text-base font-semibold ${cor}`}>
      <span aria-hidden>{icone}</span>
      <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">{children}</div>
    </div>
  );
}

// Borda do cartão inteiro, para combinar com a faixa.
export const BORDA_CARTAO: Record<TomSituacao, string> = {
  pedido: "border-2 border-amber-500",
  aceito: "border-2 border-green-600",
  recusado: "",
  cancelado: "",
};
