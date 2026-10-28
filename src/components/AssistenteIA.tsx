"use client";

import { useState } from "react";
import type { Categoria, Unidade } from "@/lib/dominio";
import { Girando } from "./Girando";
import { mensagemDaTela } from "@/lib/erros";

export type ItemIA = {
  produto: string;
  produto_chave: string;
  categoria: Categoria;
  unidade: Unidade;
  quantidade: number | null;
  preco_unitario: number | null;
  especificacoes: string;
  validade_minima_dias: number | null;
};

// Caixa de texto livre: "quero 200 kg de tomate italiano até sexta" -> campos preenchidos.
export function AssistenteIA({ exemplo, aoPreencher }: { exemplo: string; aoPreencher: (item: ItemIA) => void }) {
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string>();

  async function preencher() {
    setCarregando(true);
    setErro(undefined);
    try {
      const resposta = await fetch("/api/ia/item", { method: "POST", body: JSON.stringify({ texto }) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro);
      aoPreencher(dados as ItemIA);
    } catch (e) {
      setErro(mensagemDaTela(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-green-700/40 bg-green-50/50 p-4">
      <label className="rotulo" htmlFor="texto-ia">Escreva do seu jeito e a IA preenche</label>
      <textarea id="texto-ia" value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder={exemplo} className="campo" />
      <div className="flex items-center gap-3">
        <button type="button" onClick={preencher} disabled={carregando || texto.trim().length < 3} className="botao-secundario py-1.5">
          {carregando ? <Girando texto="Lendo..." /> : "Preencher com IA"}
        </button>
        {erro && <span className="text-sm text-red-700">{erro}</span>}
      </div>
    </div>
  );
}
