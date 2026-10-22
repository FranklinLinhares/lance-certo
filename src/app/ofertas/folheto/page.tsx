import Link from "next/link";
import { exigirEmpresa } from "@/lib/sessao";
import { iaDisponivel } from "@/lib/ia";
import { LerFolheto } from "./LerFolheto";

export default async function Folheto() {
  const { empresa } = await exigirEmpresa();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Ofertas do folheto</h1>
      {empresa.papel !== "fornecedor" ? (
        <p className="text-stone-600">Para anunciar, mude para Vender no menu.</p>
      ) : !iaDisponivel() ? (
        <p className="text-stone-600">
          A IA não está configurada neste servidor. Publique as ofertas uma a uma em <Link href="/ofertas/nova" className="underline">Nova oferta</Link>.
        </p>
      ) : (
        <>
          <p className="text-stone-600">
            Envie as fotos ou o PDF do seu encarte. A IA separa os produtos com preço, você confere e publica tudo na vitrine de uma vez.
          </p>
          <LerFolheto />
        </>
      )}
    </div>
  );
}
