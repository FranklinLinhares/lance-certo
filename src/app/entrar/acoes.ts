"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoEntrar = { erro?: string; mensagem?: string };

export async function entrar(_: EstadoEntrar, form: FormData): Promise<EstadoEntrar> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const criarConta = form.get("modo") === "criar";
  if (!email || senha.length < 8) {
    return { erro: "Informe o e-mail e uma senha com pelo menos 8 caracteres." };
  }

  const supabase = await criarClienteServidor();
  if (criarConta) {
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    if (error) return { erro: traduzir(error.message) };
    if (!data.session) {
      return { mensagem: "Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre." };
    }
    redirect("/cadastro");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { erro: traduzir(error.message) };
  redirect("/vitrine");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/");
}

function traduzir(mensagem: string) {
  if (/invalid login/i.test(mensagem)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(mensagem)) return "Este e-mail já tem conta. Use a opção Entrar.";
  if (/email not confirmed/i.test(mensagem)) return "Confirme seu e-mail pelo link que enviamos.";
  return mensagem;
}
