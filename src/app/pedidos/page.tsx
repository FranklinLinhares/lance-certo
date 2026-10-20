import Link from "next/link";
import { exigirEmpresa } from "@/lib/sessao";
import { CATEGORIAS, dataHora, porUnidade, type Categoria, type Unidade } from "@/lib/dominio";

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
};

const STATUS: Record<string, string> = { aberto: "Aberto", encerrado: "Encerrado", fechado: "Fechado", cancelado: "Cancelado" };

export default async function Pedidos() {
  const { supabase, empresa } = await exigirEmpresa();
  const vendendo = empresa.papel === "fornecedor";

  // Os leilões que a conta criou aparecem sempre, mesmo no modo Vender, para poder escolher o vencedor.
  const { data: meus } = await supabase
    .from("pedidos")
    .select("id, produto, categoria, unidade, quantidade, encerra_em, status, lances_visiveis, lances(count)")
    .eq("comprador_id", empresa.id)
    .order("criado_em", { ascending: false });
  const meusLeiloes = (meus ?? []).map((p) => ({ ...p, total_lances: (p.lances as { count: number }[])[0]?.count ?? 0 })) as Linha[];

  // Leilões de outros compradores só no modo Vender, que é quando a conta pode dar lance.
  const { data: proximos } = vendendo ? await supabase.rpc("pedidos_proximos") : { data: [] };
  const paraLance = (proximos ?? []) as Linha[];

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
            <ListaLeiloes pedidos={paraLance} vendendo />
          </>
        ) : (
          <>
            <p className="text-sm text-stone-500">Crie um leilão e os fornecedores próximos disputam pelo menor preço. Para dar lances em leilões de outras pessoas, mude para Vender no menu.</p>
            {meusLeiloes.length === 0 && <p className="text-stone-600">Você ainda não criou leilões.</p>}
            <ListaLeiloes pedidos={meusLeiloes} vendendo={false} />
          </>
        )}
      </section>

      {vendendo && meusLeiloes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Seus leilões de compra</h2>
          <ListaLeiloes pedidos={meusLeiloes} vendendo={false} />
        </section>
      )}
    </div>
  );
}

function ListaLeiloes({ pedidos, vendendo }: { pedidos: Linha[]; vendendo: boolean }) {
  return (
    <ul className="space-y-3">
      {pedidos.map((p) => {
        const encerrado = new Date(p.encerra_em) <= new Date();
        return (
          <li key={p.id}>
            <Link href={`/pedidos/${p.id}`} className="cartao block hover:border-green-700">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.produto} · {p.quantidade} {p.unidade}</div>
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
          </li>
        );
      })}
    </ul>
  );
}
