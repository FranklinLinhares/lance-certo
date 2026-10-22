import { concluirNegocio } from "@/app/negocios/acoes";
import { Avaliar } from "./Avaliar";

export type EstadoConclusao = {
  id: string;
  concluido_comprador_em: string | null;
  concluido_fornecedor_em: string | null;
};

// A avaliação só abre quando comprador e vendedor confirmam que o negócio foi concluído.
export function ConclusaoNegocio({
  compra,
  souComprador,
  nomeOutro,
  notaDada,
}: {
  compra: EstadoConclusao;
  souComprador: boolean;
  nomeOutro: string;
  notaDada?: number;
}) {
  const euConclui = Boolean(souComprador ? compra.concluido_comprador_em : compra.concluido_fornecedor_em);
  const outroConcluiu = Boolean(souComprador ? compra.concluido_fornecedor_em : compra.concluido_comprador_em);

  if (!euConclui) {
    return (
      <form action={concluirNegocio} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="compra" value={compra.id} />
        <button className="botao-secundario py-1.5 text-sm">
          {souComprador ? "Recebi o produto: concluir negócio" : "Entreguei e recebi o pagamento: concluir negócio"}
        </button>
        <span className="text-xs text-stone-500">A avaliação abre quando vocês dois confirmarem.</span>
      </form>
    );
  }
  if (!outroConcluiu) {
    return <p className="text-sm text-stone-600">Você confirmou. Falta {nomeOutro} confirmar para a avaliação abrir.</p>;
  }
  if (notaDada) {
    return (
      <p className="text-sm text-stone-600">
        Negócio concluído. Você avaliou com <span className="text-amber-700">{"★".repeat(notaDada)}</span>.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Negócio concluído. Avalie {nomeOutro}</p>
      <Avaliar compra={compra.id} nome={nomeOutro} />
    </div>
  );
}
