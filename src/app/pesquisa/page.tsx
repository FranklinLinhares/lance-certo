import { exigirEmpresa } from "@/lib/sessao";
import { PesquisaSupermercados } from "./PesquisaSupermercados";

export default async function Pesquisa({ searchParams }: PageProps<"/pesquisa">) {
  const { produto } = await searchParams;
  const { empresa } = await exigirEmpresa();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Pesquisar preços em supermercados</h1>
      <p className="text-stone-600">
        A IA procura o produto nos sites, aplicativos e encartes de supermercados e hipermercados perto de {empresa.cidade}/{empresa.uf}.
      </p>
      <PesquisaSupermercados raioInicial={empresa.raio_km} produtoInicial={typeof produto === "string" ? produto : ""} />
    </div>
  );
}
