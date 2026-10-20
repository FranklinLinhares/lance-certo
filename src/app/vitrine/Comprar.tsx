"use client";

import { useActionState } from "react";
import { comprarOferta, type EstadoCompra } from "./acoes";
import { Avaliar } from "@/components/Avaliar";

export function Comprar({ oferta, maximo, unidade, telefone, fornecedor }: { oferta: string; maximo: number; unidade: string; telefone: string; fornecedor: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCompra, FormData>(comprarOferta, {});
  if (estado.ok) {
    return (
      <div className="space-y-2 rounded-lg bg-green-50 p-3">
        <p className="text-sm text-green-800">
          {estado.ok}{" "}
          <a href={`https://wa.me/55${telefone}`} target="_blank" rel="noreferrer" className="font-semibold underline">Abrir WhatsApp</a>
        </p>
        {estado.compra && (
          <>
            <p className="text-sm font-medium">Avalie {fornecedor}</p>
            <Avaliar compra={estado.compra} nome={fornecedor} />
            <p className="text-xs text-stone-500">Se preferir, avalie depois em Negócios.</p>
          </>
        )}
      </div>
    );
  }
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="oferta" value={oferta} />
      <input name="quantidade" type="number" step="any" min={0} max={maximo} required placeholder={unidade} className="campo w-24 py-1" />
      <button disabled={enviando} className="botao py-1">Comprar</button>
      {estado.erro && <span className="text-red-700">{estado.erro}</span>}
    </form>
  );
}
