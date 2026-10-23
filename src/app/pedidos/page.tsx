import Link from "next/link";
import { exigirEmpresa } from "@/lib/sessao";
import { CATEGORIAS, dataHora, porUnidade, type Categoria, type Unidade } from "@/lib/dominio";
import { BarraSelecao, Marcar } from "@/components/Selecao";
import { BORDA_CARTAO, Situacao, type TomSituacao } from "@/components/Situacao";
import { buscarOcultos } from "@/lib/ocultos";
import { excluirLeiloes } from "./acoes";

type Linha = {
  id: string;
  produto: string;
  categoria: Categoria;
  unidade: Unidade;
  quantidade: number;
  encerra_em: string;
  status?: string;
  comprador_nome?: string;
  cidade?: string;
  distancia_km?: number;
  menor_lance?: number | null;
  total_lances?: number;
  lances_visiveis: boolean;
  lance_vencedor_id?: string | null;
};

type LanceResumo = {
  id: string;
  pedido_id: string;
  fornecedor_id: string;
  preco_unitario: number;
  criado_em: string;
  fornecedor: { nome: string } | null;
};

const STATUS: Record<string, string> = { aberto: "Aberto", encerrado: "Encerrado", fechado: "Fechado", cancelado: "Cancelado" };

export default async function Pedidos() {
  const { supabase, empresa } = await exigirEmpresa();
  const vendendo = empresa.papel === "fornecedor";

  // Modo Vender: só leilões de outros compradores, para dar lance.
  // Modo Comprar: só os leilões que a conta criou.
  let paraLance: Linha[] = [];
  let meusLeiloes: Linha[] = [];
  if (vendendo) {
    const { data: proximos } = await supabase.rpc("pedidos_proximos");
    paraLance = (proximos ?? []) as Linha[];
  } else {
    const { data: meus, error: erroMeus } = await supabase
      .from("pedidos")
      .select("id, produto, categoria, unidade, quantidade, encerra_em, status, lances_visiveis, lance_vencedor_id, lances!lances_pedido_id_fkey(count)")
      .eq("comprador_id", empresa.id)
      .order("criado_em", { ascending: false });
    if (erroMeus) throw new Error(erroMeus.message);
    meusLeiloes = (meus ?? []).map((p) => ({ ...p, total_lances: (p.lances as { count: number }[])[0]?.count ?? 0 })) as Linha[];
  }

  const ocultos = await buscarOcultos(supabase, "pedido");
  paraLance = paraLance.filter((p) => !ocultos.has(p.id));
  meusLeiloes = meusLeiloes.filter((p) => !ocultos.has(p.id));

  // Lances de cada leilão da lista, do menor para o maior, para mostrar dentro da caixa.
  // A política de segurança só devolve os que a conta pode ver.
  const ids = [...paraLance, ...meusLeiloes].map((p) => p.id);
  const { data: dadosLances } = ids.length
    ? await supabase
        .from("lances")
        .select("id, pedido_id, fornecedor_id, preco_unitario, criado_em, fornecedor:empresas!lances_fornecedor_id_fkey(nome)")
        .in("pedido_id", ids)
        .order("preco_unitario")
        .order("criado_em")
        .returns<LanceResumo[]>()
    : { data: [] as LanceResumo[] };
  const lances = new Map<string, LanceResumo[]>();
  for (const l of dadosLances ?? []) lances.set(l.pedido_id, [...(lances.get(l.pedido_id) ?? []), l]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{vendendo ? "Leilões perto de você" : "Meus leilões"}</h1>
          {vendendo ? null : <Link href="/pedidos/novo" className="botao">Novo leilão</Link>}
        </div>
        {vendendo ? (
          <>
            <p className="text-sm text-stone-500">Pedidos abertos de compradores dentro do seu raio de entrega de {empresa.raio_km} km. Toque em um para dar lance.</p>
            {paraLance.length === 0 && <p className="text-stone-600">Nenhum leilão aberto perto de você agora.</p>}
            <BarraSelecao id="excluir-leiloes" acao={excluirLeiloes} confirmar="Tirar {n} leilão(ões) da sua lista? Eles somem só para você." />
            <ListaLeiloes pedidos={paraLance} vendendo lances={lances} eu={empresa.id} />
          </>
        ) : (
          <>
            <p className="text-sm text-stone-500">Crie um leilão e os fornecedores próximos disputam pelo menor preço. Para dar lances em leilões de outras pessoas, mude para Vender no menu.</p>
            {meusLeiloes.length === 0 && <p className="text-stone-600">Você ainda não criou leilões.</p>}
            <BarraSelecao id="excluir-leiloes" acao={excluirLeiloes} confirmar="Excluir {n} leilão(ões)? Os que ainda estão abertos são cancelados e os fornecedores não podem mais dar lance." />
            <ListaLeiloes pedidos={meusLeiloes} vendendo={false} lances={lances} eu={empresa.id} />
          </>
        )}
      </section>

      {vendendo && (
        <p className="text-sm text-stone-500">Seus próprios leilões ficam em Comprar, no menu.</p>
      )}
    </div>
  );
}

