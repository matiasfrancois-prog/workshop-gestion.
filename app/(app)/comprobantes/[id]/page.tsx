import Link from "next/link";
import { notFound } from "next/navigation";
import { Accion, BarraAcciones, CabeceraHoja, Datos, Hoja, Seccion, type EmpresaHoja } from "@/components/Hoja";
import { Encabezado, Pagina } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { fecha, money, nroComprobante, num, TIPOS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { anular } from "../actions";

type Item = {
  id: number;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
  costo_unit: number | null;
  subtotal: number;
  producto_id: number | null;
  item_series: { unidades: { serie: string } }[];
};

const TITULO: Record<string, string> = {
  presupuesto: "PRESUPUESTO",
  pedido: "NOTA DE PEDIDO",
  venta: "COMPROBANTE DE VENTA",
  nc_venta: "NOTA DE CRÉDITO",
  nd_venta: "NOTA DE DÉBITO",
  compra: "INGRESO DE MERCADERÍA",
  nc_compra: "NOTA DE CRÉDITO PROVEEDOR",
  nd_compra: "NOTA DE DÉBITO PROVEEDOR",
  orden_compra: "ORDEN DE COMPRA",
};
const COMPRAS = ["compra", "nc_compra", "nd_compra", "orden_compra"];

export default async function Comprobante({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string; modificado?: string; recibo?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const perfil = await getPerfil();
  const esAdmin = perfil.rol === "admin";
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("comprobantes")
    .select(
      `*, clientes(id, nombre, telefono, cuit, direccion, localidad), proveedores(id, nombre, telefono, cuit, direccion),
       comprobante_items(*, item_series(unidades(serie))),
       vendedor:perfiles!comprobantes_vendedor_id_fkey(nombre), editor:perfiles!comprobantes_modificado_por_fkey(nombre),
       origen:origen_id(id, tipo, numero)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const esCompra = COMPRAS.includes(c.tipo);
  const grupo = esCompra ? "compras" : "ventas";
  const [{ data: e }, { data: est }, { data: ant }, { data: sig }, { data: derivados }] = await Promise.all([
    supabase.from("empresa").select("*").single(),
    supabase.from("estado_documentos").select("pendiente").eq("comprobante_id", id).maybeSingle(),
    supabase.from("comprobantes").select("id").in("tipo", COMPRAS.includes(c.tipo) ? COMPRAS : ["venta", "nc_venta", "nd_venta", "pedido", "presupuesto"]).lt("id", id).order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("comprobantes").select("id").in("tipo", COMPRAS.includes(c.tipo) ? COMPRAS : ["venta", "nc_venta", "nd_venta", "pedido", "presupuesto"]).gt("id", id).order("id").limit(1).maybeSingle(),
    supabase.from("comprobantes").select("id, tipo, numero").eq("origen_id", id),
  ]);

  const tercero = (esCompra ? c.proveedores : c.clientes) as { id: number; nombre: string; telefono: string | null; cuit: string | null; direccion: string | null; localidad?: string | null } | null;
  const items = ((c.comprobante_items ?? []) as Item[]).sort((a, b) => a.id - b.id);
  const nro = nroComprobante(c.tipo, c.numero);
  const costo = items.reduce((a, i) => a + Number(i.cantidad) * Number(i.costo_unit ?? 0), 0);
  const unidades = items.reduce((a, i) => a + Number(i.cantidad), 0);
  const anulado = c.estado === "anulado";
  const origen = c.origen as { id: number; tipo: string; numero: number } | null;
  const pendiente = est ? Number(est.pendiente) : null;

  const condicion = ["venta", "compra", "nd_venta", "nd_compra"].includes(c.tipo) ? (
    <>
      {c.contado ? "Contado" : "Cuenta corriente"} ·{" "}
      {pendiente === null ? "—" : pendiente <= 0 ? <span className="text-ok font-bold">Pagado</span> : <span className="text-mal font-bold">Saldo {money(pendiente, c.moneda)}</span>}
    </>
  ) : null;

  // Texto para WhatsApp (sin costos ni stock)
  const texto = [
    `*Work Shop* · ${TIPOS[c.tipo].label} ${nro}`,
    "",
    ...items.map((i) => `📱 ${num(i.cantidad)} x ${i.descripcion} — ${money(i.precio_unit, c.moneda)}`),
    "",
    `*Total: ${money(c.total, c.moneda)}*`,
  ].join("\n");
  const tel = (tercero?.telefono ?? "").replace(/\D/g, "");
  const wa = `https://wa.me/${tel ? (tel.startsWith("54") ? tel : "549" + tel) : ""}?text=${encodeURIComponent(texto)}`;

  return (
    <>
      <Encabezado
        titulo={nro}
        volver={`/comprobantes?grupo=${grupo}`}
        ancho="ancho"
        accion={
          <div className="flex gap-1">
            {ant && <Link href={`/comprobantes/${ant.id}`} className="size-10 grid place-items-center rounded-full bg-white/10" aria-label="Anterior">‹</Link>}
            {sig && <Link href={`/comprobantes/${sig.id}`} className="size-10 grid place-items-center rounded-full bg-white/10" aria-label="Siguiente">›</Link>}
          </div>
        }
      />
      <Pagina ancho="ancho">
        {sp.nuevo && <p className="card border-ok/40 text-sm font-semibold text-ok">✓ {TIPOS[c.tipo].label} guardado</p>}
        {sp.modificado && <p className="card border-ok/40 text-sm font-semibold text-ok">✓ Cambios guardados</p>}
        {sp.error && <p className="card text-sm text-mal">{sp.error}</p>}

        <div className="md:grid md:grid-cols-[1fr_260px] md:gap-4 md:items-start space-y-3 md:space-y-0">
          <Hoja anulado={anulado}>
            <CabeceraHoja e={e as EmpresaHoja} titulo={TITULO[c.tipo]} numero={nro} fecha={fecha(c.fecha)} sub={c.vencimiento ? `Vence: ${fecha(c.vencimiento)}` : undefined} />

            <Datos
              filas={[
                [esCompra ? "Proveedor" : "Cliente", tercero && <Link href={`/${esCompra ? "proveedores" : "clientes"}/${tercero.id}`} className="text-marca">{tercero.nombre}</Link>],
                ["CUIT / DNI", tercero?.cuit],
                ["Comprobante proveedor", c.nro_externo],
                ["Condición", condicion],
                ["Moneda", `${c.moneda === "USD" ? "Dólares" : "Pesos"}${c.cotizacion ? ` · Cot. US$ 1 = $ ${num(c.cotizacion)}` : ""}`],
                ["Actualiza costos", c.tipo === "compra" ? (c.actualiza_costos ? "Sí" : "No") : null],
                ["Estado", c.tipo === "orden_compra" || c.tipo === "pedido" ? (c.estado === "abierto" ? "Pendiente" : c.estado === "confirmado" ? (c.tipo === "orden_compra" ? "Recibida" : "Facturado") : "Anulado") : anulado ? "Anulado" : null],
                ["Origen", origen && <Link href={`/comprobantes/${origen.id}`} className="text-marca">{nroComprobante(origen.tipo, origen.numero)}</Link>],
                [
                  "Generó",
                  derivados && derivados.length > 0 && (
                    <span className="flex flex-wrap gap-2 justify-end md:justify-start">
                      {derivados.map((d) => (
                        <Link key={d.id} href={`/comprobantes/${d.id}`} className="text-marca">{nroComprobante(d.tipo, d.numero)}</Link>
                      ))}
                    </span>
                  ),
                ],
                ["Cargado por", `${(c.vendedor as { nombre: string } | null)?.nombre ?? "—"} · ${new Date(c.creado).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" })}`],
                [
                  "Modificado por",
                  c.modificado &&
                    `${(c.editor as { nombre: string } | null)?.nombre ?? "—"} · ${new Date(c.modificado).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" })}`,
                ],
              ]}
            />

            <Seccion titulo={`Detalle · ${items.length} ítems · ${num(unidades)} unidades`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-tinta text-white text-xs">
                      <th className="py-2 px-3 text-center w-14">Cant.</th>
                      <th className="py-2 px-3 text-left">Detalle</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap hidden md:table-cell">P. unit.</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => {
                      const series = i.item_series.map((s) => s.unidades.serie).sort();
                      return (
                        <tr key={i.id} className="border-b border-linea align-top">
                          <td className="py-2.5 px-3 text-center font-semibold">{num(i.cantidad)}</td>
                          <td className="py-2.5 px-3">
                            {i.producto_id ? <Link href={`/productos/${i.producto_id}`} className="text-marca font-medium">{i.descripcion}</Link> : <span className="font-medium">{i.descripcion}</span>}
                            <span className="block md:hidden text-xs text-suave">{num(i.cantidad)} x {money(i.precio_unit, c.moneda)}</span>
                            {esAdmin && c.tipo === "venta" && i.costo_unit !== null && <span className="block text-[11px] text-suave">costo prom. {money(i.costo_unit)}</span>}
                            {series.length > 0 && (
                              <details className="mt-1">
                                <summary className="text-[11px] text-suave cursor-pointer">IMEI / series ({series.length})</summary>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {series.map((s) => (
                                    <Link key={s} href={`/series?q=${encodeURIComponent(s)}`} className="chip bg-fondo border border-linea font-mono text-[10px]">{s}</Link>
                                  ))}
                                </div>
                              </details>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap hidden md:table-cell">{money(i.precio_unit, c.moneda)}</td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold">{money(i.subtotal, c.moneda)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end p-4">
                <div className="w-full md:w-72 border border-tinta/80 p-3 space-y-1">
                  <div className="flex justify-between text-lg font-extrabold">
                    <span>TOTAL</span>
                    <span>{money(c.total, c.moneda)}</span>
                  </div>
                  {esAdmin && c.tipo === "venta" && c.moneda === "USD" && costo > 0 && (
                    <p className="text-xs text-suave text-right">
                      Ganancia {money(Number(c.total) - costo)} ({(((Number(c.total) - costo) / costo) * 100).toFixed(1)}%)
                    </p>
                  )}
                </div>
              </div>
            </Seccion>

            {c.observaciones && (
              <Seccion titulo="Observaciones">
                <p className="px-4 pb-4 text-sm whitespace-pre-wrap">{c.observaciones}</p>
              </Seccion>
            )}
          </Hoja>

          {/* Acciones */}
          <aside className="space-y-3 md:sticky md:top-20">
            <section className="card space-y-2">
              <p className="text-xs font-semibold text-suave">Imprimir / compartir</p>
              <BarraAcciones>
                <Accion href={`/pdf/comprobante/${c.id}`} nueva primario>PDF A4</Accion>
                <Accion href={`/pdf/comprobante/${c.id}?f=ticket`} nueva>Ticket</Accion>
                {sp.recibo && <Accion href={`/pdf/recibo/${sp.recibo}`} nueva>{esCompra ? "Orden de pago" : "Recibo"}</Accion>}
                {(c.tipo === "venta" || c.tipo === "pedido") && <Accion href={`/comprobantes/${c.id}/despacho`}>Despacho / rótulo</Accion>}
                {!esCompra && tercero && <Accion href={wa} nueva>WhatsApp</Accion>}
              </BarraAcciones>
            </section>

            {!anulado && (
              <section className="card space-y-2">
                <p className="text-xs font-semibold text-suave">Operar</p>
                <BarraAcciones>
                  {c.tipo === "orden_compra" && c.estado === "abierto" && <Accion href={`/comprar?desde=${c.id}`} primario>Recibir mercadería</Accion>}
                  {(c.tipo === "presupuesto" || (c.tipo === "pedido" && c.estado === "abierto")) && <Accion href={`/vender?desde=${c.id}`} primario>Convertir en venta</Accion>}
                  {pendiente !== null && pendiente > 0 && tercero && (
                    <Accion href={`/${esCompra ? "proveedores" : "clientes"}/${tercero.id}#cobro`}>{esCompra ? "Pagar" : "Cobrar"}</Accion>
                  )}
                  <Accion href={`/comprobantes/${c.id}/editar`}>Modificar</Accion>
                  <Accion href={esCompra ? `/comprar?copiar=${c.id}` : `/vender?copiar=${c.id}`}>Copiar</Accion>
                </BarraAcciones>
              </section>
            )}

            {esAdmin && !anulado && (
              <form action={anular}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn-peligro w-full h-10 text-sm">Anular comprobante</button>
              </form>
            )}
          </aside>
        </div>
      </Pagina>
    </>
  );
}
