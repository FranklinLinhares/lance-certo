"use client";

import { useEffect, useState } from "react";
import { UNIDADES, porUnidade, type Unidade } from "@/lib/dominio";
import type { PesquisaSupermercados as Resultado } from "@/lib/ia";
import { Girando } from "@/components/Girando";
import { mensagemDaTela } from "@/lib/erros";

const FONTES = { site: "Site", encarte: "Encarte", aplicativo: "Aplicativo", outro: "Outro" } as const;

type Estado = { resultado?: Resultado & { unidade: Unidade }; erro?: string };

// Fica fora do componente para a pesquisa continuar quando a pessoa muda de página
// e o resultado estar pronto quando ela voltar.
let emAndamento: { controle: AbortController; promessa: Promise<Estado> } | undefined;
let ultimo: Estado = {};

export function PesquisaSupermercados({ raioInicial, produtoInicial }: { raioInicial: number; produtoInicial: string }) {
  const [{ resultado, erro }, setEstado] = useState<Estado>(ultimo);
  const [pesquisando, setPesquisando] = useState(emAndamento !== undefined);

  useEffect(() => {
    let montado = true;
    emAndamento?.promessa.then((e) => {
      if (montado) {
        setEstado(e);
        setPesquisando(false);
      }
    });
    return () => {
      montado = false;
    };
  }, [pesquisando]);

  // onSubmit em vez de <form action>: uma action do React segura a troca de página até terminar.
  function pesquisar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const unidade = String(dados.get("unidade")) as Unidade;
    const controle = new AbortController();
    const promessa = (async (): Promise<Estado> => {
      try {
        const resposta = await fetch("/api/ia/supermercados", {
          method: "POST",
          signal: controle.signal,
          body: JSON.stringify({ produto: dados.get("produto"), unidade, raio_km: Number(dados.get("raio_km")) }),
        });
        const json = await resposta.json();
        if (!resposta.ok) throw new Error(json.erro);
        return { resultado: { ...json, unidade } };
      } catch (e) {
        return (e as Error).name === "AbortError" ? {} : { erro: mensagemDaTela(e) };
      }
    })().then((e) => {
      ultimo = e;
      emAndamento = undefined;
      return e;
    });
    emAndamento = { controle, promessa };
    ultimo = {};
    setEstado({});
    setPesquisando(true);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={pesquisar} className="cartao space-y-3">
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
        <button disabled={pesquisando} className="botao w-full">{pesquisando ? <Girando texto="Pesquisando... (pode levar até 1 minuto)" /> : "Pesquisar com IA"}</button>
        {pesquisando && (
          <>
            <button type="button" onClick={() => emAndamento?.controle.abort()} className="botao-secundario w-full">
              Parar pesquisa
            </button>
            <p className="text-xs text-stone-500">Pode usar outras páginas enquanto espera. Quando voltar aqui, o resultado estará pronto.</p>
          </>
        )}
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
