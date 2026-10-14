import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

// Destino do link de confirmação de e-mail: troca o código por uma sessão.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/cadastro", request.url));
  }
  return NextResponse.redirect(new URL("/entrar?erro=confirmacao", request.url));
}
