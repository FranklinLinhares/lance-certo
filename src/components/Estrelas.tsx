// Nota média com estrela, como no BlaBlaCar e no Mercado Livre.
export function Estrelas({ nota, total }: { nota: number | null | undefined; total: number | null | undefined }) {
  if (!total || nota == null) return <span className="text-xs text-stone-500">Sem avaliações</span>;
  return (
    <span className="text-sm text-amber-700" title={`${total} avaliações`}>
      ★ {Number(nota).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
      <span className="text-xs text-stone-500">({total})</span>
    </span>
  );
}
