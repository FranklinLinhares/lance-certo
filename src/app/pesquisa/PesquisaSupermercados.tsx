"use client";

import { useState } from "react";
import { UNIDADES, porUnidade, type Unidade } from "@/lib/dominio";
import type { PesquisaSupermercados as Resultado } from "@/lib/ia";

const FONTES = { site: "Site", encarte: "Encarte", aplicativo: "Aplicativo", outro: "Outro" } as const;

export function PesquisaSupermercados({ raioInicial, produtoInicial }: { raioInicial: number; produtoInicial: string }) {
  const [resultado, setResultado] = useState<Resultado & { unidade: Unidade }>();
  const [pesquisando, setPesquisando] = useState(false);
  const [erro, setErro] = useState<string>();

  async function pesquisar(dados: FormData) {
    setPesquisando(true);
    setErro(undefined);
    setResultado(undefined);
    const unidade = String(dados.get("unidade")) as Unidade;
    try {
      const resposta = await fetch("/api/ia/supermercados", {
        method: "POST",
        body: JSON.stringify({ produto: dados.get("produto"), unidade, raio_km: Number(dados.get("raio_km")) }),
      });
      const json = await resposta.json();
      if (!resposta.ok) throw new Error(json.erro);
      setResultado({ ...json, unidade });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setPesquisando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form action={pesquisar} className="cartao space-y-3">
        <div>
          <label className="rotulo" htmlFor="produto">Produto</label>
          <input id="produto" name="produto" required defaultValue={produtoInicial} placeholder="Ex.: arroz branco tipo 1, queijo de manteiga" className="campo" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="rotulo" htmlFor="unidade">Preço por</label>
            <select id="unidade" name="unidade" defaultValue="kg" className="campo">
              {Object.entries(UNIDADES).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="raio_km">Até quantos km</label>
            <input id="raio_km" name="raio_km" type="number" min={1} max={200} defaultValue={raioInicial} className="campo" />
          </div>
        </div>
        <button disabled={pesquisando} className="botao w-full">{pesquisando ? "Pesquisando... (pode levar até 1 minuto)" : "Pesquisar com IA"}</button>
        {erro && <p className="erro">{erro}</p>}
      </form>

      {resultado && (
        <section className="cartao space-y-3">
          <p>{resultado.resumo}</p>
          {resultado.precos.length === 0 && <p className="text-sm text-stone-500">Nenhum preço encontrado nos sites dos supermercados.</p>}
          <ul className="divide-y divide-stone-100">
            {resultado.precos.map((p, i) => (
              <li key={`${p.url}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <div className="font-medium">
                    {p.loja} <span className="text-sm font-normal text-stone-500">· {p.cidade}</span>
                  </div>
                  <div className="text-sm text-stone-600">{p.descricao}</div>
                  <div className="text-xs text-stone-500">
                    {FONTES[p.fonte]}
                    {p.data && <> · {p.data}</>} ·{" "}
                    <a href={p.url} target="_blank" rel="noreferrer" className="underline">ver fonte</a>
                  </div>
                </div>
                <div className={`font-bold ${i === 0 ? "text-green-800" : ""}`}>{porUnidade(p.preco, resultado.unidade)}</div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500">
            Preços de varejo encontrados na internet; confira na loja antes de comprar. Para preços de notas fiscais na Paraíba, veja o{" "}
            <a href="https://precodahora.pb.gov.br/" target="_blank" rel="noreferrer" className="underline">Preço da Hora</a>.
          </p>
        </section>
      )}
    </div>
  );
}
