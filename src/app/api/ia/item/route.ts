import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";
import { estruturarItem, iaDisponivel } from "@/lib/ia";

// Transforma o texto livre de um pedido ou oferta em campos preenchidos.
export async function POST(request: Request) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });
  if (!iaDisponivel()) return NextResponse.json({ erro: "A IA não está configurada neste servidor." }, { status: 503 });

  const { texto } = (await request.json()) as { texto?: string };
  if (!texto || texto.trim().length < 3 || texto.length > 2000) {
    return NextResponse.json({ erro: "Descreva o produto em poucas palavras." }, { status: 400 });
  }
  try {
    return NextResponse.json(await estruturarItem(texto));
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}
