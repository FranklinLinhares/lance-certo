import { porUnidade, type ReferenciaPreco as Referencia } from "@/lib/dominio";

// Faixa de preço encontrada pela IA, com as fontes.
export function ReferenciaPreco({ referencia }: { referencia: Referencia }) {
  const u = referencia.unidade;
  return (
    <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><div className="text-stone-500">Mínimo</div><div className="font-semibold">{porUnidade(referencia.minimo, u)}</div></div>
        <div><div className="text-stone-500">Médio</div><div className="font-semibold">{porUnidade(referencia.medio, u)}</div></div>
        <div><div className="text-stone-500">Máximo</div><div className="font-semibold">{porUnidade(referencia.maximo, u)}</div></div>
      </div>
      <p>{referencia.resumo}</p>
      {referencia.fontes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5">
          {referencia.fontes.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noreferrer" className="text-green-800 underline">{f.titulo}</a>
              {f.preco != null && <> · {porUnidade(f.preco, u)}</>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-stone-500">
        Confira também os preços de varejo no{" "}
        <a href="https://precodahora.pb.gov.br/" target="_blank" rel="noreferrer" className="underline">Preço da Hora (PB)</a>.
      </p>
    </div>
  );
}
