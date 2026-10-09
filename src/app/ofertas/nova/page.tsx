"use client";

import { useActionState, useState } from "react";
import { publicarOferta, type EstadoOferta } from "../acoes";
import { AssistenteIA, type ItemIA } from "@/components/AssistenteIA";
import { CATEGORIAS, UNIDADES } from "@/lib/dominio";

export default function NovaOferta() {
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
        <div>
          <label className="rotulo" htmlFor="produto">Produto</label>
          <input id="produto" name="produto" required defaultValue={item.produto} className="campo" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="rotulo" htmlFor="categoria">Categoria</label>
            <select id="categoria" name="categoria" defaultValue={item.categoria} className="campo">
              {Object.entries(CATEGORIAS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="unidade">Unidade</label>
            <select id="unidade" name="unidade" defaultValue={item.unidade} className="campo">
              {Object.entries(UNIDADES).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="rotulo" htmlFor="preco_unitario">Preço por unidade (R$)</label>
            <input id="preco_unitario" name="preco_unitario" required inputMode="decimal" defaultValue={item.preco_unitario ?? ""} className="campo" />
          </div>
          <div>
            <label className="rotulo" htmlFor="quantidade_disponivel">Quantidade disponível</label>
            <input id="quantidade_disponivel" name="quantidade_disponivel" required inputMode="decimal" defaultValue={item.quantidade ?? ""} className="campo" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="rotulo" htmlFor="validade">Validade do produto</label>
            <input id="validade" name="validade" type="date" className="campo" />
          </div>
          <div>
            <label className="rotulo" htmlFor="disponivel_a_partir">Disponível a partir de</label>
            <input id="disponivel_a_partir" name="disponivel_a_partir" type="date" className="campo" />
            <p className="mt-1 text-xs text-stone-500">Para ofertas de safra ainda não colhida.</p>
          </div>
        </div>
        <div>
          <label className="rotulo" htmlFor="dias_oferta">A oferta vale por</label>
          <select id="dias_oferta" name="dias_oferta" defaultValue="7" className="campo">
            <option value="1">1 dia</option>
            <option value="3">3 dias</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="descricao">Detalhes</label>
          <textarea id="descricao" name="descricao" rows={2} defaultValue={item.especificacoes} className="campo" />
        </div>
        {estado.erro && <p className="erro">{estado.erro}</p>}
        <button disabled={enviando} className="botao w-full">{enviando ? "Publicando..." : "Publicar oferta"}</button>
      </form>
    </div>
  );
}
