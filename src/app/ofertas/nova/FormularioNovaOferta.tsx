"use client";

import { useActionState, useState } from "react";
import { publicarOferta, type EstadoOferta } from "../acoes";
import { AssistenteIA, type ItemIA } from "@/components/AssistenteIA";
import { CamposOferta } from "../CamposOferta";
import { EscolherConvidados } from "@/components/EscolherConvidados";
import type { Contato } from "@/lib/contatos";

export function FormularioNovaOferta({ clientes }: { clientes: Contato[] }) {
  const [estado, acao, enviando] = useActionState<EstadoOferta, FormData>(publicarOferta, {});
  const [item, setItem] = useState<Partial<ItemIA>>({ categoria: "hortifruti", unidade: "kg" });
  const [versao, setVersao] = useState(0); // recria os campos quando a IA preenche

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Nova oferta na vitrine</h1>
      <AssistenteIA
        exemplo="Ex.: tenho 30 caixas de tomate italiano de 20 kg a 90 reais a caixa, colhido ontem"
        aoPreencher={(novo) => {
          setItem(novo);
          setVersao((v) => v + 1);
        }}
      />
      <form key={versao} action={acao} className="cartao space-y-4">
        <input type="hidden" name="produto_chave" value={item.produto_chave ?? ""} />
        <CamposOferta
          valores={{
            produto: item.produto,
            categoria: item.categoria,
            unidade: item.unidade,
            preco_unitario: item.preco_unitario ?? "",
            quantidade: item.quantidade ?? "",
            descricao: item.especificacoes,
          }}
        />
        <div>
          <label className="rotulo" htmlFor="dias_oferta">A oferta vale por</label>
          <select id="dias_oferta" name="dias_oferta" defaultValue="7" className="campo">
            <option value="1">1 dia</option>
            <option value="3">3 dias</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
          </select>
        </div>
        <EscolherConvidados tipo="cliente" contatos={clientes} />
        {estado.erro && <p className="erro">{estado.erro}</p>}
        <button disabled={enviando} className="botao w-full">{enviando ? "Publicando..." : "Publicar oferta"}</button>
      </form>
    </div>
  );
}
