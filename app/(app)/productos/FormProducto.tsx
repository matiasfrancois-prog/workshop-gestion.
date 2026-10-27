import { guardarProducto } from "./actions";

type Props = {
  producto?: {
    id: number;
    nombre: string;
    codigo: string | null;
    codigo_barras: string | null;
    costo_usd: number;
    stock_minimo: number;
    activo: boolean;
    notas: string | null;
    marca: string | null;
    categoria: string | null;
  };
  listas: { id: number; nombre: string; margen_pct: number | null }[];
  preciosManuales: Record<number, number>;
  marcas: string[];
  categorias: string[];
  esAdmin: boolean;
};

export default function FormProducto({ producto: p, listas, preciosManuales, marcas, categorias, esAdmin }: Props) {
  return (
    <form action={guardarProducto} className="space-y-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="card space-y-3">
        <div>
          <label className="label">Nombre *</label>
          <input className="input" name="nombre" defaultValue={p?.nombre} required placeholder="Samsung A17 4G 128GB" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Marca</label>
            <input className="input" name="marca" list="marcas" defaultValue={p?.marca ?? ""} />
            <datalist id="marcas">{marcas.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <label className="label">Categoría</label>
            <input className="input" name="categoria" list="categorias" defaultValue={p?.categoria ?? ""} />
            <datalist id="categorias">{categorias.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <label className="label">Código</label>
            <input className="input" name="codigo" defaultValue={p?.codigo ?? ""} />
          </div>
          <div>
            <label className="label">Código de barras</label>
            <input className="input" name="codigo_barras" inputMode="numeric" defaultValue={p?.codigo_barras ?? ""} />
          </div>
          <div>
            <label className="label">Stock mínimo</label>
            <input className="input" name="stock_minimo" type="number" inputMode="numeric" defaultValue={p?.stock_minimo ?? 0} />
          </div>
          {esAdmin ? (
            <div>
              <label className="label">Costo US$</label>
              <input className="input" name="costo_usd" type="number" step="0.01" inputMode="decimal" defaultValue={p?.costo_usd ?? ""} />
            </div>
          ) : (
            <input type="hidden" name="costo_usd" value={p?.costo_usd ?? 0} />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={p?.activo ?? true} className="size-5 accent-marca" /> Activo
        </label>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Precios de venta (US$)</h2>
        <p className="text-xs text-suave">Dejá vacío para que se calcule con el margen de la lista.</p>
        <div className="grid grid-cols-2 gap-3">
          {listas.map((l) => (
            <div key={l.id}>
              <label className="label">
                {l.nombre} {l.margen_pct !== null && <span className="text-suave">(+{Number(l.margen_pct)}%)</span>}
              </label>
              <input
                className="input"
                name={`precio_${l.id}`}
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={preciosManuales[l.id] ?? ""}
                placeholder={l.margen_pct !== null && p ? String((Number(p.costo_usd) * (1 + Number(l.margen_pct) / 100)).toFixed(2)) : ""}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <label className="label">Notas internas</label>
        <textarea className="input h-20 py-2" name="notas" defaultValue={p?.notas ?? ""} />
      </div>

      <button className="btn-primario w-full">Guardar</button>
    </form>
  );
}
