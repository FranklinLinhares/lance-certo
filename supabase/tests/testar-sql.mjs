// Roda a migração num Postgres em memória (PGlite) com um esboço do esquema
// auth do Supabase e verifica as regras de negócio principais.
// Uso: node supabase/tests/testar-sql.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
  create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public, auth to authenticated;
`);
for (const arquivo of ["0001_inicial.sql", "0002_cadastro_unico.sql", "0003_ofertas_vende_para.sql", "0004_avaliacoes.sql", "0005_excluir_ofertas.sql", "0006_contatos.sql", "0007_apagar_usuario.sql", "0008_concluir_negocio.sql"]) {
  await db.exec(readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), "utf8"));
}
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);

const ids = {
  restaurante: "00000000-0000-0000-0000-000000000001", // João Pessoa
  atacado: "00000000-0000-0000-0000-000000000002",     // Cabedelo (~15 km)
  agricultor: "00000000-0000-0000-0000-000000000003",  // Sapé (~45 km)
  longe: "00000000-0000-0000-0000-000000000004",       // Campina Grande (~115 km)
};
await db.exec(`
  insert into auth.users values ('${ids.restaurante}'), ('${ids.atacado}'), ('${ids.agricultor}'), ('${ids.longe}');
  insert into empresas (id, papel, tipo_documento, documento, registro_rural, agricultor, nome, telefone, cidade, uf, lat, lng, raio_km) values
    ('${ids.restaurante}', 'comprador', 'cnpj', '11222333000181', null, false, 'Restaurante Sabor', '83999990001', 'João Pessoa', 'PB', -7.1195, -34.8450, 60),
    ('${ids.atacado}', 'fornecedor', 'cnpj', '22333444000172', null, false, 'Atacado Litoral', '83999990002', 'Cabedelo', 'PB', -6.9811, -34.8339, 30),
    ('${ids.agricultor}', 'fornecedor', 'cpf_caf', '12345678909', 'CAF-123', true, 'Sítio Boa Vista', '83999990003', 'Sapé', 'PB', -7.0936, -35.2328, 80),
    ('${ids.longe}', 'fornecedor', 'cnpj', '33444555000163', null, false, 'Distribuidora Serra', '83999990004', 'Campina Grande', 'PB', -7.2307, -35.8811, 200);
`);

async function como(uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('test.uid', '${uid}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role;`);
  }
}
async function falha(uid, sql, params, trecho) {
  await assert.rejects(como(uid, sql, params), (e) => {
    assert.match(e.message, trecho);
    return true;
  });
}

// CPF com CAF exige o número do registro rural.
await assert.rejects(db.exec(`
  insert into auth.users values ('00000000-0000-0000-0000-000000000009');
  insert into empresas (id, papel, tipo_documento, documento, nome, telefone, cidade, uf, lat, lng)
  values ('00000000-0000-0000-0000-000000000009', 'comprador', 'cpf_caf', '12345678909', 'X', '1', 'X', 'PB', 0, 0);
`), /documento_valido/);
// Pessoa física compra com CPF (cadastro único).
ids.pessoa = "00000000-0000-0000-0000-000000000005"; // João Pessoa
await db.exec(`
  insert into auth.users values ('${ids.pessoa}');
  insert into empresas (id, papel, tipo_documento, documento, nome, nome_completo, telefone, cidade, uf, lat, lng, raio_km)
  values ('${ids.pessoa}', 'comprador', 'cpf', '52998224725', 'Maria Souza', 'Maria Souza', '83999990005', 'João Pessoa', 'PB', -7.12, -34.85, 60);
`);

// Ofertas na vitrine.
await como(ids.atacado, `insert into ofertas (fornecedor_id, produto, produto_chave, categoria, unidade, preco_unitario, quantidade_disponivel)
  values ($1, 'Tomate italiano cx 20kg', 'tomate-italiano', 'hortifruti', 'kg', 4.50, 400)`, [ids.atacado]);
await como(ids.agricultor, `insert into ofertas (fornecedor_id, produto, produto_chave, categoria, unidade, preco_unitario, quantidade_disponivel)
  values ($1, 'Tomate italiano', 'tomate-italiano', 'hortifruti', 'kg', 3.90, 200)`, [ids.agricultor]);
