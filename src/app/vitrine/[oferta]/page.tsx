import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirEmpresa } from "@/lib/sessao";
import { porUnidade, reais, type Unidade } from "@/lib/dominio";
import { CartaoParte } from "@/components/CartaoParte";
import { Comprar } from "../Comprar";

type Oferta = {
  id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  produto: string;
  unidade: Unidade;
  preco_unitario: number;
  quantidade_disponivel: number;
  validade: string | null;
  descricao: string | null;
  so_na_loja: boolean;
};

// Confirmação da compra: mostra quem vende antes de fechar o negócio.
export default async function ConfirmarCompra({ params, searchParams }: PageProps<"/vitrine/[oferta]">) {
  const { oferta: id } = await params;
  const { quantidade } = await searchParams;
  const { supabase, empresa } = await exigirEmpresa();

  // A vitrine já filtra o que esta conta pode ver e comprar.
  const { data } = await supabase.rpc("vitrine_ofertas", { termo: null });
  const oferta = ((data ?? []) as Oferta[]).find((o) => o.id === id && o.fornecedor_id !== empresa.id);
  if (oferta?.so_na_loja) notFound();
  // Quem pede toda a quantidade tira a oferta da vitrine; mostra o caminho em vez de "página não encontrada".
  if (!oferta) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Oferta indisponível</h1>
        <div className="cartao space-y-3">
          <p className="text-stone-700">
            Esta oferta não está mais na vitrine. Se você acabou de fazer o pedido, ele está em Negócios esperando o vendedor aceitar.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/negocios" className="botao">Ver meus pedidos</Link>
            <Link href="/vitrine" className="botao-secundario">Voltar para a vitrine</Link>
          </div>
        </div>
      </div>
    );
  }

  const pedida = Number(String(quantidade ?? "").replace(",", "."));
  const qtd = pedida > 0 ? Math.min(pedida, Number(oferta.quantidade_disponivel)) : Math.min(1, Number(oferta.quantidade_disponivel));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/vitrine" className="text-sm text-stone-500 hover:underline">← Voltar para a vitrine</Link>
      <h1 className="text-2xl font-bold">Confirmar compra</h1>
      <div className="cartao space-y-1">
        <p className="text-lg font-semibold">{oferta.produto}</p>
        <p>{porUnidade(oferta.preco_unitario, oferta.unidade)} · {oferta.quantidade_disponivel} {oferta.unidade} disponíveis</p>
        {oferta.validade && <p className="text-sm text-stone-500">Validade {new Date(oferta.validade).toLocaleDateString("pt-BR")}</p>}
        {oferta.descricao && <p className="text-sm">{oferta.descricao}</p>}
      </div>
      <CartaoParte supabase={supabase} id={oferta.fornecedor_id} como="vendedor" />
      {empresa.papel === "comprador" ? (
        <div className="cartao space-y-2">
          <p className="text-sm text-stone-600">
            Confira a quantidade e quem vende. O pedido vai para o vendedor e a quantidade fica reservada. Quando ele aceitar, o WhatsApp dele aparece em Negócios para vocês combinarem a entrega.
            Total estimado para {qtd} {oferta.unidade}: <strong>{reais(qtd * Number(oferta.preco_unitario))}</strong>.
          </p>
          <Comprar
            oferta={oferta.id}
            maximo={Number(oferta.quantidade_disponivel)}
            unidade={oferta.unidade}
            fornecedor={oferta.fornecedor_nome}
            quantidade={qtd}
          />
        </div>
      ) : (
        <p className="aviso">Você está no modo Vender. Para comprar, troque para Comprar no menu.</p>
      )}
    </div>
  );
}
