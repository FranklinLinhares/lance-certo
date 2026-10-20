import { CATEGORIAS, PUBLICO, UNIDADES, type Categoria, type Publico, type Unidade } from "@/lib/dominio";

export type ValoresOferta = {
  produto?: string;
  categoria?: Categoria;
  unidade?: Unidade;
  preco_unitario?: number | string;
  quantidade?: number | string;
  validade?: string | null;
  disponivel_a_partir?: string | null;
  vende_para?: Publico;
  descricao?: string | null;
};

// Campos da oferta, usados para publicar e para editar.
export function CamposOferta({ valores }: { valores: ValoresOferta }) {
  return (
    <>
      <div>
        <label className="rotulo" htmlFor="produto">Produto</label>
        <input id="produto" name="produto" required defaultValue={valores.produto} className="campo" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="rotulo" htmlFor="categoria">Categoria</label>
          <select id="categoria" name="categoria" defaultValue={valores.categoria} className="campo">
            {Object.entries(CATEGORIAS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="unidade">Unidade</label>
          <select id="unidade" name="unidade" defaultValue={valores.unidade} className="campo">
            {Object.entries(UNIDADES).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="rotulo" htmlFor="preco_unitario">Preço por unidade (R$)</label>
          <input id="preco_unitario" name="preco_unitario" required inputMode="decimal" defaultValue={valores.preco_unitario ?? ""} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="quantidade_disponivel">Quantidade disponível</label>
          <input id="quantidade_disponivel" name="quantidade_disponivel" required inputMode="decimal" defaultValue={valores.quantidade ?? ""} className="campo" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="rotulo" htmlFor="validade">Validade do produto</label>
          <input id="validade" name="validade" type="date" defaultValue={valores.validade ?? ""} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="disponivel_a_partir">Disponível a partir de</label>
          <input id="disponivel_a_partir" name="disponivel_a_partir" type="date" defaultValue={valores.disponivel_a_partir ?? ""} className="campo" />
          <p className="mt-1 text-xs text-stone-500">Para ofertas de safra ainda não colhida.</p>
        </div>
      </div>
      <div>
        <label className="rotulo" htmlFor="vende_para">Vender para</label>
        <select id="vende_para" name="vende_para" defaultValue={valores.vende_para ?? "todos"} className="campo">
          {Object.entries(PUBLICO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="descricao">Detalhes</label>
        <textarea id="descricao" name="descricao" rows={2} defaultValue={valores.descricao ?? ""} className="campo" />
      </div>
    </>
  );
}