await como(ids.longe, `insert into ofertas (fornecedor_id, produto, produto_chave, categoria, unidade, preco_unitario, quantidade_disponivel)
  values ($1, 'Tomate', 'tomate-italiano', 'hortifruti', 'kg', 2.00, 1000)`, [ids.longe]);
// Comprador não publica oferta.
await falha(ids.restaurante, `insert into ofertas (fornecedor_id, produto, produto_chave, categoria, unidade, preco_unitario, quantidade_disponivel)
  values ($1, 'x', 'x', 'graos', 'kg', 1, 1)`, [ids.restaurante], /row-level security/);

const vitrine = await como(ids.restaurante, `select fornecedor_nome, preco_unitario from vitrine_ofertas('tomate')`);
assert.deepEqual(vitrine.rows.map((r) => r.fornecedor_nome), ["Sítio Boa Vista", "Atacado Litoral"],
  "a distribuidora de Campina Grande fica fora do raio");

// Pessoa física também vê a vitrine.
assert.equal((await como(ids.pessoa, `select * from vitrine_ofertas('tomate')`)).rows.length, 2);
// Fornecedor que só vende para empresas some da vitrine da pessoa física.
await db.exec(`update empresas set negocia_com = 'pj' where id = '${ids.atacado}'`);
assert.deepEqual((await como(ids.pessoa, `select fornecedor_nome from vitrine_ofertas('tomate')`)).rows.map((r) => r.fornecedor_nome), ["Sítio Boa Vista"]);
assert.equal((await como(ids.restaurante, `select * from vitrine_ofertas('tomate')`)).rows.length, 2, "o restaurante tem CNPJ");
await db.exec(`update empresas set negocia_com = 'todos' where id = '${ids.atacado}'`);
// Oferta só para empresas: some para a pessoa física e não pode ser comprada por ela.
await db.exec(`update ofertas set vende_para = 'pj' where fornecedor_id = '${ids.agricultor}'`);
assert.deepEqual((await como(ids.pessoa, `select fornecedor_nome from vitrine_ofertas('tomate')`)).rows.map((r) => r.fornecedor_nome), ["Atacado Litoral"]);
const soEmpresas = (await db.query(`select id from ofertas where fornecedor_id = $1`, [ids.agricultor])).rows[0].id;
await falha(ids.pessoa, `select comprar_oferta($1, 1)`, [soEmpresas], /só para empresas/);
const paraRestaurante = await como(ids.restaurante, `select fornecedor_nome, fornecedor_pj from vitrine_ofertas('tomate')`);
assert.equal(paraRestaurante.rows.length, 2, "o restaurante tem CNPJ e vê a oferta só para empresas");
assert.equal(paraRestaurante.rows.find((r) => r.fornecedor_nome === "Sítio Boa Vista").fornecedor_pj, false, "agricultor com CPF");
await db.exec(`update ofertas set vende_para = 'todos' where fornecedor_id = '${ids.agricultor}'`);
// No modo Comprar a conta vê a própria oferta, mas não consegue comprá-la.
await db.exec(`update empresas set papel = 'comprador' where id = '${ids.atacado}'`);
assert.ok((await como(ids.atacado, `select fornecedor_nome from vitrine_ofertas('tomate')`)).rows.some((r) => r.fornecedor_nome === "Atacado Litoral"),
  "a própria oferta aparece na vitrine (marcada como sua no app)");
const propria = (await db.query(`select id from ofertas where fornecedor_id = $1`, [ids.atacado])).rows[0].id;
await falha(ids.atacado, `select comprar_oferta($1, 1)`, [propria], /própria oferta/);
await db.exec(`update empresas set papel = 'fornecedor' where id = '${ids.atacado}'`);

// Pedido aberto (lances visíveis) e pedido fechado (lances ocultos).
const amanha = "now() + interval '1 day'";
const aberto = (await como(ids.restaurante, `insert into pedidos (comprador_id, produto, produto_chave, categoria, unidade, quantidade, preco_maximo, lances_visiveis, encerra_em)
  values ($1, 'Arroz branco tipo 1', 'arroz-branco-tipo-1', 'graos', 'kg', 100, 6.00, true, ${amanha}) returning id`, [ids.restaurante])).rows[0].id;
