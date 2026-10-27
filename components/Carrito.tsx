"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { crearComprobante, type NuevoComprobante } from "@/app/(app)/comprobantes/actions";
import { money, num, TIPOS, type Moneda } from "@/lib/format";

export type ProductoVenta = { id: number; nombre: string; stock: number; reservado: number; costo: number; precios: Record<number, number> };
export type Tercero = { id: number; nombre: string; lista_id: number | null; saldo_usd: number; saldo_ars: number; habilitado: boolean; limite: number | null };
type Linea = { key: number; producto_id: number | null; descripcion: string; cantidad: number; precio_unit: number };

type Props = {
  modo: "venta" | "compra";
  tipoInicial: NuevoComprobante["tipo"];
  terceros: Tercero[];
  terceroInicial: number | null;
  productos: ProductoVenta[];
  listaDefault: number | null;
  verCostos: boolean;
};

const TIPOS_VENTA = ["venta", "pedido", "presupuesto", "nc_venta"] as const;
const TIPOS_COMPRA = ["compra", "nc_compra"] as const;

export default function Carrito({ modo, tipoInicial, terceros, terceroInicial, productos, listaDefault, verCostos }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<NuevoComprobante["tipo"]>(tipoInicial);
  const [terceroId, setTerceroId] = useState<number | null>(terceroInicial);
  const [buscaTercero, setBuscaTercero] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [busca, setBusca] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tercero = terceros.find((t) => t.id === terceroId) ?? null;
  const listaId = tercero?.lista_id ?? listaDefault;

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

  const total = lineas.reduce((a, l) => a + l.cantidad * l.precio_unit, 0);
  const costoTotal = lineas.reduce((a, l) => a + l.cantidad * (productos.find((p) => p.id === l.producto_id)?.costo ?? 0), 0);

  function precioSugerido(p: ProductoVenta) {
    if (modo === "compra") return p.costo;
    return listaId ? p.precios[listaId] ?? 0 : 0;
  }

  function agregar(p: ProductoVenta) {
    setLineas((ls) => {
      const existe = ls.find((l) => l.producto_id === p.id);
      if (existe) return ls.map((l) => (l === existe ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { key: Date.now(), producto_id: p.id, descripcion: p.nombre, cantidad: 1, precio_unit: precioSugerido(p) }];
    });
    setBusca("");
  }

  function cambiar(key: number, campo: "cantidad" | "precio_unit", valor: number) {
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  function guardar() {
    setError(null);
    if (!tercero) return setError(modo === "venta" ? "Elegí un cliente." : "Elegí un proveedor.");
    if (lineas.length === 0) return setError("Agregá al menos un producto.");
    if (lineas.some((l) => !(l.cantidad > 0))) return setError("Revisá las cantidades.");
    startTransition(async () => {
      const r = await crearComprobante({
        tipo,
        cliente_id: modo === "venta" ? tercero.id : null,
        proveedor_id: modo === "compra" ? tercero.id : null,
        moneda,
        items: lineas.map(({ producto_id, descripcion, cantidad, precio_unit }) => ({ producto_id, descripcion, cantidad, precio_unit })),
        observaciones: obs.trim() || null,
      });
      if (r.error) setError(r.error);
      else router.push(`/comprobantes/${r.id}`);
    });
  }

  const deudaUsd = tercero ? tercero.saldo_usd : 0;
  const excedeLimite = tercero?.limite != null && modo === "venta" && tipo === "venta" && deudaUsd + (moneda === "USD" ? total : 0) > tercero.limite;

  return (
    <div className="space-y-3 pb-24">
      {/* Tipo */}
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

      {/* Productos */}
      <section className="card space-y-2">
        <input className="input" placeholder="Agregar producto: a17 128…" value={busca} onChange={(e) => setBusca(e.target.value)} />
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
          onClick={() => setLineas((ls) => [...ls, { key: Date.now(), producto_id: null, descripcion: "", cantidad: 1, precio_unit: 0 }])}
        >
          + Línea libre (sin stock)
        </button>
      </section>

      {lineas.length > 0 && (
        <section className="card p-0 overflow-hidden">
          {lineas.map((l) => {
            const p = productos.find((x) => x.id === l.producto_id);
            const faltaStock = modo === "venta" && (tipo === "venta" || tipo === "pedido") && p && l.cantidad > p.stock - p.reservado;
            return (
              <div key={l.key} className="px-4 py-3 border-b border-linea last:border-0 space-y-2">
                <div className="flex gap-2 items-start">
                  {l.producto_id ? (
                    <p className="flex-1 font-medium">{l.descripcion}</p>
                  ) : (
                    <input
                      className="input h-10 flex-1"
                      placeholder="Descripción"
                      value={l.descripcion}
                      onChange={(e) => setLineas((ls) => ls.map((x) => (x.key === l.key ? { ...x, descripcion: e.target.value } : x)))}
                    />
                  )}
                  <button type="button" className="text-mal text-sm px-1" onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}>Quitar</button>
                </div>
                <div className="grid grid-cols-[96px_1fr_auto] gap-2 items-center">
                  <input className="input h-10 text-center" type="number" inputMode="numeric" min={1} value={l.cantidad} onChange={(e) => cambiar(l.key, "cantidad", Number(e.target.value))} />
                  <input className="input h-10" type="number" step="0.01" inputMode="decimal" value={l.precio_unit} onChange={(e) => cambiar(l.key, "precio_unit", Number(e.target.value))} />
                  <span className="font-semibold w-24 text-right">{money(l.cantidad * l.precio_unit, moneda)}</span>
                </div>
                {faltaStock && <p className="text-xs text-mal">⚠️ Supera el stock disponible ({num(p.stock - p.reservado)})</p>}
              </div>
            );
          })}
        </section>
      )}

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

      {excedeLimite && <p className="card text-sm text-mal">⚠️ Con esta venta supera el límite de crédito ({money(tercero!.limite)}).</p>}
      {error && <p className="card text-sm text-mal">{error}</p>}

      {/* Barra fija de total */}
      <div className="fixed bottom-16 inset-x-0 z-20 bg-white border-t border-linea pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-xs text-suave">Total {TIPOS[tipo].label.toLowerCase()}</p>
            <p className="text-xl font-bold">{money(total, moneda)}</p>
            {verCostos && modo === "venta" && moneda === "USD" && total > 0 && (
              <p className="text-[11px] text-suave">Ganancia {money(total - costoTotal)} ({costoTotal ? (((total - costoTotal) / costoTotal) * 100).toFixed(1) : 0}%)</p>
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
