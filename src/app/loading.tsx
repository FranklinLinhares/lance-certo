// Enquanto a página carrega: blocos cinza piscando no lugar do conteúdo.
export default function Carregando() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto h-8 w-56" />
      <div className="esqueleto h-4 w-80 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="cartao space-y-3">
            <div className="esqueleto h-5 w-2/3" />
            <div className="esqueleto h-4 w-1/2" />
            <div className="esqueleto h-9 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
