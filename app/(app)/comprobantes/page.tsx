import Link from "next/link";
import { BotonFlotante, Encabezado, Pagina, Vacio } from "@/components/ui";
import { fecha, GRUPOS, money, nroComprobante, TIPOS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Fila = {
  id: number;
  tipo: string;
  numero: number;
  fecha: string;
  creado: string;
  total: number;
  moneda: "USD" | "ARS";
  estado: string;
  contado: boolean;
  nro_externo: string | null;
  clientes: { nombre: string } | null;
  proveedores: { nombre: string } | null;
  vendedor: { nombre: string } | null;
};

const SIGNO_NEGATIVO = ["nc_venta", "nc_compra"];

export default async function Comprobantes({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string; tipo?: string; desde?: string; hasta?: string; q?: string; pendientes?: string; cliente?: string; proveedor?: string }>;
}) {
  const sp = await searchParams;
  const grupo = sp.grupo && GRUPOS[sp.grupo] ? sp.grupo : undefined;
  const supabase = await createClient();

  // Si se busca por nombre, primero se buscan los clientes/proveedores que coinciden
  let idsTercero: number[] | null = null;
  if (sp.q) {
    const tabla = grupo === "compras" ? "proveedores" : "clientes";
    const { data } = await supabase.from(tabla).select("id").ilike("nombre", `%${sp.q}%`).limit(200);
    idsTercero = (data ?? []).map((t) => t.id);
  }

  let q = supabase
    .from("comprobantes")
    .select("id, tipo, numero, fecha, creado, total, moneda, estado, contado, nro_externo, clientes(nombre), proveedores(nombre), vendedor:perfiles!comprobantes_vendedor_id_fkey(nombre)")
    .order("creado", { ascending: false })
    .limit(200);
  if (sp.tipo) q = q.eq("tipo", sp.tipo);
  else if (grupo) q = q.in("tipo", GRUPOS[grupo].tipos);
  if (sp.cliente) q = q.eq("cliente_id", sp.cliente);
  if (sp.proveedor) q = q.eq("proveedor_id", sp.proveedor);
  if (sp.desde) q = q.gte("fecha", sp.desde);
  if (sp.hasta) q = q.lte("fecha", sp.hasta);
  if (idsTercero) q = q.in(grupo === "compras" ? "proveedor_id" : "cliente_id", idsTercero.length ? idsTercero : [0]);
  const { data } = await q;
  let filas = (data ?? []) as unknown as Fila[];

  const { data: estados } = filas.length
    ? await supabase.from("estado_documentos").select("comprobante_id, pendiente").in("comprobante_id", filas.map((f) => f.id))
    : { data: [] };
  const pend = new Map((estados ?? []).map((e) => [e.comprobante_id, Number(e.pendiente)]));
  if (sp.pendientes) filas = filas.filter((f) => (pend.get(f.id) ?? 0) > 0);

  const tiposFiltro = grupo ? GRUPOS[grupo].tipos : Object.keys(TIPOS);
  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ grupo, tipo: sp.tipo, desde: sp.desde, hasta: sp.hasta, q: sp.q, pendientes: sp.pendientes, ...extra })) if (v) p.set(k, v);
    return `/comprobantes?${p}`;
  };
  const titulo = grupo ? GRUPOS[grupo].titulo : "Comprobantes";
  const tercero = (f: Fila) => f.clientes?.nombre ?? f.proveedores?.nombre ?? "—";
  const saldoTxt = (f: Fila) => {
    if (f.estado === "anulado") return <span className="text-suave">Anulado</span>;
    if (f.estado === "abierto") return <span className="chip bg-acento/25">{f.tipo === "orden_compra" ? "Por recibir" : "Pendiente"}</span>;
    if (!pend.has(f.id)) return <span className="text-suave">—</span>;
    const p = pend.get(f.id)!;
    return p <= 0 ? <span className="text-ok font-semibold">Pagado</span> : <span className="text-mal font-bold">{money(p, f.moneda)}</span>;
  };
  const totales = { USD: 0, ARS: 0 };
  for (const f of filas) if (f.estado !== "anulado" && !["presupuesto", "pedido", "orden_compra"].includes(f.tipo)) totales[f.moneda] += (SIGNO_NEGATIVO.includes(f.tipo) ? -1 : 1) * Number(f.total);

  return (
    <>
      <Encabezado titulo={titulo} volver={grupo ? undefined : "/mas"} ancho="ancho" />
      <Pagina ancho="ancho">
        {/* Filtros */}
        <form className="card grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_auto_auto] gap-2 items-end">
          {grupo && <input type="hidden" name="grupo" value={grupo} />}
          {sp.tipo && <input type="hidden" name="tipo" value={sp.tipo} />}
          <div className="col-span-2 md:col-span-1">
            <label className="label">{grupo === "compras" ? "Proveedor" : "Cliente"}</label>
            <input className="input h-10" name="q" defaultValue={sp.q} placeholder="Buscar por nombre" />
          </div>
          <div>
            <label className="label">Desde</label>
            <input className="input h-10" type="date" name="desde" defaultValue={sp.desde} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input className="input h-10" type="date" name="hasta" defaultValue={sp.hasta} />
          </div>
          <label className="flex items-center gap-2 text-sm h-10">
            <input type="checkbox" name="pendientes" value="1" defaultChecked={!!sp.pendientes} className="size-5 accent-marca" /> Con saldo
          </label>
          <button className="btn-secundario h-10">Filtrar</button>
        </form>

        <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-1">
          {[["", "Todos"] as [string, string], ...tiposFiltro.map((t) => [t, TIPOS[t].label] as [string, string])].map(([v, t]) => (
            <Link
              key={v}
              href={link({ tipo: v || undefined })}
              className={`chip h-8 px-3 whitespace-nowrap border ${(sp.tipo ?? "") === v ? "bg-marca text-white border-marca" : "bg-white border-linea"}`}
            >
              {t}
            </Link>
          ))}
        </div>

        {/* Tabla (computadora) */}
        <section className="hidden md:block card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-fondo text-left text-xs text-suave border-b border-linea">
                <th className="py-2.5 px-3 font-semibold hidden xl:table-cell">F. carga</th>
                <th className="py-2.5 px-3 font-semibold">F. comp.</th>
                <th className="py-2.5 px-3 font-semibold">Movimiento</th>
                <th className="py-2.5 px-3 font-semibold">Comprobante</th>
                <th className="py-2.5 px-3 font-semibold">{grupo === "compras" ? "Proveedor" : grupo === "ventas" ? "Cliente" : "Cliente / proveedor"}</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                <th className="py-2.5 px-3 font-semibold">Cdo./Cta.</th>
                <th className="py-2.5 px-3 font-semibold text-right">Saldo</th>
                <th className="py-2.5 px-3 font-semibold">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const debe = (pend.get(f.id) ?? 0) > 0 && f.estado === "confirmado";
                const neg = SIGNO_NEGATIVO.includes(f.tipo);
                return (
                  <tr key={f.id} className={`border-b border-linea hover:bg-marca/5 ${debe ? "bg-mal/[0.06]" : ""} ${f.estado === "anulado" ? "opacity-50 line-through" : ""}`}>
                    <td className="py-2 px-3 whitespace-nowrap text-suave hidden xl:table-cell">{fecha(f.creado)}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{fecha(f.fecha)}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{TIPOS[f.tipo]?.label}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <Link href={`/comprobantes/${f.id}`} className="text-marca font-semibold font-mono">{nroComprobante(f.tipo, f.numero)}</Link>
                      {f.nro_externo && <span className="block text-[11px] text-suave">{f.nro_externo}</span>}
                    </td>
                    <td className="py-2 px-3 max-w-[260px] truncate">
                      <Link href={`/comprobantes/${f.id}`}>{tercero(f)}</Link>
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap font-semibold">{money(neg ? -f.total : f.total, f.moneda)}</td>
                    <td className="py-2 px-3 whitespace-nowrap text-suave">{["venta", "compra"].includes(f.tipo) ? (f.contado ? "Contado" : "Cta. cte.") : ""}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">{saldoTxt(f)}</td>
                    <td className="py-2 px-3 whitespace-nowrap text-suave">{f.vendedor?.nombre ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
            {filas.length > 0 && (
              <tfoot>
                <tr className="bg-fondo font-semibold">
                  <td className="hidden xl:table-cell" />
                  <td colSpan={4} className="py-2.5 px-3 text-right text-suave">Total ({filas.length} comprobantes)</td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {money(totales.USD, "USD")}
                    {totales.ARS !== 0 && <span className="block">{money(totales.ARS, "ARS")}</span>}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
          {filas.length === 0 && <Vacio texto="No hay comprobantes." />}
        </section>

        {/* Tarjetas (celular) */}
        <section className="md:hidden card p-0 overflow-hidden">
          {filas.map((f) => (
            <Link key={f.id} href={`/comprobantes/${f.id}`} className={`fila ${f.estado === "anulado" ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className={`truncate font-medium ${f.estado === "anulado" ? "line-through" : ""}`}>{tercero(f)}</p>
                <p className="text-xs text-suave truncate">
                  <span className="font-mono">{nroComprobante(f.tipo, f.numero)}</span> · {fecha(f.fecha)}
                  {f.nro_externo && ` · ${f.nro_externo}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{money(SIGNO_NEGATIVO.includes(f.tipo) ? -f.total : f.total, f.moneda)}</p>
                <p className="text-xs">{saldoTxt(f)}</p>
              </div>
            </Link>
          ))}
          {filas.length === 0 && <Vacio texto="No hay comprobantes." />}
        </section>
      </Pagina>
      {grupo === "compras" && <BotonFlotante href="/comprar" label="Compra" />}
      {grupo === "ventas" && <BotonFlotante href="/vender" label="Venta" />}
    </>
  );
}