const fechado = (await como(ids.restaurante, `insert into pedidos (comprador_id, produto, produto_chave, categoria, unidade, quantidade, lances_visiveis, encerra_em)
  values ($1, 'Feijão carioca', 'feijao-carioca', 'graos', 'kg', 50, false, ${amanha}) returning id`, [ids.restaurante])).rows[0].id;

const proximos = await como(ids.atacado, `select produto from pedidos_proximos()`);
assert.equal(proximos.rows.length, 2);
assert.equal((await como(ids.longe, `select * from pedidos_proximos()`)).rows.length, 0);
assert.equal((await como(ids.atacado, `select compradores_interessados('arroz-branco-tipo-1') n`)).rows[0].n, 1);

// Lances no leilão aberto.
await falha(ids.atacado, `select dar_lance($1, 6.50)`, [aberto], /no máximo/);
await como(ids.atacado, `select dar_lance($1, 5.80)`, [aberto]);
await falha(ids.agricultor, `select dar_lance($1, 5.80)`, [aberto], /menor que o menor lance atual/);
await como(ids.agricultor, `select dar_lance($1, 5.50)`, [aberto]);
await falha(ids.longe, `select dar_lance($1, 4.00)`, [aberto], /fora do seu raio/);
await falha(ids.restaurante, `select dar_lance($1, 4.00)`, [aberto], /Apenas fornecedores/);
// No leilão aberto o concorrente vê os preços.
assert.equal((await como(ids.atacado, `select * from lances where pedido_id = $1`, [aberto])).rows.length, 2);

// Leilão fechado: cada fornecedor só precisa baixar o próprio lance e não vê o do outro.
await como(ids.atacado, `select dar_lance($1, 8.00)`, [fechado]);
await como(ids.agricultor, `select dar_lance($1, 9.00)`, [fechado]);
await falha(ids.agricultor, `select dar_lance($1, 9.00)`, [fechado], /seu lance anterior/);
assert.equal((await como(ids.agricultor, `select * from lances where pedido_id = $1`, [fechado])).rows.length, 1);
assert.equal((await como(ids.restaurante, `select * from lances where pedido_id = $1`, [fechado])).rows.length, 2);

// Prorrogação: lance nos últimos 5 minutos empurra o encerramento.
await db.query(`update pedidos set encerra_em = now() + interval '1 minute' where id = $1`, [aberto]);
await como(ids.atacado, `select dar_lance($1, 5.40)`, [aberto]);
const restante = (await db.query(`select extract(epoch from encerra_em - now()) s from pedidos where id = $1`, [aberto])).rows[0].s;
assert.ok(Number(restante) > 290, "encerramento prorrogado para 5 minutos");

// Fechamento: só o comprador escolhe; a compra entra no histórico.
const vencedor = (await db.query(`select id from lances where pedido_id = $1 order by preco_unitario limit 1`, [aberto])).rows[0].id;
await falha(ids.atacado, `select fechar_pedido($1, $2)`, [aberto, vencedor], /não encontrado/);
await como(ids.restaurante, `select fechar_pedido($1, $2)`, [aberto, vencedor]);
await falha(ids.agricultor, `select dar_lance($1, 5.00)`, [aberto], /encerrado/);

// Compra pela vitrine baixa o estoque.
const ofertaAgricultor = (await db.query(`select id from ofertas where fornecedor_id = $1`, [ids.agricultor])).rows[0].id;
await falha(ids.restaurante, `select comprar_oferta($1, 500)`, [ofertaAgricultor], /Quantidade indisponível/);
await como(ids.restaurante, `select comprar_oferta($1, 50)`, [ofertaAgricultor]);
assert.equal(Number((await db.query(`select quantidade_disponivel q from ofertas where id = $1`, [ofertaAgricultor])).rows[0].q), 150);

// Histórico semanal com variação.
await como(ids.restaurante, `insert into compras (comprador_id, fornecedor_nome, produto, produto_chave, categoria, unidade, quantidade, preco_unitario, origem, data)
  values ($1, 'Feira', 'Tomate italiano', 'tomate-italiano', 'hortifruti', 'kg', 50, 3.00, 'externa', current_date - 7)`, [ids.restaurante]);
