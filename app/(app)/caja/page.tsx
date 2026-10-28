import Link from "next/link";
import { Encabezado, Pagina, Vacio } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { fecha, money, num, type MonedaCaja } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { anularMovimiento, fijarSaldo, movimientoManual, transferencia } from "./actions";

const TIPO: Record<string, string> = {
  cobro: "Cobro",
  pago: "Pago",
  gasto: "Gasto",
  retiro: "Retiro",
  aporte: "Aporte",
  transferencia: "Cambio / transf.",
  ajuste: "Ajuste",
  saldo_inicial: "Saldo inicial",
  arqueo: "Arqueo",
};

export default async function Caja({ searchParams }: { searchParams: Promise<{ caja?: string; desde?: string; hasta?: string; error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const perfil = await getPerfil();
  const supabase = await createClient();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const desde = sp.desde ?? hoy;
  const hasta = sp.hasta ?? hoy;

  let q = supabase
    .from("movimientos_caja")
    .select("id, fecha, importe, tipo, concepto, anulado, pago_id, caja_id, cajas(nombre, moneda), categorias_gasto(nombre)")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(300);
  if (sp.caja) q = q.eq("caja_id", sp.caja);

  const [{ data: saldos }, { data: movs }, { data: cotiz }, { data: categorias }] = await Promise.all([
    supabase.from("saldos_cajas").select("*").eq("activa", true).order("orden"),
    q,
    supabase.from("cotizaciones").select("usd_ars").order("fecha", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("categorias_gasto").select("id, nombre").eq("activa", true).order("orden"),
  ]);
  const cajas = saldos ?? [];

  // Totales del período por caja
  const resumen = new Map<number, { entra: number; sale: number }>();
  for (const m of movs ?? []) {
    if (m.anulado) continue;
    const r = resumen.get(m.caja_id) ?? { entra: 0, sale: 0 };
    if (Number(m.importe) > 0) r.entra += Number(m.importe);
    else r.sale += Number(m.importe);
    resumen.set(m.caja_id, r);
  }
  // Gastos del período por categoría y moneda
  const gastos = new Map<string, Record<string, number>>();
  for (const m of movs ?? []) {
    if (m.anulado || m.tipo !== "gasto") continue;
    const cat = (m.categorias_gasto as unknown as { nombre: string } | null)?.nombre ?? "Sin categoría";
    const mon = (m.cajas as unknown as { moneda: string }).moneda;
    const r = gastos.get(cat) ?? {};
    r[mon] = (r[mon] ?? 0) - Number(m.importe);
    gastos.set(cat, r);
  }

  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const v = { caja: sp.caja, desde, hasta, ...extra };
    for (const [k, val] of Object.entries(v)) if (val) p.set(k, val);
    return `/caja?${p}`;
  };

  return (
    <>
      <Encabezado titulo="Caja" ancho="ancho" />
      <Pagina ancho="ancho">
        {sp.error && <p className="card text-sm text-mal">{sp.error}</p>}
        {sp.ok && <p className="card text-sm text-ok font-semibold">✓ Movimiento registrado</p>}

        <section className="grid grid-cols-3 gap-2">
          {cajas.map((c) => (
            <Link key={c.caja_id} href={link({ caja: sp.caja === String(c.caja_id) ? undefined : String(c.caja_id) })} className={`card p-3 ${sp.caja === String(c.caja_id) ? "border-marca ring-2 ring-marca/20" : ""}`}>
              <p className="text-[12px] text-suave font-medium">{c.nombre}</p>
              <p className={`text-[15px] font-bold leading-tight mt-1 ${Number(c.saldo) < 0 ? "text-mal" : ""}`}>{money(c.saldo, c.moneda as MonedaCaja)}</p>
            </Link>
          ))}
        </section>

        <form className="card grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          {sp.caja && <input type="hidden" name="caja" value={sp.caja} />}
          <div>
            <label className="label">Desde</label>
            <input className="input h-10" type="date" name="desde" defaultValue={desde} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input className="input h-10" type="date" name="hasta" defaultValue={hasta} />
          </div>
          <button className="btn-secundario h-10">Ver</button>
        </form>

        {resumen.size > 0 && (
          <section className="card p-0 overflow-hidden">
            <h2 className="px-4 pt-3 pb-1 font-semibold">Resumen del período</h2>
            {cajas
              .filter((c) => resumen.has(c.caja_id))
              .map((c) => {
                const r = resumen.get(c.caja_id)!;
                const m = c.moneda as MonedaCaja;
                return (
                  <div key={c.caja_id} className="fila text-sm">
                    <span className="flex-1 font-medium">{c.nombre}</span>
                    <span className="text-ok">+{money(r.entra, m)}</span>
                    <span className="text-mal">{money(r.sale, m)}</span>
                  </div>
                );
              })}
          </section>
        )}

        {gastos.size > 0 && (
          <section className="card p-0 overflow-hidden">
            <h2 className="px-4 pt-3 pb-1 font-semibold">Gastos por categoría</h2>
            {[...gastos.entries()].sort().map(([cat, r]) => (
              <div key={cat} className="fila text-sm">
                <span className="flex-1">{cat}</span>
                {Object.entries(r).map(([mon, v]) => (
                  <span key={mon} className="font-semibold text-mal">{money(v, mon as MonedaCaja)}</span>
                ))}
              </div>
            ))}
          </section>
        )}

        <details className="card">
          <summary className="font-semibold cursor-pointer">Saldo inicial / Arqueo (ajuste)</summary>
          <form action={fijarSaldo} className="mt-3 space-y-3">
            <p className="text-xs text-suave">
              Cargá lo que hay <b>realmente</b> en la caja (contado). El sistema compara con su saldo y registra la diferencia como ajuste.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-linea px-3 h-11 text-sm has-[:checked]:border-marca has-[:checked]:bg-marca/5">
                <input type="radio" name="tipo" value="arqueo" defaultChecked className="accent-marca" /> Arqueo
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-linea px-3 h-11 text-sm has-[:checked]:border-marca has-[:checked]:bg-marca/5">
                <input type="radio" name="tipo" value="saldo_inicial" className="accent-marca" /> Saldo inicial
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Caja</label>
                <select className="input" name="caja_id">
                  {cajas.map((c) => (
                    <option key={c.caja_id} value={c.caja_id}>
                      {c.nombre} (sistema {money(c.saldo, c.moneda as MonedaCaja)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Saldo real contado</label>
                <input className="input" name="saldo_real" type="number" step="0.01" inputMode="decimal" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" name="concepto" placeholder="Nota (opcional)" />
              <input className="input" name="fecha" type="date" defaultValue={hoy} />
            </div>
            <button className="btn-primario w-full">Registrar</button>
          </form>
        </details>

        <details className="card">
          <summary className="font-semibold cursor-pointer">Gasto, retiro, aporte o ajuste manual</summary>
          <form action={movimientoManual} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select className="input" name="tipo">
                  <option value="gasto">Gasto</option>
                  <option value="retiro">Retiro de socio</option>
                  <option value="aporte">Aporte / ingreso</option>
                  <option value="ajuste">Ajuste (+/−)</option>
                </select>
              </div>
              <div>
                <label className="label">Caja</label>
                <select className="input" name="caja_id">
                  {cajas.map((c) => (
                    <option key={c.caja_id} value={c.caja_id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Importe</label>
                <input className="input" name="importe" type="number" step="0.01" inputMode="decimal" required />
              </div>
              <div>
                <label className="label">Fecha</label>
                <input className="input" name="fecha" type="date" defaultValue={hoy} />
              </div>
              <div className="col-span-2">
                <label className="label">Categoría (para gastos)</label>
                <select className="input" name="categoria_id" defaultValue="">
                  <option value="">—</option>
                  {(categorias ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <input className="input" name="concepto" placeholder="Detalle: moto Juan, alquiler octubre, retiro Andrea…" required />
            <button className="btn-primario w-full">Guardar</button>
          </form>
        </details>

        <details className="card">
          <summary className="font-semibold cursor-pointer">Cambio / transferencia entre cajas</summary>
          <form action={transferencia} className="mt-3 space-y-3">
            <p className="text-xs text-suave">Ej: vendés US$ 1.000 → salen 1.000 de Dólares y entran $ {num(1000 * Number(cotiz?.usd_ars ?? 0))} a Pesos.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sale de</label>
                <select className="input" name="origen">
                  {cajas.map((c) => (
                    <option key={c.caja_id} value={c.caja_id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Importe que sale</label>
                <input className="input" name="importe_origen" type="number" step="0.01" inputMode="decimal" required />
              </div>
              <div>
                <label className="label">Entra a</label>
                <select className="input" name="destino" defaultValue={cajas[1]?.caja_id}>
                  {cajas.map((c) => (
                    <option key={c.caja_id} value={c.caja_id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Importe que entra</label>
                <input className="input" name="importe_destino" type="number" step="0.01" inputMode="decimal" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" name="concepto" placeholder="Concepto" />
              <input className="input" name="fecha" type="date" defaultValue={hoy} />
            </div>
            <button className="btn-primario w-full">Guardar</button>
          </form>
        </details>

        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 pt-3 pb-1 font-semibold">Movimientos</h2>
          {(movs ?? []).map((m) => {
            const caja = m.cajas as unknown as { nombre: string; moneda: MonedaCaja };
            return (
              <div key={m.id} className={`fila ${m.anulado ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${m.anulado ? "line-through" : ""}`}>{m.concepto ?? TIPO[m.tipo]}</p>
                  <p className="text-xs text-suave">
                    {fecha(m.fecha)} · {TIPO[m.tipo]}
                    {(m.categorias_gasto as unknown as { nombre: string } | null) && ` (${(m.categorias_gasto as unknown as { nombre: string }).nombre})`} · {caja.nombre}
                    {m.pago_id && (
                      <>
                        {" · "}
                        <a href={`/recibos/${m.pago_id}`} className="text-marca">Ver recibo</a>
                      </>
                    )}
                  </p>
                </div>
                <span className={`font-semibold text-sm ${Number(m.importe) < 0 ? "text-mal" : "text-ok"}`}>{money(m.importe, caja.moneda)}</span>
                {perfil.rol === "admin" && !m.anulado && !m.pago_id && (
                  <form action={anularMovimiento}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="text-xs text-mal px-1" title="Anular">✕</button>
                  </form>
                )}
              </div>
            );
          })}
          {(movs ?? []).length === 0 && <Vacio texto="Sin movimientos en el período." />}
        </section>
      </Pagina>
    </>
  );
}
