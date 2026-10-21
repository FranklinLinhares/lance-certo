import Link from "next/link";
import { exigirEmpresa } from "@/lib/sessao";
import { dataHora, porUnidade, type Unidade } from "@/lib/dominio";
import { Avaliar } from "@/components/Avaliar";
import { LinkWhatsApp } from "@/components/LinkWhatsApp";

type Negocio = {
  id: string;
  produto: string;
  unidade: Unidade;
  quantidade: number;
  preco_unitario: number;
  origem: "leilao" | "vitrine";
  criado_em: string;
  comprador: { id: string; nome: string; telefone: string } | null;
  fornecedor: { id: string; nome: string; telefone: string } | null;
};

// Compras e vendas feitas no app, com a avaliação da outra parte.
export default async function Negocios() {
  const { supabase, empresa } = await exigirEmpresa();

  const { data } = await supabase
    .from("compras")
    .select(
      "id, produto, unidade, quantidade, preco_unitario, origem, criado_em, comprador:empresas!compras_comprador_id_fkey(id, nome, telefone), fornecedor:empresas!compras_fornecedor_id_fkey(id, nome, telefone)",
    )
    .not("fornecedor_id", "is", null)
    .or(`comprador_id.eq.${empresa.id},fornecedor_id.eq.${empresa.id}`)
    .order("criado_em", { ascending: false })
    .limit(50);
  const negocios = (data ?? []) as unknown as Negocio[];

  const { data: minhas } = await supabase.from("avaliacoes").select("compra_id, nota").eq("avaliador_id", empresa.id);
  const notaDada = new Map((minhas ?? []).map((a) => [a.compra_id as string, a.nota as number]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meus negócios</h1>
      <p className="text-stone-600">Avalie quem comprou ou vendeu com você. As notas aparecem no perfil de cada um.</p>
      {negocios.length === 0 && <p className="cartao text-stone-600">Você ainda não fechou negócios pelo app.</p>}
      <ul className="space-y-3">
        {negocios.map((n) => {
          const vendi = n.fornecedor?.id === empresa.id;
          const outro = vendi ? n.comprador : n.fornecedor;
          const nota = notaDada.get(n.id);
          return (
            <li key={n.id} className="cartao space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${vendi ? "bg-sky-100 text-sky-900" : "bg-green-100 text-green-900"}`}>
                    {vendi ? "Venda" : "Compra"}
                  </span>
                  <span className="font-semibold">{n.produto}</span>
                  <div className="text-sm text-stone-500">
                    {n.quantidade} {n.unidade} a {porUnidade(n.preco_unitario, n.unidade)} · {n.origem === "leilao" ? "leilão" : "vitrine"} · {dataHora(n.criado_em)}
                  </div>
                </div>
                {outro && (
                  <div className="text-right text-sm">
                    <Link href={`/perfil/${outro.id}`} className="font-medium text-green-800 underline">{outro.nome}</Link>
                    <div><LinkWhatsApp telefone={outro.telefone} className="text-stone-500 underline" /></div>
                  </div>
                )}
              </div>
              {outro &&
                (nota ? (
                  <p className="text-sm text-stone-600">
                    Você avaliou com <span className="text-amber-700">{"★".repeat(nota)}</span>.
                  </p>
                ) : (
                  <Avaliar compra={n.id} nome={outro.nome} />
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
