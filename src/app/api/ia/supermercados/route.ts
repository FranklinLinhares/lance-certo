import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";
import { iaDisponivel, pesquisarSupermercados } from "@/lib/ia";
import { UNIDADES, type Empresa } from "@/lib/dominio";

// A pesquisa na web pode levar mais de um minuto.
export const maxDuration = 300;

// Pesquisa preços em supermercados e hipermercados até a distância escolhida.
export async function POST(request: Request) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });
  if (!iaDisponivel()) return NextResponse.json({ erro: "A IA não está configurada neste servidor." }, { status: 503 });

  const { data: empresa } = await supabase.from("empresas").select("cidade, uf").eq("id", user.id).single<Pick<Empresa, "cidade" | "uf">>();
  if (!empresa) return NextResponse.json({ erro: "Complete seu cadastro primeiro." }, { status: 400 });

  const corpo = (await request.json()) as { produto?: string; unidade?: string; raio_km?: number };
  const produto = corpo.produto?.trim();
  if (!produto || !corpo.unidade || !(corpo.unidade in UNIDADES)) {
    return NextResponse.json({ erro: "Informe o produto e a unidade." }, { status: 400 });
  }

  try {
    const resultado = await pesquisarSupermercados({
      produto,
      unidade: corpo.unidade as keyof typeof UNIDADES,
      cidade: empresa.cidade,
      uf: empresa.uf,
      raioKm: Math.min(200, Math.max(1, Number(corpo.raio_km) || 30)),
    });
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}
