"use client";

import { useState, useTransition } from "react";
import { CATEGORIAS, PUBLICO, UNIDADES, porUnidade, type Categoria, type Unidade } from "@/lib/dominio";
import { Girando } from "@/components/Girando";
import { publicarFolheto } from "../acoes";

type Arquivo = { tipo: "image/jpeg" | "application/pdf"; base64: string; nome: string };
type Linha = {
  incluir: boolean;
  produto: string;
  produto_chave: string;
  descricao: string;
  categoria: Categoria;
  unidade: Unidade;
  preco_unitario: string;
  quantidade_disponivel: string;
};
type Lido = {
  loja: string | null;
  valido_ate: string | null;
  itens: { produto: string; produto_chave: string; descricao: string; categoria: Categoria; unidade: Unidade; preco_unitario: number }[];
};

const LADO_MAXIMO = 2000; // px: legível para a IA e leve para enviar

// Reduz a foto no navegador para caber no envio.
async function reduzirFoto(arquivo: File): Promise<string> {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const tela = document.createElement("canvas");
  tela.width = Math.round(imagem.width * escala);
  tela.height = Math.round(imagem.height * escala);
  tela.getContext("2d")!.drawImage(imagem, 0, 0, tela.width, tela.height);
  return tela.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function lerComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1]);
    leitor.onerror = () => reject(new Error("Não foi possível abrir o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

function emDias(dias: number) {
  return new Date(Date.now() + dias * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Fortaleza" });
}

export function LerFolheto() {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string>();
  const [loja, setLoja] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>();
  const [validaAte, setValidaAte] = useState(emDias(7));
  const [vendePara, setVendePara] = useState("todos");
  const [estoque, setEstoque] = useState("");
  const [publicando, iniciarPublicacao] = useTransition();

  async function escolher(lista: FileList | null) {
    setErro(undefined);
    const novos: Arquivo[] = [];
    try {
      for (const arquivo of Array.from(lista ?? [])) {
        if (arquivo.type === "application/pdf") {
          novos.push({ tipo: "application/pdf", base64: await lerComoBase64(arquivo), nome: arquivo.name });
        } else if (arquivo.type.startsWith("image/")) {
          novos.push({ tipo: "image/jpeg", base64: await reduzirFoto(arquivo), nome: arquivo.name });
        }
      }
    } catch {
      setErro("Não foi possível abrir um dos arquivos. Tente outra foto ou o PDF.");
    }
    setArquivos((atuais) => [...atuais, ...novos].slice(0, 6));
  }

  async function ler() {
    setLendo(true);
    setErro(undefined);
    try {
      const resposta = await fetch("/api/ia/folheto", {
        method: "POST",
        body: JSON.stringify({ arquivos: arquivos.map(({ tipo, base64 }) => ({ tipo, base64 })) }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível ler o folheto.");
      const lido = dados as Lido;
      if (lido.itens.length === 0) throw new Error("A IA não encontrou alimentos com preço neste folheto.");
      setLoja(lido.loja);
      if (lido.valido_ate && lido.valido_ate >= emDias(0)) setValidaAte(lido.valido_ate);
      setLinhas(
        lido.itens.map((i) => ({
          ...i,
          incluir: true,
          preco_unitario: String(i.preco_unitario),
          quantidade_disponivel: estoque,
        })),
      );
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLendo(false);
    }
  }

  function mudar(indice: number, campos: Partial<Linha>) {
    setLinhas((atuais) => atuais?.map((l, i) => (i === indice ? { ...l, ...campos } : l)));
  }

  function publicar() {
    setErro(undefined);
    const marcados = (linhas ?? []).filter((l) => l.incluir);
    iniciarPublicacao(async () => {
      const resultado = await publicarFolheto({
        validaAte,
        vendePara,
        itens: marcados.map((l) => ({
          produto: l.produto,
          produto_chave: l.produto_chave,
          descricao: l.descricao,
          categoria: l.categoria,
          unidade: l.unidade,
          preco_unitario: Number(l.preco_unitario.replace(",", ".")),
          quantidade_disponivel: Number(l.quantidade_disponivel.replace(",", ".")),
        })),
      });
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  if (!linhas) {
    return (
      <div className="cartao space-y-3">
        <label className="rotulo" htmlFor="arquivos">Fotos ou PDF do folheto (até 6 páginas)</label>
        <input
          id="arquivos"
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={(e) => {
            escolher(e.target.files);
            e.target.value = "";
          }}
          className="campo"
        />
        {arquivos.length > 0 && (
          <ul className="space-y-1 text-sm">
            {arquivos.map((a, i) => (
              <li key={`${a.nome}-${i}`} className="flex items-center justify-between gap-2">
                <span className="truncate">{a.nome}</span>
                <button type="button" onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))} className="text-red-700 underline">
                  tirar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <label className="rotulo" htmlFor="estoque">Estoque de cada item (opcional)</label>
          <input
            id="estoque"
            inputMode="decimal"
            value={estoque}
            onChange={(e) => setEstoque(e.target.value)}
            placeholder="Ex.: 50. Dá para mudar item por item depois."
            className="campo"
          />
        </div>
        <button type="button" onClick={ler} disabled={lendo || arquivos.length === 0} className="botao w-full">
          {lendo ? <Girando texto="Lendo o folheto... (pode levar até 1 minuto)" /> : "Ler folheto com IA"}
        </button>
        {erro && <p className="erro">{erro}</p>}
      </div>
    );
  }

  const marcados = linhas.filter((l) => l.incluir).length;
  return (
    <div className="space-y-4">
      <div className="cartao space-y-3">
        <p>
          A IA encontrou <strong>{linhas.length} itens</strong>
          {loja && <> no folheto de {loja}</>}. Confira nome, preço e unidade, desmarque o que não quer vender e informe o estoque.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="valida_ate">Ofertas valem até</label>
            <input id="valida_ate" type="date" min={emDias(0)} value={validaAte} onChange={(e) => setValidaAte(e.target.value)} className="campo" />
          </div>
          <div>
            <label className="rotulo" htmlFor="vende_para">Vender para</label>
            <select id="vende_para" value={vendePara} onChange={(e) => setVendePara(e.target.value)} className="campo">
              {Object.entries(PUBLICO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      <ul className="space-y-3">
        {linhas.map((l, i) => (
          <li key={i} className={`cartao space-y-2 ${l.incluir ? "" : "opacity-50"}`}>
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={l.incluir} onChange={(e) => mudar(i, { incluir: e.target.checked })} />
              Publicar
              {l.incluir && Number(l.preco_unitario.replace(",", ".")) > 0 && (
                <span className="ml-auto text-sm font-normal text-stone-500">{porUnidade(Number(l.preco_unitario.replace(",", ".")), l.unidade)}</span>
              )}
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <input aria-label="Produto" value={l.produto} onChange={(e) => mudar(i, { produto: e.target.value, produto_chave: "" })} className="campo" />
              <input aria-label="Marca e embalagem" value={l.descricao} onChange={(e) => mudar(i, { descricao: e.target.value })} placeholder="Marca e embalagem" className="campo" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select aria-label="Categoria" value={l.categoria} onChange={(e) => mudar(i, { categoria: e.target.value as Categoria })} className="campo">
                {Object.entries(CATEGORIAS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
              <select aria-label="Unidade" value={l.unidade} onChange={(e) => mudar(i, { unidade: e.target.value as Unidade })} className="campo">
                {Object.entries(UNIDADES).map(([v, n]) => <option key={v} value={v}>por {n}</option>)}
              </select>
              <input aria-label="Preço em R$" inputMode="decimal" value={l.preco_unitario} onChange={(e) => mudar(i, { preco_unitario: e.target.value })} placeholder="Preço R$" className="campo" />
              <input aria-label="Estoque" inputMode="decimal" value={l.quantidade_disponivel} onChange={(e) => mudar(i, { quantidade_disponivel: e.target.value })} placeholder="Estoque" className="campo" />
            </div>
          </li>
        ))}
      </ul>

      <div className="cartao space-y-2">
        {erro && <p className="erro">{erro}</p>}
        <button type="button" onClick={publicar} disabled={publicando || marcados === 0} className="botao w-full">
          {publicando ? <Girando texto="Publicando..." /> : `Publicar ${marcados} ${marcados === 1 ? "oferta" : "ofertas"} na vitrine`}
        </button>
        <button type="button" onClick={() => setLinhas(undefined)} disabled={publicando} className="botao-secundario w-full">
          Enviar outro folheto
        </button>
      </div>
    </div>
  );
}
