import Link from "next/link";

export default function Inicio() {
  return (
    <div className="space-y-8 py-6">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Compre alimentos pelo menor preço da sua região.
        </h1>
        <p className="max-w-2xl text-lg text-stone-600">
          Restaurantes, mercados e cozinhas publicam o que precisam e fornecedores disputam o pedido.
          Fornecedores e agricultores anunciam o que têm, e você compara preços lado a lado.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/entrar" className="botao">Começar</Link>
          <Link href="/vitrine" className="botao-secundario">Ver a vitrine</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="cartao">
          <h2 className="font-semibold">Leilão de menor preço</h2>
          <p className="mt-1 text-sm text-stone-600">
            Publique o pedido e receba lances. Você decide se os fornecedores veem os preços uns dos outros.
          </p>
        </div>
        <div className="cartao">
          <h2 className="font-semibold">Vitrine com comparação</h2>
          <p className="mt-1 text-sm text-stone-600">
            Veja quantos fornecedores oferecem o produto perto de você e o menor, o médio e o maior preço.
          </p>
        </div>
        <div className="cartao">
          <h2 className="font-semibold">Pesquisa de preço por IA</h2>
          <p className="mt-1 text-sm text-stone-600">
            A IA busca cotações de CEASA, CONAB e atacadistas e mostra quanto você pagou semana a semana.
          </p>
        </div>
      </section>
    </div>
  );
}