const hist = await como(ids.restaurante, `select semana, preco_medio, variacao_pct from historico_semanal where produto_chave = 'tomate-italiano' order by semana`);
assert.equal(hist.rows.length, 2);
assert.equal(Number(hist.rows[1].variacao_pct), 30, "tomate passou de 3,00 para 3,90 (+30%)");
// Fornecedor não vê o histórico de compras de outros fornecedores.
assert.equal((await como(ids.atacado, `select * from compras where produto_chave = 'tomate-italiano'`)).rows.length, 0);

const media = await como(ids.restaurante, `select * from preco_medio_regional('arroz-branco-tipo-1')`);
assert.equal(Number(media.rows[0].preco_medio), 5.4);

// Avaliações: o comprador avalia o vendedor e o vendedor avalia o comprador.
const compraVitrine = (await db.query(`select id from compras where oferta_id = $1`, [ofertaAgricultor])).rows[0].id;
// Só avalia depois que os dois confirmam que o negócio foi concluído.
await falha(ids.restaurante, `select avaliar($1, 5)`, [compraVitrine], /confirmarem/);
await falha(ids.atacado, `select concluir_negocio($1)`, [compraVitrine], /não encontrado/);
await como(ids.restaurante, `select concluir_negocio($1)`, [compraVitrine]);
await falha(ids.agricultor, `select avaliar($1, 4)`, [compraVitrine], /confirmarem/);
await como(ids.agricultor, `select concluir_negocio($1)`, [compraVitrine]);
await como(ids.restaurante, `select avaliar($1, 5, 'Tomate ótimo, entrega no prazo')`, [compraVitrine]);
await como(ids.agricultor, `select avaliar($1, 4, 'Pagou certinho')`, [compraVitrine]);
await falha(ids.atacado, `select avaliar($1, 1)`, [compraVitrine], /não encontrado/);
await falha(ids.restaurante, `select avaliar($1, 6)`, [compraVitrine], /de 1 a 5/);
const externa = (await db.query(`select id from compras where origem = 'externa' limit 1`)).rows[0].id;
await falha(ids.restaurante, `select avaliar($1, 5)`, [externa], /fora do app/);
// Avaliar de novo substitui a nota anterior.
await como(ids.restaurante, `select avaliar($1, 3)`, [compraVitrine]);
const rep = (await como(ids.restaurante, `select * from reputacao($1)`, [[ids.agricultor, ids.restaurante]])).rows;
const doAgricultor = rep.find((r) => r.empresa_id === ids.agricultor);
const doRestaurante = rep.find((r) => r.empresa_id === ids.restaurante);
assert.equal(Number(doAgricultor.nota_vendedor), 3);
assert.equal(Number(doAgricultor.avaliacoes_vendedor), 1);
assert.equal(Number(doAgricultor.vendas), 1);
assert.equal(Number(doRestaurante.nota_comprador), 4);
assert.equal(Number(doRestaurante.compras), 2, "uma compra no leilão e uma na vitrine; a externa não conta");
// Ninguém grava avaliação direto na tabela.
await falha(ids.restaurante, `insert into avaliacoes (compra_id, avaliador_id, avaliado_id, avaliado_como, nota) values ($1, $2, $3, 'vendedor', 5)`,
  [compraVitrine, ids.restaurante, ids.atacado], /row-level security/);

// Editar e excluir ofertas: só o próprio vendedor.
await como(ids.atacado, `update ofertas set ativa = false where id = $1`, [ofertaAgricultor]);
await como(ids.atacado, `delete from ofertas where id = $1`, [ofertaAgricultor]);
assert.equal((await db.query(`select ativa from ofertas where id = $1`, [ofertaAgricultor])).rows[0].ativa, true,
  "outro vendedor não altera nem exclui a oferta");
