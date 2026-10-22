"use client";

import Link from "next/link";
import { useActionState } from "react";
import { comprarOferta, type EstadoCompra } from "./acoes";

export function Comprar({ oferta, maximo, unidade, telefone, fornecedor, quantidade }: { oferta: string; maximo: number; unidade: string; telefone: string; fornecedor: string; quantidade?: number }) {
  const [estado, acao, enviando] = useActionState<EstadoCompra, FormData>(comprarOferta, {});
  if (estado.ok) {
    return (
      <div className="space-y-2 rounded-lg bg-green-50 p-3">
        <p className="text-sm text-green-800">
          {estado.ok}{" "}
          <a href={`https://wa.me/55${telefone}`} target="_blank" rel="noreferrer" className="font-semibold underline">Abrir WhatsApp</a>
        </p>
        <p className="text-xs text-stone-600">
          Combine a entrega com {fornecedor}. Quando receber, confirme em <Link href="/negocios" className="underline">Negócios</Link> para avaliar.
        </p>
      </div>
    );
  }
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="oferta" value={oferta} />
      <label className="flex items-center gap-1">
        Quantidade
        <input name="quantidade" type="number" step="any" min={0} max={maximo} required defaultValue={quantidade ?? Math.min(1, maximo)} className="campo w-24 py-1" />
        {unidade}
      </label>
      <button disabled={enviando} className="botao py-1">{enviando ? "Confirmando..." : "Confirmar compra"}</button>
      {estado.erro && <span className="text-red-700">{estado.erro}</span>}
    </form>
  );
}
