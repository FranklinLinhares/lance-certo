"use client";

import { useRef } from "react";
import { CATEGORIAS, type Categoria } from "@/lib/dominio";
import { salvarCategorias } from "./acoes";

// Marcar ou desmarcar uma categoria já salva; as marcadas abrem primeiro na vitrine.
export function MinhasCategorias({ marcadas }: { marcadas: Categoria[] }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={salvarCategorias} className="space-y-1">
      <div className="text-sm font-medium text-stone-700">Suas categorias de interesse</div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORIAS).map(([valor, nome]) => (
          <label
            key={valor}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm has-checked:border-green-700 has-checked:bg-green-100 has-checked:text-green-900"
          >
            <input
              type="checkbox"
              name="categorias"
              value={valor}
              defaultChecked={marcadas.includes(valor as Categoria)}
              onChange={() => form.current?.requestSubmit()}
              className="accent-green-700"
            />
            {nome}
          </label>
        ))}
      </div>
      <p className="text-xs text-stone-500">As marcadas aparecem primeiro e abertas. No modo Vender, você também recebe aviso de leilões novos nelas.</p>
    </form>
  );
}
