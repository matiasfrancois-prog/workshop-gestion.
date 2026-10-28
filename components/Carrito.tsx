"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { crearComprobante, nuevasSeries, type CobroNuevo, type NuevoComprobante } from "@/app/(app)/comprobantes/actions";
import { money, num, TIPOS, type Moneda } from "@/lib/format";
import CamposCobro, { type Caja } from "./CamposCobro";
import Escaner from "./Escaner";

export type ProductoVenta = {
  id: number;
  nombre: string;
  stock: number;
  reservado: number;
  costo: number;
  llevaSerie: boolean;
  precios: Record<number, number>;
};
export type Tercero = { id: number; nombre: string; lista_id: number | null; saldo_usd: number; saldo_ars: number; habilitado: boolean; limite: number | null };
export type LineaInicial = { producto_id: number | null; descripcion: string; cantidad: number; precio_unit: number };
type Linea = LineaInicial & { key: number; series: string[] };

type Props = {
  modo: "venta" | "compra";
  tipoInicial: NuevoComprobante["tipo"];
  terceros: Tercero[];
  terceroInicial: number | null;
  productos: ProductoVenta[];
  disponibles: Record<number, string[]>; // series en stock por producto
  listaDefault: number | null;
  verCostos: boolean;
  cajas: Caja[];
  cotizacion: number;
  lineasIniciales?: LineaInicial[];
  monedaInicial?: Moneda;
  origenId?: number | null;
};

const TIPOS_VENTA = ["venta", "pedido", "presupuesto", "nc_venta"] as const;
const TIPOS_COMPRA = ["compra", "nc_compra"] as const;
const MUEVE = ["venta", "nc_venta", "compra", "nc_compra"];

