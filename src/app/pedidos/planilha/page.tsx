import { exigirEmpresa } from "@/lib/sessao";
import { LeiloesDaPlanilha } from "./LeiloesDaPlanilha";

export default async function PlanilhaLeiloes() {
  const { empresa } = await exigirEmpresa();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Vários leilões pela planilha</h1>
      {empresa.papel !== "comprador" ? (
        <p className="text-stone-600">Para criar leilões, mude para Comprar no menu.</p>
      ) : (
        <>
          <p className="text-stone-600">
            Liste na planilha tudo o que você quer comprar. Cada linha vira um leilão, e na lista eles ficam separados por categoria.
          </p>
          <LeiloesDaPlanilha />
        </>
      )}
    </div>
  );
}
