import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { criarClienteServidor } from "@/lib/supabase/server";
import { sair } from "@/app/entrar/acoes";
import { trocarModo } from "@/app/cadastro/modo";

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
        <header className="border-b border-stone-200 bg-white">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-green-800">
              Lance Certo
            </Link>
            <Suspense>
              <Menu />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          <Suspense fallback={<p className="text-stone-500">Carregando...</p>}>{children}</Suspense>
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
    ? await supabase.from("empresas").select("papel, nome").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <>
      {empresa && (
        <>
          <Link href="/vitrine" className="hover:text-green-800">Vitrine</Link>
          <Link href="/pedidos" className="hover:text-green-800">Leilões</Link>
          {empresa.papel === "comprador" && (
            <Link href="/historico" className="hover:text-green-800">Meus preços</Link>
          )}
          <Link href="/ofertas" className="hover:text-green-800">Minhas ofertas</Link>
          <Link href="/negocios" className="hover:text-green-800">Negócios</Link>
          <Link href="/contatos" className="hover:text-green-800">Contatos</Link>
        </>
      )}
      <div className="ml-auto flex items-center gap-3 text-sm">
        {empresa && (
          <form action={trocarModo} className="flex overflow-hidden rounded-full border border-stone-300">
            {(["comprador", "fornecedor"] as const).map((p) => (
              <button
                key={p}
                name="papel"
                value={p}
                aria-pressed={empresa.papel === p}
                className={`px-3 py-1 ${empresa.papel === p ? "bg-green-700 font-semibold text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {p === "comprador" ? "Comprar" : "Vender"}
              </button>
            ))}
          </form>
        )}
        {empresa && <Link href="/cadastro" className="max-w-[9rem] truncate text-stone-500 hover:text-green-800 sm:max-w-none">{empresa.nome}</Link>}
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
