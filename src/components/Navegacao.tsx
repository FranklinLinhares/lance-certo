"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemMenu = { href: string; rotulo: string; curto: string; icone: string; contador?: number };

function ativo(caminho: string, href: string) {
  return caminho === href || caminho.startsWith(`${href}/`);
}

function Contador({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] leading-4 font-bold text-white shadow ring-2 ring-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}

// Menu do topo no computador e barra fixa embaixo no celular, com a tela atual destacada.
export function Navegacao({ itens }: { itens: ItemMenu[] }) {
  const caminho = usePathname();
  return (
    <>
      <div className="hidden items-center gap-1 lg:flex">
        {itens.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={ativo(caminho, i.href) ? "page" : undefined}
            className="relative rounded-full px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-green-50 hover:text-green-800 aria-[current=page]:bg-green-700 aria-[current=page]:text-white aria-[current=page]:shadow-sm"
          >
            <span className={`relative ${i.contador ? "pr-2" : ""}`}>
              {i.rotulo}
              <Contador n={i.contador} />
            </span>
          </Link>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around">
          {itens.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={ativo(caminho, i.href) ? "page" : undefined}
              className="group flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-stone-500 transition aria-[current=page]:text-green-800"
            >
              <span className="relative grid h-7 w-11 place-items-center rounded-full text-lg transition group-active:scale-90 group-aria-[current=page]:bg-green-100">
                <span aria-hidden>{i.icone}</span>
                <Contador n={i.contador} />
              </span>
              <span className="truncate">{i.curto}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