// Situação do leilão em destaque: lance novo, hora de escolher, negócio fechado.
function situacao(p: Linha, lista: LanceResumo[], vendendo: boolean, eu: string): { tom: TomSituacao; texto: string } | null {
  const encerrado = p.status !== "aberto" || new Date(p.encerra_em) <= new Date();
  const total = Math.max(lista.length, Number(p.total_lances ?? 0));
  const menor = lista[0]?.preco_unitario ?? p.menor_lance ?? null;
  if (!vendendo) {
    if (p.status === "fechado") {
      const vencedor = lista.find((l) => l.id === p.lance_vencedor_id);
      return { tom: "aceito", texto: `Negócio fechado${vencedor?.fornecedor ? ` com ${vencedor.fornecedor.nome}` : ""}` };
    }
    if (p.status === "cancelado" || total === 0) return null;
    if (encerrado) return { tom: "pedido", texto: `Prazo encerrado com ${total} lance${total > 1 ? "s" : ""}: escolha o vencedor` };
    return { tom: "lance", texto: `${total} lance${total > 1 ? "s" : ""} recebido${total > 1 ? "s" : ""}${menor != null ? `, menor ${porUnidade(menor, p.unidade)}` : ""}` };
  }
  const meu = lista.find((l) => l.fornecedor_id === eu);
  if (!meu) return null;
  if (menor != null && Number(menor) < Number(meu.preco_unitario)) {
    return { tom: "pedido", texto: `Tem lance menor que o seu: ${porUnidade(menor, p.unidade)}` };
  }
  return { tom: "lance", texto: `Seu lance: ${porUnidade(meu.preco_unitario, p.unidade)}${p.lances_visiveis ? " (o menor até agora)" : ""}` };
}

function ListaLeiloes({ pedidos, vendendo, lances, eu }: { pedidos: Linha[]; vendendo: boolean; lances: Map<string, LanceResumo[]>; eu: string }) {
  return (
    <ul className="space-y-3">
      {pedidos.map((p) => {
        const encerrado = new Date(p.encerra_em) <= new Date();
        const lista = lances.get(p.id) ?? [];
        const destaque = situacao(p, lista, vendendo, eu);
        return (
          <li key={p.id} className="flex items-start gap-3">
            <span className="pt-4"><Marcar form="excluir-leiloes" valor={p.id} nome={p.produto} /></span>
            <div className={`cartao flex-1 space-y-3 ${destaque ? BORDA_CARTAO[destaque.tom] : ""}`}>
              {destaque && (
                <Situacao tom={destaque.tom}>
                  {destaque.texto}
                  <Link href={`/pedidos/${p.id}`} className="botao ml-auto py-1 text-sm">{vendendo ? "Dar lance" : "Ver lances"}</Link>
                </Situacao>
              )}
              <Link href={`/pedidos/${p.id}`} className="block hover:text-green-800">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold">{p.produto} · {p.quantidade} {p.unidade}</div>
                    <div className="text-sm text-stone-500">
                      {CATEGORIAS[p.categoria]}
                      {p.comprador_nome && <> · {p.comprador_nome}, {p.cidade} ({p.distancia_km} km)</>}
                      {" · "}{p.total_lances ?? 0} lance(s)
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{p.status && p.status !== "aberto" ? STATUS[p.status] : encerrado ? (p.total_lances ? "Prazo encerrado: escolha o vencedor" : "Prazo encerrado, sem lances") : `Encerra ${dataHora(p.encerra_em)}`}</div>
                    {p.menor_lance != null && <div className="font-semibold text-green-800">Menor: {porUnidade(p.menor_lance, p.unidade)}</div>}
                    {vendendo && !p.lances_visiveis && <div className="text-stone-500">Lances fechados</div>}
                  </div>
                </div>
              </Link>
              {lista.length > 0 && (
                <ol className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-sm">
                  {lista.slice(0, 5).map((l, n) => (
                    <li key={l.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${l.fornecedor_id === eu ? "bg-sky-50 font-medium" : ""}`}>
                      <span>
                        <span className="mr-2 text-stone-400">{n + 1}º</span>
                        {l.fornecedor_id === eu ? "Você" : l.fornecedor?.nome ?? "Fornecedor"}
                        <span className="ml-2 text-xs text-stone-500">{dataHora(l.criado_em)}</span>
                      </span>
                      <span className={`font-semibold ${n === 0 ? "text-green-800" : ""}`}>{porUnidade(l.preco_unitario, p.unidade)}</span>
                    </li>
                  ))}
                  {lista.length > 5 && (
                    <li className="px-3 py-2 text-stone-500">
                      <Link href={`/pedidos/${p.id}`} className="underline">Ver os {lista.length} lances</Link>
                    </li>
                  )}
                </ol>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
