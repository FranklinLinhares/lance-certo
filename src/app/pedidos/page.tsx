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
  const comprador = empresa.papel === "comprador";

  let pedidos: Linha[];
  if (comprador) {
    const { data } = await supabase
      .from("pedidos")
      .select("id, produto, categoria, unidade, quantidade, encerra_em, status, lances_visiveis, lances(count)")
      .eq("comprador_id", empresa.id)
      .order("criado_em", { ascending: false });
    pedidos = (data ?? []).map((p) => ({ ...p, total_lances: (p.lances as { count: number }[])[0]?.count ?? 0 })) as Linha[];
  } else {
    const { data } = await supabase.rpc("pedidos_proximos");
    pedidos = (data ?? []) as Linha[];
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{comprador ? "Meus leilões" : "Leilões perto de você"}</h1>
        {comprador && <Link href="/pedidos/novo" className="botao">Novo leilão</Link>}
      </div>
      {!comprador && (
        <p className="text-sm text-stone-500">Pedidos abertos de compradores dentro do seu raio de entrega de {empresa.raio_km} km.</p>
      )}
      {pedidos.length === 0 && <p className="text-stone-600">Nenhum leilão por aqui ainda.</p>}
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
                    <div>{p.status && p.status !== "aberto" ? STATUS[p.status] : encerrado ? "Prazo encerrado" : `Encerra ${dataHora(p.encerra_em)}`}</div>
                    {p.menor_lance != null && <div className="font-semibold text-green-800">Menor: {porUnidade(p.menor_lance, p.unidade)}</div>}
                    {!comprador && !p.lances_visiveis && <div className="text-stone-500">Lances fechados</div>}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
