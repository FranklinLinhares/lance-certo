import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { criarClienteServidor } from "@/lib/supabase/server";
import { sair } from "@/app/entrar/acoes";
import { trocarModo } from "@/app/cadastro/modo";
import { Navegacao, type ItemMenu } from "@/components/Navegacao";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lance Certo",
  description: "Compra e venda de alimentos com leilão de menor preço e pesquisa de preços por IA.",
};

export const viewport: Viewport = { themeColor: "#15803d" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/95 shadow-sm shadow-stone-200/40">
          <nav className="mx-auto flex max-w-5xl items-center gap-x-4 gap-y-2 px-4 py-2.5">
            <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold text-green-800">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-green-500 to-green-800 text-base text-white shadow-sm">
                ⚖
              </span>
              <span className="hidden min-[400px]:inline">Lance Certo</span>
            </Link>
            <Suspense>
              <Menu />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 lg:pb-10">
          <Suspense>{children}</Suspense>
        </main>
      </body>
    </html>
  );
}

// Links conforme o modo (comprar ou vender) de quem está logado.
async function Menu() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: empresa } = user
    ? await supabase.from("empresas").select("id, papel, nome").eq("id", user.id).maybeSingle()
    : { data: null };
  // Pedidos da vitrine esperando a resposta desta conta como vendedora.
  const { count: aResponder } = empresa
    ? await supabase.from("reservas").select("id", { count: "exact", head: true }).eq("fornecedor_id", empresa.id).eq("situacao", "aguardando")
    : { count: 0 };
  const { count: naoLidos } = empresa
    ? await supabase.from("avisos").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id).eq("lido", false)
    : { count: 0 };

  const itens: ItemMenu[] = empresa
    ? [
        { href: "/vitrine", rotulo: "Vitrine", curto: "Vitrine", icone: "🛒" },
        { href: "/pedidos", rotulo: "Leilões", curto: "Leilões", icone: "🔨" },
        ...(empresa.papel === "comprador" ? [{ href: "/historico", rotulo: "Meus preços", curto: "Preços", icone: "📈" }] : []),
        ...(empresa.papel === "fornecedor" ? [{ href: "/ofertas", rotulo: "Minhas ofertas", curto: "Ofertas", icone: "🏷️" }] : []),
        { href: "/negocios", rotulo: "Negócios", curto: "Negócios", icone: "🤝", contador: aResponder ?? 0 },
        { href: "/contatos", rotulo: "Contatos", curto: "Contatos", icone: "👥" },
      ]
    : [];

  return (
    <>
      {empresa && <Navegacao itens={itens} />}
      <div className="ml-auto flex items-center gap-3 text-sm">
        {empresa && (
          <form action={trocarModo} className="flex overflow-hidden rounded-full border border-stone-300">
            {(["comprador", "fornecedor"] as const).map((p) => (
              <button
                key={p}
                name="papel"
                value={p}
                aria-pressed={empresa.papel === p}
                className={`px-3 py-1 transition ${empresa.papel === p ? "bg-green-700 font-semibold text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {p === "comprador" ? "Comprar" : "Vender"}
              </button>
            ))}
          </form>
        )}
        {empresa && (
          <Link href="/avisos" title="Avisos" aria-label={`Avisos${naoLidos ? `: ${naoLidos} novos` : ""}`} className="relative grid h-9 w-9 place-items-center rounded-full text-lg leading-none text-stone-600 transition hover:bg-green-50 hover:text-green-800">
            🔔
            {!!naoLidos && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 animate-bounce rounded-full bg-amber-500 px-1 text-center text-[10px] leading-4 font-bold text-white ring-2 ring-white [animation-iteration-count:2]">{naoLidos > 9 ? "9+" : naoLidos}</span>
            )}
          </Link>
        )}
        {empresa && (
          <Link href={`/perfil/${empresa.id}`} title="Ver meu perfil e avaliações" className="flex items-center gap-2 text-stone-600 hover:text-green-800">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 font-bold text-amber-900 ring-1 ring-amber-200">
              {empresa.nome.trim().charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[10rem] truncate lg:inline">{empresa.nome}</span>
          </Link>
        )}
        {user ? (
          <form action={sair}>
            <button className="text-stone-600 hover:text-red-700">Sair</button>
          </form>
        ) : (
          <Link href="/entrar" className="botao py-1.5">Entrar</Link>
        )}
      </div>
    </>
  );
}
