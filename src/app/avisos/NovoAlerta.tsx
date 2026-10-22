"use client";

import { useActionState } from "react";
import { UNIDADES } from "@/lib/dominio";
import { criarAlerta, type EstadoAlerta } from "./acoes";

export function NovoAlerta() {
  const [estado, acao, enviando] = useActionState<EstadoAlerta, FormData>(criarAlerta, {});
  return (
    <form action={acao} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
      <input name="produto" required placeholder="Produto, ex.: arroz branco tipo 1" className="campo" aria-label="Produto" />
      <select name="unidade" defaultValue="kg" className="campo" aria-label="Unidade">
        {Object.entries(UNIDADES).map(([v, n]) => <option key={v} value={v}>por {n}</option>)}
      </select>
      <input name="preco_maximo" required inputMode="decimal" placeholder="Até R$" className="campo sm:w-28" aria-label="Preço máximo em R$" />
      <button disabled={enviando} className="botao">{enviando ? "Salvando..." : "Criar alerta"}</button>
      {estado.erro && <p className="erro sm:col-span-4">{estado.erro}</p>}
    </form>
  );
}
