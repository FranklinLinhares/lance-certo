"use client";

import { useActionState } from "react";
import { darLance, type EstadoForm } from "../acoes";

export function DarLance({ pedido, unidade, dica }: { pedido: string; unidade: string; dica: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(darLance, {});
  return (
    <form action={acao} className="cartao space-y-3">
      <h2 className="font-semibold">Dar lance</h2>
      <p className="text-sm text-stone-600">{dica}</p>
      <input type="hidden" name="pedido" value={pedido} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="rotulo" htmlFor="preco">Preço por {unidade} (R$)</label>
          <input id="preco" name="preco" required inputMode="decimal" className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="validade">Validade garantida</label>
          <input id="validade" name="validade" type="date" className="campo" />
        </div>
      </div>
      <input name="observacao" placeholder="Observação (prazo de entrega, marca...)" className="campo" />
      {estado.erro && <p className="erro">{estado.erro}</p>}
      <button disabled={enviando} className="botao w-full">{enviando ? "Enviando..." : "Enviar lance"}</button>
    </form>
  );
}
