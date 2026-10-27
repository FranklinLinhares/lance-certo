"use client";

import { useActionState } from "react";
import { criarContatoManual, type EstadoContato } from "./acoes";

// Cadastro à mão de um fornecedor ou cliente que ainda não usa o app.
export function NovoContato() {
  const [estado, acao, enviando] = useActionState<EstadoContato, FormData>(criarContatoManual, {});
  const v = estado.valores ?? {};
  return (
    <form action={acao} className="grid gap-2 sm:grid-cols-2">
      <label className="space-y-1 sm:col-span-2">
        <span className="rotulo">Nome *</span>
        <input name="nome" defaultValue={v.nome} required minLength={2} maxLength={120} placeholder="Nome da pessoa ou empresa" className="campo" />
      </label>
      <label className="space-y-1">
        <span className="rotulo">É meu</span>
        <select name="tipo" defaultValue={v.tipo ?? "fornecedor"} className="campo">
          <option value="fornecedor">Fornecedor</option>
          <option value="cliente">Cliente</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="rotulo">Telefone / WhatsApp</span>
        <input name="telefone" defaultValue={v.telefone} type="tel" inputMode="tel" placeholder="(83) 99999-9999" className="campo" />
      </label>
      <label className="space-y-1">
        <span className="rotulo">E-mail</span>
        <input name="email" defaultValue={v.email} type="email" placeholder="contato@exemplo.com" className="campo" />
      </label>
      <label className="space-y-1">
        <span className="rotulo">CPF ou CNPJ</span>
        <input name="documento" defaultValue={v.documento} inputMode="numeric" placeholder="Só números" className="campo" />
      </label>
      <label className="space-y-1">
        <span className="rotulo">Cidade</span>
        <input name="cidade" defaultValue={v.cidade} maxLength={80} className="campo" />
      </label>
      <label className="space-y-1">
        <span className="rotulo">UF</span>
        <input name="uf" defaultValue={v.uf} maxLength={2} placeholder="PB" className="campo uppercase" />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="rotulo">Observação</span>
        <textarea name="observacao" defaultValue={v.observacao} maxLength={500} rows={2} placeholder="Ex.: entrega às terças, prefere pagamento no Pix" className="campo" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={enviando} className="botao">{enviando ? "Salvando..." : "Salvar contato"}</button>
        {estado.erro && <p className="erro">{estado.erro}</p>}
        {estado.ok && <p className="text-sm text-green-800">{estado.ok}</p>}
      </div>
    </form>
  );
}