await como(ids.agricultor, `update ofertas set preco_unitario = 3.50 where id = $1`, [ofertaAgricultor]);
assert.equal(Number((await db.query(`select preco_unitario p from ofertas where id = $1`, [ofertaAgricultor])).rows[0].p), 3.5);
await como(ids.agricultor, `delete from ofertas where id = $1`, [ofertaAgricultor]);
assert.equal((await db.query(`select 1 from ofertas where id = $1`, [ofertaAgricultor])).rows.length, 0);
// A compra feita antes continua no histórico, e a avaliação também.
const compraMantida = (await db.query(`select oferta_id from compras where id = $1`, [compraVitrine])).rows[0];
assert.equal(compraMantida.oferta_id, null);
assert.equal((await db.query(`select 1 from avaliacoes where compra_id = $1`, [compraVitrine])).rows.length, 2);

// Contatos: cada conta vê e gerencia só os próprios.
await como(ids.restaurante, `insert into contatos (dono_id, contato_id, tipo) values ($1, $2, 'fornecedor')`, [ids.restaurante, ids.longe]);
assert.equal((await como(ids.atacado, `select * from contatos`)).rows.length, 0, "outra conta não vê os contatos do restaurante");
await falha(ids.atacado, `insert into contatos (dono_id, contato_id, tipo) values ($1, $2, 'cliente')`, [ids.restaurante, ids.atacado], /row-level security/);
const achados = (await como(ids.restaurante, `select nome from encontrar_empresas('serra')`)).rows;
assert.deepEqual(achados.map((r) => r.nome), ["Distribuidora Serra"]);
assert.equal((await como(ids.restaurante, `select * from encontrar_empresas('ab')`)).rows.length, 0, "busca curta não lista ninguém");

// Leilão só para convidados: o convidado de longe participa; o vizinho não convidado não vê.
await db.exec(`update empresas set papel = 'fornecedor' where id in ('${ids.longe}', '${ids.atacado}')`);
const convite = (await como(ids.restaurante, `insert into pedidos (comprador_id, produto, produto_chave, categoria, unidade, quantidade, encerra_em, convidados)
  values ($1, 'Feijão', 'feijao', 'graos', 'kg', 100, now() + interval '1 day', array[$2]::uuid[]) returning id`, [ids.restaurante, ids.longe])).rows[0].id;
assert.ok((await como(ids.longe, `select id from pedidos_proximos()`)).rows.some((r) => r.id === convite), "convidado vê mesmo fora do raio");
assert.ok(!(await como(ids.atacado, `select id from pedidos_proximos()`)).rows.some((r) => r.id === convite), "não convidado não vê");
await como(ids.longe, `select dar_lance($1, 7.00)`, [convite]);
await falha(ids.atacado, `select dar_lance($1, 6.00)`, [convite], /convidados/);

// Oferta só para clientes escolhidos.
const ofertaFechada = (await como(ids.atacado, `insert into ofertas (fornecedor_id, produto, produto_chave, categoria, unidade, preco_unitario, quantidade_disponivel, convidados)
  values ($1, 'Arroz', 'arroz', 'graos', 'kg', 5, 100, array[$2]::uuid[]) returning id`, [ids.atacado, ids.restaurante])).rows[0].id;
assert.ok((await como(ids.restaurante, `select id from vitrine_ofertas('arroz')`)).rows.some((r) => r.id === ofertaFechada));
assert.ok(!(await como(ids.pessoa, `select id from vitrine_ofertas('arroz')`)).rows.some((r) => r.id === ofertaFechada), "quem não é cliente não vê");
await falha(ids.pessoa, `select comprar_oferta($1, 1)`, [ofertaFechada], /clientes escolhidos/);
await como(ids.restaurante, `select comprar_oferta($1, 1)`, [ofertaFechada]);

// Dá para apagar um fornecedor que venceu um leilão; o pedido fica sem vencedor.
const pedidoGanho = (await db.query(`select id from pedidos where lance_vencedor_id is not null limit 1`)).rows[0].id;
const vencedorDoPedido = (await db.query(`select l.fornecedor_id f from pedidos p join lances l on l.id = p.lance_vencedor_id where p.id = $1`, [pedidoGanho])).rows[0].f;
await db.query(`delete from auth.users where id = $1`, [vencedorDoPedido]);
assert.equal((await db.query(`select lance_vencedor_id from pedidos where id = $1`, [pedidoGanho])).rows[0].lance_vencedor_id, null);

console.log("Todos os testes do banco passaram.");
