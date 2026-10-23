"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";
import { idsMarcados } from "@/lib/ocultos";
import { CATEGORIAS, PUBLICO, UNIDADES, chaveDoProduto } from "@/lib/dominio";
import { lerConvidados } from "@/lib/contatos";

export type EstadoOferta = { erro?: string };

// Lê e confere os campos do formulário da oferta (CamposOferta).
function lerCampos(form: FormData) {
  const produto = String(form.get("produto") ?? "").trim();
  const categoria = String(form.get("categoria"));
  const unidade = String(form.get("unidade"));
  const preco = Number(String(form.get("preco_unitario")).replace(",", "."));
  const quantidade = Number(String(form.get("quantidade_disponivel")).replace(",", "."));
  const vendePara = String(form.get("vende_para"));

  if (!produto) return { erro: "Informe o produto." };
  if (!(categoria in CATEGORIAS) || !(unidade in UNIDADES)) return { erro: "Escolha a categoria e a unidade." };
  if (!(preco > 0) || !(quantidade > 0)) return { erro: "Informe preço e quantidade maiores que zero." };

  return {
    campos: {
      produto,
      categoria,
      unidade,
      preco_unitario: preco,
      quantidade_disponivel: quantidade,
      validade: form.get("validade") || null,
      disponivel_a_partir: form.get("disponivel_a_partir") || null,
      descricao: String(form.get("descricao") ?? "").trim() || null,
      vende_para: vendePara in PUBLICO ? vendePara : "todos",
    },
  };
}

export async function publicarOferta(_: EstadoOferta, form: FormData): Promise<EstadoOferta> {
  const { supabase, empresa } = await exigirEmpresa();
  if (empresa.papel !== "fornecedor") return { erro: "Mude para o modo Vender, no menu, para publicar ofertas." };

  const { campos, erro } = lerCampos(form);
  if (!campos) return { erro };
  const diasValidaOferta = Number(form.get("dias_oferta")) || 7;
  const convidados = await lerConvidados(supabase, empresa.id, "cliente", form);
  if (convidados.erro) return { erro: convidados.erro };

  const { error } = await supabase.from("ofertas").insert({
    ...campos,
    convidados: convidados.convidados,
    fornecedor_id: empresa.id,
    produto_chave: String(form.get("produto_chave") || "") || chaveDoProduto(campos.produto),
    valida_ate: new Date(Date.now() + diasValidaOferta * 86_400_000).toISOString(),
  });
  if (error) return { erro: error.message };
  revalidatePath("/ofertas");
  redirect("/ofertas");
}

export async function editarOferta(_: EstadoOferta, form: FormData): Promise<EstadoOferta> {
  const { supabase, empresa } = await exigirEmpresa();
  const id = String(form.get("id"));
  const { campos, erro } = lerCampos(form);
  if (!campos) return { erro };

  // Prorrogar: conta os dias a partir de agora. "0" mantém o prazo atual.
  const prorrogar = Number(form.get("dias_oferta")) || 0;
  const convidados = await lerConvidados(supabase, empresa.id, "cliente", form);
  if (convidados.erro) return { erro: convidados.erro };
  const { data, error } = await supabase
    .from("ofertas")
    .update({
      ...campos,
      convidados: convidados.convidados,
      // A chave agrupa ofertas iguais na vitrine; só muda se o nome do produto mudou.
      produto_chave:
        campos.produto === form.get("produto_original") ? String(form.get("produto_chave")) : chaveDoProduto(campos.produto),
      ...(prorrogar > 0 && { valida_ate: new Date(Date.now() + prorrogar * 86_400_000).toISOString(), ativa: true }),
    })
    .eq("id", id)
    .eq("fornecedor_id", empresa.id)
    .select("id");
  if (error) return { erro: error.message };
  if (!data?.length) return { erro: "Oferta não encontrada." };
  revalidatePath("/ofertas");
  revalidatePath("/vitrine");
  redirect(empresa.papel === "fornecedor" ? "/ofertas" : "/vitrine");
}

export async function encerrarOferta(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  await supabase.from("ofertas").update({ ativa: false }).eq("id", String(form.get("id"))).eq("fornecedor_id", empresa.id);
  revalidatePath("/ofertas");
  revalidatePath("/vitrine");
}

// Exclui de vez. As compras já feitas continuam no histórico, sem o vínculo com a oferta.
export async function excluirOferta(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  await supabase.from("ofertas").delete().eq("id", String(form.get("id"))).eq("fornecedor_id", empresa.id);
  revalidatePath("/ofertas");
  revalidatePath("/vitrine");
  redirect(empresa.papel === "fornecedor" ? "/ofertas" : "/vitrine");
}

export type ItemFolheto = {
  produto: string;
  produto_chave: string;
  descricao: string;
  categoria: string;
  unidade: string;
  preco_unitario: number;
  quantidade_disponivel: number;
};

// Publica de uma vez os itens do folheto que o vendedor revisou.
export async function publicarFolheto(dados: { itens: ItemFolheto[]; validaAte: string; vendePara: string }): Promise<EstadoOferta> {
  const { supabase, empresa } = await exigirEmpresa();
  if (empresa.papel !== "fornecedor") return { erro: "Mude para o modo Vender, no menu, para publicar ofertas." };
  if (dados.itens.length === 0) return { erro: "Marque pelo menos um item para publicar." };
  if (dados.itens.length > 150) return { erro: "Publique no máximo 150 itens por folheto." };

  // A oferta vale até o fim do dia escolhido, no horário da Paraíba.
  const validaAte = new Date(`${dados.validaAte}T23:59:59-03:00`);
  if (Number.isNaN(validaAte.getTime()) || validaAte < new Date()) return { erro: "Escolha uma data de hoje em diante." };

  const linhas = [];
  for (const item of dados.itens) {
    const produto = String(item.produto ?? "").trim();
    const preco = Number(item.preco_unitario);
    const quantidade = Number(item.quantidade_disponivel);
    if (!produto) return { erro: "Há um item sem nome." };
    if (!(item.categoria in CATEGORIAS) || !(item.unidade in UNIDADES)) return { erro: `Confira a categoria e a unidade de "${produto}".` };
    if (!(preco > 0) || !(quantidade > 0)) return { erro: `Informe preço e estoque maiores que zero em "${produto}".` };
    linhas.push({
      fornecedor_id: empresa.id,
      produto,
      produto_chave: chaveDoProduto(String(item.produto_chave || "")) || chaveDoProduto(produto),
      descricao: String(item.descricao ?? "").trim() || null,
      categoria: item.categoria,
      unidade: item.unidade,
      preco_unitario: preco,
      quantidade_disponivel: quantidade,
      vende_para: dados.vendePara in PUBLICO ? dados.vendePara : "todos",
      valida_ate: validaAte.toISOString(),
    });
  }

  const { error } = await supabase.from("ofertas").insert(linhas);
  if (error) return { erro: error.message };
  revalidatePath("/ofertas");
  revalidatePath("/vitrine");
  redirect("/ofertas");
}

// Exclui de vez as ofertas marcadas; compras já feitas ficam no histórico.
export async function excluirOfertas(form: FormData) {
  const { supabase, empresa } = await exigirEmpresa();
  const ids = idsMarcados(form);
  if (ids.length === 0) return;
  const { error } = await supabase.from("ofertas").delete().in("id", ids).eq("fornecedor_id", empresa.id);
  if (error) throw new Error(error.message);
  revalidatePath("/ofertas");
  revalidatePath("/vitrine");
}
