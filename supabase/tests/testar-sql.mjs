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
await db.exec(readFileSync(new URL("../migrations/0001_inicial.sql", import.meta.url), "utf8"));
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

// Comprador com CPF é recusado.
await assert.rejects(db.exec(`
  insert into auth.users values ('00000000-0000-0000-0000-000000000009');
  insert into empresas (id, papel, tipo_documento, documento, nome, telefone, cidade, uf, lat, lng)
  values ('00000000-0000-0000-0000-000000000009', 'comprador', 'cpf_caf', '12345678909', 'X', '1', 'X', 'PB', 0, 0);
`), /documento_valido/);

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

const vitrine = await como(ids.restaurante, `select fornecedor_nome, preco_unitario from buscar_ofertas('tomate')`);
assert.deepEqual(vitrine.rows.map((r) => r.fornecedor_nome), ["Sítio Boa Vista", "Atacado Litoral"],
  "a distribuidora de Campina Grande fica fora do raio");

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

console.log("Todos os testes do banco passaram.");
