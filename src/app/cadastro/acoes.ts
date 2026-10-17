"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EXIGIR_DOCUMENTO, cnpjValido, cpfValido, documentoDeTeste, soDigitos } from "@/lib/documentos";
import { CATEGORIAS, type Categoria } from "@/lib/dominio";

export type EstadoCadastro = { erro?: string };

export async function salvarEmpresa(_: EstadoCadastro, form: FormData): Promise<EstadoCadastro> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const papel = form.get("papel") === "fornecedor" ? "fornecedor" : "comprador";
  const agricultor = papel === "fornecedor" && form.get("agricultor") === "on";
  let documento = soDigitos(String(form.get("documento") ?? ""));
  const registroRural = String(form.get("registro_rural") ?? "").trim();
  const tipoRegistro = form.get("tipo_registro") === "ie" ? "cpf_ie" : "cpf_caf";

  let tipoDocumento: "cnpj" | "cpf_caf" | "cpf_ie" = "cnpj";
  if (!EXIGIR_DOCUMENTO) {
    // Modo de testes: aceita qualquer número; sem 14 dígitos, gera um de teste.
    if (documento.length !== 14) documento = documentoDeTeste();
  } else if (documento.length === 11) {
    if (!agricultor) return { erro: "Use o CNPJ da empresa. CPF só é aceito para agricultores." };
    if (!cpfValido(documento)) return { erro: "CPF inválido." };
    if (!registroRural) return { erro: "Informe o número do CAF ou da inscrição estadual de produtor rural." };
    tipoDocumento = tipoRegistro;
  } else if (!cnpjValido(documento)) {
    return { erro: "CNPJ inválido." };
  }

  const cidade = String(form.get("cidade") ?? "").trim();
  const uf = String(form.get("uf") ?? "").trim().toUpperCase();
  let lat = Number(form.get("lat"));
  let lng = Number(form.get("lng"));
  if (!lat || !lng) {
    const ponto = await localizarCidade(cidade, uf);
    if (!ponto) return { erro: "Não encontramos essa cidade. Confira o nome ou use a sua localização." };
    ({ lat, lng } = ponto);
  }

  const categorias = form
    .getAll("categorias")
    .map(String)
    .filter((c): c is Categoria => c in CATEGORIAS);

  const { error } = await supabase.from("empresas").upsert({
    id: user.id,
    papel,
    tipo_documento: tipoDocumento,
    documento,
    registro_rural: tipoDocumento === "cnpj" ? null : registroRural,
    agricultor,
    nome: String(form.get("nome") ?? "").trim(),
    telefone: soDigitos(String(form.get("telefone") ?? "")),
    cidade,
    uf,
    lat,
    lng,
    raio_km: Math.min(500, Math.max(1, Number(form.get("raio_km")) || 30)),
    categorias,
  });
  if (error) {
    if (error.code === "23505") return { erro: "Este documento já está cadastrado em outra conta." };
    return { erro: error.message };
  }
  redirect(papel === "fornecedor" ? "/pedidos" : "/vitrine");
}

// Coordenadas aproximadas da cidade pelo OpenStreetMap (Nominatim).
async function localizarCidade(cidade: string, uf: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ city: cidade, state: uf, country: "Brasil", format: "json", limit: "1" }).toString();
  try {
    const resposta = await fetch(url, { headers: { "User-Agent": "LanceCerto/0.1" } });
    const [primeiro] = (await resposta.json()) as { lat: string; lon: string }[];
    return primeiro ? { lat: Number(primeiro.lat), lng: Number(primeiro.lon) } : null;
  } catch {
    return null;
  }
}
