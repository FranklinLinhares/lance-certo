"use client";

import Link from "next/link";

// Quando algo dá errado numa tela ou num botão, mostra um aviso em português no lugar da página de erro.
export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <div aria-hidden className="text-5xl">😕</div>
      <h1 className="text-2xl font-bold">Algo não deu certo</h1>
      <p className="text-stone-600">
        Não foi possível concluir o que você pediu. Pode ter sido a internet ou o item mudou enquanto você usava a tela.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="botao">Tentar de novo</button>
        <Link href="/vitrine" className="botao-secundario">Ir para a Vitrine</Link>
      </div>
    </div>
  );
}
