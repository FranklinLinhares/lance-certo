"use client";

import Link from "next/link";
import { useState } from "react";
import type { Contato, TipoContato } from "@/lib/contatos";

// "Aberto para todos" ou "só para os contatos que eu escolher".
export function EscolherConvidados({ tipo, contatos, marcados }: { tipo: TipoContato; contatos: Contato[]; marcados?: string[] | null }) {
  const [selecionados, setSelecionados] = useState(Boolean(marcados?.length));
  const plural = tipo === "fornecedor" ? "fornecedores" : "clientes";
  return (
    <fieldset className="space-y-2">
      <legend className="rotulo">{tipo === "fornecedor" ? "Quem pode dar lance" : "Quem pode comprar"}</legend>
      <label className="flex items-start gap-2">
        <input type="radio" name="publico_convidados" value="todos" checked={!selecionados} onChange={() => setSelecionados(false)} className="mt-1" />
        <span><strong>Aberto para todos</strong> os {tipo === "fornecedor" ? "fornecedores" : "compradores"} dentro do raio.</span>
      </label>
      <label className="flex items-start gap-2">
        <input type="radio" name="publico_convidados" value="selecionados" checked={selecionados} onChange={() => setSelecionados(true)} className="mt-1" />
        <span><strong>Só os {plural} que eu escolher</strong>, mesmo fora do raio.</span>
      </label>
      {selecionados && (
        <div className="ml-6 space-y-1 rounded-lg border border-stone-200 p-3">
          {contatos.length === 0 ? (
            <p className="text-sm text-stone-600">
              Você ainda não tem {plural} salvos. <Link href="/contatos" className="underline">Adicionar em Meus contatos</Link>
            </p>
          ) : (
            contatos.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="convidados" value={c.id} defaultChecked={marcados?.includes(c.id)} />
                {c.nome} <span className="text-stone-500">· {c.cidade}/{c.uf}</span>
              </label>
            ))
          )}
        </div>
      )}
    </fieldset>
  );
}
