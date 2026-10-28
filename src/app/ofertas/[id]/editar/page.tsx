import { notFound } from "next/navigation";
import { exigirEmpresa } from "@/lib/sessao";
import { dataHora, type Categoria, type Publico, type Unidade } from "@/lib/dominio";
import { buscarContatos } from "@/lib/contatos";
import { FormularioEdicao } from "./FormularioEdicao";
import { ExcluirOferta } from "../../ExcluirOferta";

type Oferta = {
  id: string;
  produto: string;
  produto_chave: string;
  categoria: Categoria;
  unidade: Unidade;
  preco_unitario: number;
  quantidade_disponivel: number;
  validade: string | null;
  disponivel_a_partir: string | null;
  vende_para: Publico;
  descricao: string | null;
  valida_ate: string;
  ativa: boolean;
  convidados: string[] | null;
  so_na_loja: boolean;
};

export default async function EditarOferta({ params }: PageProps<"/ofertas/[id]/editar">) {
  const { id } = await params;
  const { supabase, empresa } = await exigirEmpresa();
  const { data: oferta } = await supabase
    .from("ofertas")
    .select("*")
    .eq("id", id)
    .eq("fornecedor_id", empresa.id)
    .maybeSingle<Oferta>();
  if (!oferta) notFound();
  const clientes = await buscarContatos(supabase, empresa.id, "cliente");

  const vencida = !oferta.ativa || new Date(oferta.valida_ate) < new Date();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Editar oferta</h1>
      <p className="text-sm text-stone-600">
        {vencida ? "Esta oferta não está na vitrine. Escolha um prazo abaixo para publicá-la de novo." : `Na vitrine até ${dataHora(oferta.valida_ate)}.`}
      </p>
      <FormularioEdicao oferta={oferta} vencida={vencida} clientes={clientes} />
      <div className="cartao flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">Não vai mais vender este produto?</p>
        <ExcluirOferta id={oferta.id} />
      </div>
    </div>
  );
}
