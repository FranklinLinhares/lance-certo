"use client";

import { useActionState, useState } from "react";
import { salvarEmpresa, type EstadoCadastro } from "./acoes";
import { CATEGORIAS, type Empresa } from "@/lib/dominio";
import { EXIGIR_DOCUMENTO } from "@/lib/documentos";

function Escolha<T extends string>({ nome, opcoes, valor, aoMudar }: { nome: string; opcoes: [T, string][]; valor: T; aoMudar: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {opcoes.map(([v, rotulo]) => (
        <label key={v} className={`cursor-pointer rounded-lg border px-3 py-2 text-center ${valor === v ? "border-green-700 bg-green-50 font-semibold" : "border-stone-300"}`}>
          <input type="radio" name={nome} value={v} checked={valor === v} onChange={() => aoMudar(v)} className="sr-only" />
          {rotulo}
        </label>
      ))}
    </div>
  );
}

// Cadastro único: a mesma conta compra e vende, com CPF ou CNPJ.
export function FormularioEmpresa({ empresa, email }: { empresa: Empresa | null; email: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(salvarEmpresa, {});
  const [pessoa, setPessoa] = useState<"pf" | "pj">(empresa && empresa.tipo_documento !== "cnpj" ? "pf" : "pj");
  const [agricultor, setAgricultor] = useState(empresa?.agricultor ?? false);
  const [local, setLocal] = useState<{ lat: number; lng: number } | null>(
    empresa ? { lat: empresa.lat, lng: empresa.lng } : null,
  );
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const pf = pessoa === "pf";

  function usarMinhaLocalizacao() {
    setBuscandoLocal(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocal({ lat: p.coords.latitude, lng: p.coords.longitude });
        setBuscandoLocal(false);
      },
      () => setBuscandoLocal(false),
    );
  }

  return (
    <form action={acao} className="cartao space-y-4">
      <fieldset>
        <legend className="rotulo">Você se cadastra como</legend>
        <Escolha nome="pessoa" opcoes={[["pf", "Pessoa física (CPF)"], ["pj", "Empresa (CNPJ)"]]} valor={pessoa} aoMudar={setPessoa} />
      </fieldset>

      <div>
        <label className="rotulo" htmlFor="nome_completo">Nome completo</label>
        <input id="nome_completo" name="nome_completo" required defaultValue={empresa?.nome_completo ?? (pf ? empresa?.nome : "")} className="campo" />
      </div>

      {!pf && (
        <div>
          <label className="rotulo" htmlFor="nome_fantasia">Nome fantasia da empresa</label>
          <input id="nome_fantasia" name="nome_fantasia" required defaultValue={empresa?.tipo_documento === "cnpj" ? empresa.nome : ""} className="campo" />
        </div>
      )}

      <div>
        <label className="rotulo" htmlFor="documento">{pf ? "CPF" : "CNPJ"}</label>
        <input id="documento" name="documento" required={EXIGIR_DOCUMENTO} inputMode="numeric" defaultValue={empresa?.documento} className="campo" />
        {!EXIGIR_DOCUMENTO && <p className="mt-1 text-sm text-stone-500">Opcional durante os testes.</p>}
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="agricultor" checked={agricultor} onChange={(e) => setAgricultor(e.target.checked)} />
        Sou agricultor ou produtor rural
      </label>
      {pf && agricultor && (
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <select name="tipo_registro" defaultValue={empresa?.tipo_documento === "cpf_ie" ? "ie" : "caf"} className="campo">
            <option value="caf">CAF</option>
            <option value="ie">Inscrição estadual</option>
          </select>
          <input name="registro_rural" placeholder="Número (opcional)" defaultValue={empresa?.registro_rural ?? ""} className="campo" />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="telefone">WhatsApp</label>
          <input id="telefone" name="telefone" required inputMode="tel" defaultValue={empresa?.telefone} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" value={email} readOnly className="campo bg-stone-100 text-stone-600" />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="endereco">{pf ? "Endereço residencial" : "Endereço da empresa"}</label>
        <input id="endereco" name="endereco" required placeholder="Rua, número, bairro" defaultValue={empresa?.endereco ?? ""} className="campo" />
      </div>
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <div>
          <label className="rotulo" htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" required defaultValue={empresa?.cidade} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="uf">UF</label>
          <input id="uf" name="uf" required maxLength={2} defaultValue={empresa?.uf ?? "PB"} className="campo uppercase" />
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={usarMinhaLocalizacao} className="botao-secundario py-1.5" disabled={buscandoLocal}>
          Usar minha localização
        </button>
        <span className="text-stone-500">{local ? "Localização definida." : "Senão usamos o centro da cidade."}</span>
        <input type="hidden" name="lat" value={local?.lat ?? ""} />
        <input type="hidden" name="lng" value={local?.lng ?? ""} />
      </div>

      <div>
        <label className="rotulo" htmlFor="raio_km">Comprar e entregar até quantos km?</label>
        <input id="raio_km" name="raio_km" type="number" min={1} max={500} defaultValue={empresa?.raio_km ?? 30} className="campo" />
      </div>

      <fieldset>
        <legend className="rotulo">Categorias de interesse</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORIAS).map(([valor, nome]) => (
            <label key={valor} className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1 text-sm">
              <input type="checkbox" name="categorias" value={valor} defaultChecked={empresa?.categorias.includes(valor as never)} />
              {nome}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-stone-500">Com a mesma conta você compra e vende. Troque entre Comprar e Vender no menu, quando quiser.</p>

      {estado.erro && <p className="erro">{estado.erro}</p>}
      <button disabled={enviando} className="botao w-full">{enviando ? "Salvando..." : "Salvar"}</button>
    </form>
  );
}
