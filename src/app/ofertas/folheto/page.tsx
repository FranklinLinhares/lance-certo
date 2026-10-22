import { exigirEmpresa } from "@/lib/sessao";
import { iaDisponivel } from "@/lib/ia";
import { LerFolheto } from "./LerFolheto";

export default async function Folheto() {
  const { empresa } = await exigirEmpresa();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Ofertas do folheto ou da planilha</h1>
      {empresa.papel !== "fornecedor" ? (
        <p className="text-stone-600">Para anunciar, mude para Vender no menu.</p>
      ) : (
        <>
          <p className="text-stone-600">
            Envie a planilha de produtos ou o seu encarte. Você confere tudo e publica na vitrine de uma vez.
          </p>
          <LerFolheto comIa={iaDisponivel()} />
        </>
      )}
    </div>
  );
}
