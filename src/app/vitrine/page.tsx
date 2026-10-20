import Link from "next/link";
import { exigirEmpresa } from "@/lib/sessao";
import { CATEGORIAS, PUBLICO, porUnidade, type Categoria, type Publico, type Unidade } from "@/lib/dominio";
import { SeloPreco } from "@/components/SeloPreco";
import { mediaDasOfertas } from "@/lib/escudo";
import { Estrelas } from "@/components/Estrelas";
import { buscarReputacao } from "@/lib/reputacao";
import { Comprar } from "./Comprar";

type Oferta = {
  id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  agricultor: boolean;
  fornecedor_pj: boolean;
  vende_para: Publico;
  cidade: string;
  distancia_km: number;
  produto: string;
  produto_chave: string;
  categoria: Categoria;
  unidade: Unidade;
  preco_unitario: number;
  quantidade_disponivel: number;
  validade: string | null;
  disponivel_a_partir: string | null;
  descricao: string | null;
};

export default async function Vitrine({ searchParams }: PageProps<"/vitrine">) {
  const { q, de } = await searchParams;
  const termo = typeof q === "string" ? q.trim() : "";
  // Filtro do comprador: ofertas de empresas (CNPJ), de pessoas físicas (CPF) ou de todos.
  const origem = de === "pj" || de === "pf" ? de : "todos";
  const { supabase, empresa } = await exigirEmpresa();

  const { data } = await supabase.rpc("vitrine_ofertas", { termo: termo || null });
  // As próprias ofertas ficam em Minhas ofertas; a vitrine mostra só as de outras pessoas.
  const ofertas = ((data ?? []) as Oferta[]).filter(
    (o) => o.fornecedor_id !== empresa.id && (origem === "todos" || o.fornecedor_pj === (origem === "pj")),
  );
  const { data: telefones } = await supabase
    .from("empresas")
    .select("id, telefone")
    .in("id", [...new Set(ofertas.map((o) => o.fornecedor_id))]);
  const reputacao = await buscarReputacao(supabase, ofertas.map((o) => o.fornecedor_id));
  const telefoneDe = Object.fromEntries((telefones ?? []).map((t) => [t.id, t.telefone as string]));

  // Agrupa as ofertas do mesmo produto e unidade para comparar preços.
  const grupos = new Map<string, Oferta[]>();
  for (const o of ofertas) {
    const chave = `${o.produto_chave}|${o.unidade}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), o]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Vitrine</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/pesquisa${termo ? `?produto=${encodeURIComponent(termo)}` : ""}`} className="botao-secundario">Pesquisar em supermercados</Link>
          {empresa.papel === "fornecedor" && <Link href="/ofertas/nova" className="botao">Anunciar produto</Link>}
        </div>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={termo} placeholder="Buscar produto: tomate, arroz, frango..." className="campo min-w-48 flex-1" />
        <select name="de" defaultValue={origem} aria-label="Ver ofertas de" className="campo w-auto">
          <option value="todos">Todos</option>
          <option value="pj">Empresas (CNPJ)</option>
          <option value="pf">Pessoas físicas (CPF)</option>
        </select>
        <button className="botao">Buscar</button>
      </form>
      {empresa.papel === "fornecedor" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Você está no modo <strong>Vender</strong>: aqui aparecem as ofertas dos concorrentes perto de você. As suas ficam em{" "}
          <Link href="/ofertas" className="underline">Minhas ofertas</Link>. Para comprar, troque para <strong>Comprar</strong> no menu.
        </p>
      ) : (
        <p className="text-sm text-stone-500">
          Ofertas de outros vendedores que entregam até você, dentro do seu raio de {empresa.raio_km} km.
        </p>
      )}

      {grupos.size === 0 && (
        <div className="cartao space-y-2">
          <p>Nenhuma oferta encontrada{termo ? ` para “${termo}”` : ""} perto de você.</p>
          {empresa.papel === "comprador" && (
            <Link href={`/pedidos/novo${termo ? `?produto=${encodeURIComponent(termo)}` : ""}`} className="botao-secundario">
              Criar um leilão para este produto
            </Link>
          )}
        </div>
      )}

      {[...grupos.values()].map((lista) => {
        const precos = lista.map((o) => Number(o.preco_unitario));
        const u = lista[0].unidade;
        const media = precos.reduce((a, b) => a + b, 0) / precos.length;
        const mercado = mediaDasOfertas(precos);
        return (
          <section key={`${lista[0].produto_chave}|${u}`} className="cartao space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{lista[0].produto}</h2>
              <span className="text-sm text-stone-500">{CATEGORIAS[lista[0].categoria]}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-stone-100 p-2"><div className="text-stone-500">Fornecedores</div><div className="text-lg font-bold">{new Set(lista.map((o) => o.fornecedor_id)).size}</div></div>
              <div className="rounded-lg bg-green-50 p-2"><div className="text-stone-500">Menor</div><div className="font-bold text-green-800">{porUnidade(Math.min(...precos), u)}</div></div>
              <div className="rounded-lg bg-stone-100 p-2"><div className="text-stone-500">Médio</div><div className="font-bold">{porUnidade(media, u)}</div></div>
              <div className="rounded-lg bg-stone-100 p-2"><div className="text-stone-500">Maior</div><div className="font-bold">{porUnidade(Math.max(...precos), u)}</div></div>
            </div>
            <ul className="divide-y divide-stone-100">
              {lista.map((o) => (
                <li key={o.id} className="space-y-1 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <Link href={`/perfil/${o.fornecedor_id}`} className="font-medium hover:underline">{o.fornecedor_nome}</Link>
                      <span className="ml-2"><Estrelas nota={reputacao.get(o.fornecedor_id)?.nota_vendedor} total={reputacao.get(o.fornecedor_id)?.avaliacoes_vendedor} /></span>
                      <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{o.fornecedor_pj ? "Empresa" : "Pessoa física"}</span>
                      {o.vende_para !== "todos" && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-900">{PUBLICO[o.vende_para]}</span>}
                      {o.agricultor && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Agricultura familiar</span>}
                      <div className="text-sm text-stone-500">
                        {o.cidade} · {o.distancia_km} km · {o.quantidade_disponivel} {u} disponíveis
                        {o.validade && <> · validade {new Date(o.validade).toLocaleDateString("pt-BR")}</>}
                        {o.disponivel_a_partir && <> · a partir de {new Date(o.disponivel_a_partir).toLocaleDateString("pt-BR")}</>}
                      </div>
                      {o.descricao && <div className="text-sm">{o.descricao}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-800">{porUnidade(o.preco_unitario, u)}</div>
                      <SeloPreco preco={o.preco_unitario} mercado={mercado} unidade={u} />
                    </div>
                  </div>
                  {empresa.papel === "comprador" && (
                    <Comprar oferta={o.id} maximo={Number(o.quantidade_disponivel)} unidade={u} telefone={telefoneDe[o.fornecedor_id] ?? ""} fornecedor={o.fornecedor_nome} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