export default function Carrito(props: Props) {
  const { modo, terceros, productos, disponibles, listaDefault, verCostos, cajas, cotizacion } = props;
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<NuevoComprobante["tipo"]>(props.tipoInicial);
  const [terceroId, setTerceroId] = useState<number | null>(props.terceroInicial);
  const [buscaTercero, setBuscaTercero] = useState("");
  const [moneda, setMoneda] = useState<Moneda>(props.monedaInicial ?? "USD");
  const [lineas, setLineas] = useState<Linea[]>(() =>
    (props.lineasIniciales ?? []).map((l, i) => ({ ...l, key: i + 1, series: [] })),
  );
  const [busca, setBusca] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conCobro, setConCobro] = useState(false);
  const [cobro, setCobro] = useState<CobroNuevo | null>(null);

  const mueve = MUEVE.includes(tipo);
  const eligeDeStock = tipo === "venta" || tipo === "nc_compra"; // las series salen del stock
  const tercero = terceros.find((t) => t.id === terceroId) ?? null;
  const listaId = tercero?.lista_id ?? listaDefault;
  const prodPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const productoDeSerie = useMemo(() => {
    const m = new Map<string, number>();
    for (const [pid, ss] of Object.entries(disponibles)) for (const s of ss) m.set(s, Number(pid));
    return m;
  }, [disponibles]);

  const usaSeries = (l: Linea) => mueve && !!l.producto_id && !!prodPorId.get(l.producto_id)?.llevaSerie;
  const cant = (l: Linea) => (usaSeries(l) ? l.series.length : l.cantidad);

  const tercerosFiltrados = useMemo(() => {
    const q = buscaTercero.toLowerCase().trim();
    if (!q) return terceros.slice(0, 8);
    return terceros.filter((t) => t.nombre.toLowerCase().includes(q)).slice(0, 12);
  }, [buscaTercero, terceros]);

  const resultados = useMemo(() => {
    const palabras = busca.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return [];
    return productos.filter((p) => palabras.every((w) => p.nombre.toLowerCase().includes(w))).slice(0, 15);
  }, [busca, productos]);

  const total = lineas.reduce((a, l) => a + cant(l) * l.precio_unit, 0);
  const costoTotal = lineas.reduce((a, l) => a + cant(l) * (prodPorId.get(l.producto_id ?? 0)?.costo ?? 0), 0);

  function precioSugerido(p: ProductoVenta) {
    if (modo === "compra") return p.costo;
    return listaId ? p.precios[listaId] ?? 0 : 0;
  }

  function agregar(p: ProductoVenta, series: string[] = []) {
    setLineas((ls) => {
      const existe = ls.find((l) => l.producto_id === p.id);
      if (existe) {
        return ls.map((l) =>
          l === existe ? { ...l, cantidad: series.length ? l.cantidad : l.cantidad + 1, series: [...new Set([...l.series, ...series])] } : l,
        );
      }
      return [...ls, { key: Date.now() + Math.random(), producto_id: p.id, descripcion: p.nombre, cantidad: 1, precio_unit: precioSugerido(p), series }];
    });
    setBusca("");
  }

  function setLinea(key: number, cambio: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...cambio } : l)));
  }

  function agregarSeries(l: Linea, codigos: string[]) {
    setError(null);
    let nuevos = codigos;
    if (eligeDeStock) {
      const disp = new Set(disponibles[l.producto_id!] ?? []);
      const malos = codigos.filter((c) => !disp.has(c));
      if (malos.length) setError(`No están en stock de ${l.descripcion}: ${malos.join(", ")}`);
      nuevos = codigos.filter((c) => disp.has(c));
    }
    setLinea(l.key, { series: [...new Set([...l.series, ...nuevos])] });
  }

  /** Escaneo general: encuentra el producto por la serie y lo suma. */
  function escaneoGeneral(codigos: string[]) {
    setError(null);
    const noEncontrados: string[] = [];
    for (const c of codigos) {
      const pid = productoDeSerie.get(c);
      const p = pid ? prodPorId.get(pid) : undefined;
      if (p) agregar(p, [c]);
      else noEncontrados.push(c);
    }
    if (noEncontrados.length) setError(`No encontrados en stock: ${noEncontrados.join(", ")}`);
  }

  function guardar() {
    setError(null);
    if (!tercero) return setError(modo === "venta" ? "Elegí un cliente." : "Elegí un proveedor.");
    if (lineas.length === 0) return setError("Agregá al menos un producto.");
    const sinSerie = lineas.find((l) => usaSeries(l) && l.series.length === 0);
    if (sinSerie) return setError(`Cargá los IMEI / series de ${sinSerie.descripcion}.`);
    if (lineas.some((l) => !(cant(l) > 0))) return setError("Revisá las cantidades.");
    if (lineas.some((l) => !l.descripcion.trim())) return setError("Hay una línea sin descripción.");
    startTransition(async () => {
      const r = await crearComprobante(
        {
          tipo,
          cliente_id: modo === "venta" ? tercero.id : null,
          proveedor_id: modo === "compra" ? tercero.id : null,
          moneda,
          items: lineas.map((l) => ({
            producto_id: l.producto_id,
            descripcion: l.descripcion,
            cantidad: cant(l),
            precio_unit: l.precio_unit,
            series: usaSeries(l) ? l.series : [],
          })),
          observaciones: obs.trim() || null,
          origen_id: props.origenId ?? null,
        },
        conCobro && (tipo === "venta" || tipo === "compra") ? cobro : null,
      );
      if (r.error) setError(r.error);
      else router.push(`/comprobantes/${r.id}?nuevo=1${r.recibo ? `&recibo=${r.recibo}` : ""}${r.errorCobro ? `&error=${encodeURIComponent("El comprobante se guardó pero el cobro no: " + r.errorCobro)}` : ""}`);
    });
  }

  const excedeLimite =
    tercero?.limite != null && modo === "venta" && tipo === "venta" && tercero.saldo_usd + (moneda === "USD" ? total : 0) > tercero.limite;

  return (
    <div className="space-y-3 pb-24">
      <div className="flex gap-2 overflow-x-auto -mx-3 px-3">
        {(modo === "venta" ? TIPOS_VENTA : TIPOS_COMPRA).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`chip h-9 px-3 whitespace-nowrap border ${tipo === t ? "bg-marca text-white border-marca" : "bg-white border-linea"}`}
          >
            {TIPOS[t].label}
          </button>
        ))}
      </div>

      {/* Cliente / proveedor */}
      <section className="card space-y-2">
        {tercero ? (
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-xs text-suave">{modo === "venta" ? "Cliente" : "Proveedor"}</p>
              <p className="font-semibold">{tercero.nombre}</p>
              <p className="text-xs mt-0.5">
                Saldo: <b className={tercero.saldo_usd > 0 ? "text-mal" : "text-ok"}>{money(tercero.saldo_usd)}</b>
                {tercero.saldo_ars !== 0 && <> · <b className={tercero.saldo_ars > 0 ? "text-mal" : "text-ok"}>{money(tercero.saldo_ars, "ARS")}</b></>}
              </p>
              {!tercero.habilitado && <p className="text-xs text-mal font-semibold mt-1">⚠️ Cliente deshabilitado</p>}
              {modo === "venta" && tercero.saldo_usd > 0 && tipo !== "presupuesto" && (
                <p className="text-xs text-mal mt-1">⚠️ Tiene deuda. Confirmá con Matías o Andrea antes de entregar.</p>
              )}
            </div>
            <button type="button" className="text-sm text-marca font-semibold" onClick={() => setTerceroId(null)}>Cambiar</button>
          </div>
        ) : (
          <>
            <input className="input" placeholder={modo === "venta" ? "Buscar cliente…" : "Buscar proveedor…"} value={buscaTercero} onChange={(e) => setBuscaTercero(e.target.value)} />
            <div className="divide-y divide-linea">
              {tercerosFiltrados.map((t) => (
                <button key={t.id} type="button" className="w-full text-left py-2.5 flex justify-between" onClick={() => setTerceroId(t.id)}>
                  <span>{t.nombre}</span>
                  {t.saldo_usd !== 0 && <span className={`text-sm ${t.saldo_usd > 0 ? "text-mal" : "text-ok"}`}>{money(t.saldo_usd)}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Agregar productos */}
      <section className="card space-y-2">
        {eligeDeStock && (
          <>
            <p className="text-xs text-suave">Escaneá el IMEI y se agrega solo el producto:</p>
            <Escaner onCodigos={escaneoGeneral} />
            <p className="text-xs text-suave pt-1">O buscá por nombre:</p>
          </>
        )}
        <input className="input" placeholder="Agregar producto: a07 128…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {resultados.length > 0 && (
          <div className="divide-y divide-linea">
            {resultados.map((p) => {
              const disp = p.stock - p.reservado;
              return (
                <button key={p.id} type="button" onClick={() => agregar(p)} className="w-full text-left py-2.5 flex items-center gap-2">
                  <span className="flex-1">📱 {p.nombre}</span>
                  <span className={`text-xs ${disp <= 0 ? "text-mal" : "text-suave"}`}>{modo === "venta" ? `${num(disp)} disp.` : `${num(p.stock)} en stock`}</span>
                  <span className="font-semibold text-sm">{money(precioSugerido(p))}</span>
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          className="text-sm text-marca font-semibold"
          onClick={() => setLineas((ls) => [...ls, { key: Date.now(), producto_id: null, descripcion: "", cantidad: 1, precio_unit: 0, series: [] }])}
        >
          + Línea libre (sin stock)
        </button>
      </section>

      {lineas.map((l) => (
        <LineaCarrito
          key={l.key}
          l={l}
          p={l.producto_id ? prodPorId.get(l.producto_id) : undefined}
          usaSeries={usaSeries(l)}
          eligeDeStock={eligeDeStock}
          esCompra={tipo === "compra"}
          tipo={tipo}
          moneda={moneda}
          disponibles={disponibles[l.producto_id ?? 0] ?? []}
          onCambio={(c) => setLinea(l.key, c)}
          onSeries={(cs) => agregarSeries(l, cs)}
          onQuitar={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}
        />
      ))}

      <section className="card space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["USD", "ARS"] as Moneda[]).map((m) => (
            <button key={m} type="button" onClick={() => setMoneda(m)} className={`h-10 rounded-xl border font-semibold ${moneda === m ? "bg-marca text-white border-marca" : "bg-white border-linea"}`}>
              {m === "USD" ? "Dólares" : "Pesos"}
            </button>
          ))}
        </div>
        <textarea className="input h-16 py-2" placeholder="Observaciones" value={obs} onChange={(e) => setObs(e.target.value)} />
      </section>

      {(tipo === "venta" || tipo === "compra") && (
        <section className="card space-y-3">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" className="size-5 accent-marca" checked={conCobro} onChange={(e) => setConCobro(e.target.checked)} />
            {tipo === "venta" ? "Cobrar ahora" : "Pagar ahora"}
          </label>
          {conCobro && (
            <CamposCobro
              key={`${moneda}-${Math.round(total)}`}
              cajas={cajas}
              cotizacion={cotizacion}
              monedaCuenta={moneda}
              importeSugerido={total}
              onChange={setCobro}
            />
          )}
          {!conCobro && <p className="text-xs text-suave">Si no se cobra ahora, queda en cuenta corriente.</p>}
        </section>
      )}

      {excedeLimite && <p className="card text-sm text-mal">⚠️ Con esta venta supera el límite de crédito ({money(tercero!.limite)}).</p>}
      {error && <p className="card text-sm text-mal">{error}</p>}

      <div className="fixed bottom-16 inset-x-0 z-20 bg-white border-t border-linea pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-xs text-suave">Total {TIPOS[tipo].label.toLowerCase()}</p>
            <p className="text-xl font-bold">{money(total, moneda)}</p>
            {verCostos && modo === "venta" && moneda === "USD" && total > 0 && costoTotal > 0 && (
              <p className="text-[11px] text-suave">Ganancia {money(total - costoTotal)} ({(((total - costoTotal) / costoTotal) * 100).toFixed(1)}%)</p>
            )}
          </div>
          <button type="button" onClick={guardar} disabled={pendiente} className="btn-primario px-6">
            {pendiente ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineaCarrito({
  l,
  p,
  usaSeries,
  eligeDeStock,
  esCompra,
  tipo,
  moneda,
  disponibles,
  onCambio,
  onSeries,
  onQuitar,
}: {
  l: Linea;
  p?: ProductoVenta;
  usaSeries: boolean;
  eligeDeStock: boolean;
  esCompra: boolean;
  tipo: string;
  moneda: Moneda;
  disponibles: string[];
  onCambio: (c: Partial<Linea>) => void;
  onSeries: (c: string[]) => void;
  onQuitar: () => void;
}) {
  const [verLista, setVerLista] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [autoN, setAutoN] = useState("");
  const [generando, startGen] = useTransition();
  const cantidad = usaSeries ? l.series.length : l.cantidad;
  const libres = disponibles.filter((s) => !l.series.includes(s) && s.includes(filtro.toUpperCase()));
  const faltaStock = !esCompra && (tipo === "venta" || tipo === "pedido") && p && !usaSeries && l.cantidad > p.stock - p.reservado;

  return (
    <section className="card space-y-2">
      <div className="flex gap-2 items-start">
        {l.producto_id ? (
          <p className="flex-1 font-medium">📱 {l.descripcion}</p>
        ) : (
          <input className="input h-10 flex-1" placeholder="Descripción" value={l.descripcion} onChange={(e) => onCambio({ descripcion: e.target.value })} />
        )}
        <button type="button" className="text-mal text-sm px-1" onClick={onQuitar}>Quitar</button>
      </div>

      <div className="grid grid-cols-[96px_1fr_auto] gap-2 items-center">
        {usaSeries ? (
          <div className="h-10 rounded-xl bg-fondo grid place-items-center font-bold">{cantidad}</div>
        ) : (
          <input className="input h-10 text-center" type="number" inputMode="numeric" min={1} value={l.cantidad} onChange={(e) => onCambio({ cantidad: Number(e.target.value) })} />
        )}
        <input className="input h-10" type="number" step="0.01" inputMode="decimal" value={l.precio_unit} onChange={(e) => onCambio({ precio_unit: Number(e.target.value) })} />
        <span className="font-semibold w-24 text-right">{money(cantidad * l.precio_unit, moneda)}</span>
      </div>
      {faltaStock && <p className="text-xs text-mal">⚠️ Supera el stock disponible ({num(p.stock - p.reservado)})</p>}

      {usaSeries && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-suave">IMEI / series ({l.series.length})</p>
          {l.series.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {l.series.map((s) => (
                <button key={s} type="button" onClick={() => onCambio({ series: l.series.filter((x) => x !== s) })} className="chip bg-fondo border border-linea font-mono text-[11px] gap-1">
                  {s} <span className="text-mal">×</span>
                </button>
              ))}
            </div>
          )}
          <Escaner onCodigos={onSeries} />
          {eligeDeStock && (
            <>
              <button type="button" className="text-sm text-marca font-semibold" onClick={() => setVerLista((v) => !v)}>
                {verLista ? "Ocultar" : `Elegir de la lista (${disponibles.length - l.series.length} en stock)`}
              </button>
              {verLista && (
                <div className="space-y-1">
                  <input className="input h-10" placeholder="Filtrar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
                  <div className="max-h-48 overflow-y-auto divide-y divide-linea border border-linea rounded-xl">
                    {libres.slice(0, 100).map((s) => (
                      <button key={s} type="button" onClick={() => onSeries([s])} className="w-full text-left px-3 py-2 font-mono text-sm">
                        + {s}
                      </button>
                    ))}
                    {libres.length === 0 && <p className="px-3 py-2 text-sm text-suave">Sin unidades disponibles.</p>}
                  </div>
                </div>
              )}
            </>
          )}
          {esCompra && (
            <div className="flex gap-2 items-center">
              <input className="input h-10 w-24" type="number" inputMode="numeric" placeholder="Cant." value={autoN} onChange={(e) => setAutoN(e.target.value)} />
              <button
                type="button"
                disabled={generando || !(Number(autoN) > 0)}
                className="btn-secundario h-10 text-sm flex-1"
                onClick={() => startGen(async () => onSeries(await nuevasSeries(Number(autoN))))}
              >
                {generando ? "Generando…" : "Generar series internas (sin IMEI)"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
