import { redirect } from "next/navigation";
import { exigirEmpresa } from "@/lib/sessao";
import { FormularioPedido } from "./formulario";

export default async function NovoPedido({ searchParams }: PageProps<"/pedidos/novo">) {
  const { empresa } = await exigirEmpresa();
  if (empresa.papel !== "comprador") redirect("/pedidos");
  const { produto } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Novo leilão</h1>
      <p className="text-stone-600">Fornecedores a até {empresa.raio_km} km de {empresa.cidade} serão avisados e disputam pelo menor preço.</p>
      <FormularioPedido produtoInicial={typeof produto === "string" ? produto : ""} />
    </div>
  );
}
