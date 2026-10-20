"use client";

import { excluirOferta } from "./acoes";

// Pede confirmação antes de excluir, porque não dá para desfazer.
export function ExcluirOferta({ id }: { id: string }) {
  return (
    <form
      action={excluirOferta}
      onSubmit={(e) => {
        if (!confirm("Excluir esta oferta? Ela sai da vitrine e não dá para desfazer.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-sm font-medium text-red-700 hover:underline">Excluir</button>
    </form>
  );
}
