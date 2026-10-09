"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrar } from "./acoes";

export default function Entrar() {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(entrar, {});

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Entrar no Lance Certo</h1>
      <form action={acao} className="cartao space-y-4">
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" name="senha" type="password" required minLength={8} autoComplete="current-password" className="campo" />
        </div>
        {estado.erro && <p className="erro">{estado.erro}</p>}
        {estado.mensagem && <p className="aviso">{estado.mensagem}</p>}
        <div className="flex gap-2">
          <button name="modo" value="entrar" disabled={enviando} className="botao flex-1">Entrar</button>
          <button name="modo" value="criar" disabled={enviando} className="botao-secundario flex-1">Criar conta</button>
        </div>
      </form>
    </div>
  );
}
