"use client";

import { useActionState } from "react";
import { editarOferta, type EstadoOferta } from "../../acoes";
import { CamposOferta, type ValoresOferta } from "../../CamposOferta";
import { EscolherConvidados } from "@/components/EscolherConvidados";
import type { Contato } from "@/lib/contatos";

export function FormularioEdicao({
  oferta,
  vencida,
  clientes,
}: {
  oferta: ValoresOferta & { id: string; produto_chave: string; quantidade_disponivel: number; convidados: string[] | null };
  vencida: boolean;
  clientes: Contato[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoOferta, FormData>(editarOferta, {});
  return (
    <form action={acao} className="cartao space-y-4">
      <input type="hidden" name="id" value={oferta.id} />
      <input type="hidden" name="produto_original" value={oferta.produto} />
      <input type="hidden" name="produto_chave" value={oferta.produto_chave} />
      <CamposOferta valores={{ ...oferta, quantidade: oferta.quantidade_disponivel }} />
      <div>
        <label className="rotulo" htmlFor="dias_oferta">{vencida ? "Publicar de novo por" : "Prazo na vitrine"}</label>
        <select id="dias_oferta" name="dias_oferta" defaultValue={vencida ? "7" : "0"} className="campo">
          {!vencida && <option value="0">Manter o prazo atual</option>}
          <option value="1">1 dia a partir de hoje</option>
          <option value="3">3 dias a partir de hoje</option>
          <option value="7">7 dias a partir de hoje</option>
          <option value="30">30 dias a partir de hoje</option>
        </select>
      </div>
      <EscolherConvidados tipo="cliente" contatos={clientes} marcados={oferta.convidados} />
      {estado.erro && <p className="erro">{estado.erro}</p>}
      <button disabled={enviando} className="botao w-full">{enviando ? "Salvando..." : "Salvar alterações"}</button>
    </form>
  );
}
