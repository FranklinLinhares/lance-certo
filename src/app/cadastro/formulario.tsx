"use client";

import { useActionState, useState } from "react";
import { salvarEmpresa, type EstadoCadastro } from "./acoes";
import { CATEGORIAS, type Empresa } from "@/lib/dominio";

export function FormularioEmpresa({ empresa }: { empresa: Empresa | null }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(salvarEmpresa, {});
  const [papel, setPapel] = useState(empresa?.papel ?? "comprador");
  const [agricultor, setAgricultor] = useState(empresa?.agricultor ?? false);
  const [local, setLocal] = useState<{ lat: number; lng: number } | null>(
    empresa ? { lat: empresa.lat, lng: empresa.lng } : null,
  );
  const [buscandoLocal, setBuscandoLocal] = useState(false);

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
        <legend className="rotulo">Você quer</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["comprador", "fornecedor"] as const).map((p) => (
            <label key={p} className={`cursor-pointer rounded-lg border px-3 py-2 text-center ${papel === p ? "border-green-700 bg-green-50 font-semibold" : "border-stone-300"}`}>
              <input type="radio" name="papel" value={p} checked={papel === p} onChange={() => setPapel(p)} className="sr-only" />
              {p === "comprador" ? "Comprar" : "Vender"}
            </label>
          ))}
        </div>
      </fieldset>

      {papel === "fornecedor" && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="agricultor" checked={agricultor} onChange={(e) => setAgricultor(e.target.checked)} />
          Sou agricultor ou produtor rural
        </label>
      )}

      <div>
        <label className="rotulo" htmlFor="nome">{agricultor ? "Nome da propriedade ou produtor" : "Nome da empresa"}</label>
        <input id="nome" name="nome" required defaultValue={empresa?.nome} className="campo" />
      </div>

      <div>
        <label className="rotulo" htmlFor="documento">{agricultor ? "CNPJ ou CPF" : "CNPJ"}</label>
        <input id="documento" name="documento" required inputMode="numeric" defaultValue={empresa?.documento} className="campo" />
      </div>

      {agricultor && (
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <select name="tipo_registro" defaultValue={empresa?.tipo_documento === "cpf_ie" ? "ie" : "caf"} className="campo">
            <option value="caf">CAF</option>
            <option value="ie">Inscrição estadual</option>
          </select>
          <input name="registro_rural" placeholder="Número (obrigatório com CPF)" defaultValue={empresa?.registro_rural ?? ""} className="campo" />
        </div>
      )}

      <div>
        <label className="rotulo" htmlFor="telefone">WhatsApp</label>
        <input id="telefone" name="telefone" required inputMode="tel" defaultValue={empresa?.telefone} className="campo" />
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
        <label className="rotulo" htmlFor="raio_km">
          {papel === "comprador" ? "Comprar de fornecedores até quantos km?" : "Entregar até quantos km?"}
        </label>
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

      {estado.erro && <p className="erro">{estado.erro}</p>}
      <button disabled={enviando} className="botao w-full">{enviando ? "Salvando..." : "Salvar"}</button>
    </form>
  );
}
