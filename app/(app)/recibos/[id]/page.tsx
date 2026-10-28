import Link from "next/link";
import { notFound } from "next/navigation";
import { anularPagoDesdeRecibo, modificarPago } from "@/app/(app)/clientes/actions";
import CamposCobro from "@/components/CamposCobro";
import { Accion, BarraAcciones, CabeceraHoja, Datos, Hoja, Seccion, type EmpresaHoja } from "@/components/Hoja";
import { Encabezado, Pagina } from "@/components/ui";
import { getCajasYCotizacion, getPerfil } from "@/lib/data";
import { fecha, money, nroRecibo, type MonedaCaja } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Recibo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modificado?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const perfil = await getPerfil();
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("pagos")
    .select("*, cajas(nombre, moneda), clientes(id, nombre, cuit), proveedores(id, nombre, cuit), usuario:perfiles!pagos_usuario_id_fkey(nombre), editor:perfiles!pagos_modificado_por_fkey(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const esCobro = p.cliente_id !== null;
  const tercero = (esCobro ? p.clientes : p.proveedores) as { id: number; nombre: string; cuit: string | null };
  const caja = p.cajas as { nombre: string; moneda: MonedaCaja };
  const [{ data: e }, { data: saldo }, cc] = await Promise.all([
    supabase.from("empresa").select("*").single(),
    supabase.from(esCobro ? "saldos_clientes" : "saldos_proveedores").select("saldo_usd, saldo_ars").eq(esCobro ? "cliente_id" : "proveedor_id", tercero.id).single(),
    getCajasYCotizacion(),
  ]);
  const nro = nroRecibo(esCobro, p.numero);
  const distinta = caja.moneda !== p.moneda;
  const tcUi = caja.moneda === "ARS" ? Number(p.importe_caja) / Number(p.importe) : Number(p.importe) / Number(p.importe_caja);
  const hora = (d: string) => new Date(d).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });
  const ruta = esCobro ? "clientes" : "proveedores";

  return (
    <>
      <Encabezado titulo={nro} volver={`/${ruta}/${tercero.id}`} ancho="ancho" />
      <Pagina ancho="ancho">
        {sp.modificado && <p className="card border-ok/40 text-sm font-semibold text-ok">✓ Cambios guardados</p>}
        {sp.error && <p className="card text-sm text-mal">{sp.error}</p>}
        <div className="md:grid md:grid-cols-[1fr_300px] md:gap-4 md:items-start space-y-3 md:space-y-0">
          <Hoja anulado={p.anulado}>
            <CabeceraHoja e={e as EmpresaHoja} titulo={esCobro ? "RECIBO" : "ORDEN DE PAGO"} numero={nro} fecha={fecha(p.fecha)} />
            <div className="px-4 py-6 text-center border-b border-linea">
              <p className="text-sm text-suave">{esCobro ? "Recibimos de" : "Pagamos a"}</p>
              <Link href={`/${ruta}/${tercero.id}`} className="text-lg font-bold text-marca">{tercero.nombre}</Link>
              <p className="text-sm text-suave mt-3">la suma de</p>
              <p className="text-3xl font-extrabold">{money(p.importe_caja, caja.moneda)}</p>
              <p className="text-sm text-suave">en {caja.nombre}</p>
            </div>
            <Datos
              filas={[
                ["Imputado a cuenta", `${money(p.importe, p.moneda)} (${p.moneda === "USD" ? "dólares" : "pesos"})`],
                ["Tipo de cambio", distinta ? (caja.moneda === "ARS" ? `US$ 1 = $ ${tcUi.toLocaleString("es-AR")}` : `1 ${caja.moneda} = ${p.moneda === "USD" ? "US$" : "$"} ${tcUi.toLocaleString("es-AR")}`) : null],
                ["Concepto", p.notas],
                ["CUIT / DNI", tercero.cuit],
                ["Saldo actual de la cuenta", `${money(saldo?.saldo_usd ?? 0, "USD")}${Number(saldo?.saldo_ars ?? 0) !== 0 ? ` · ${money(saldo?.saldo_ars, "ARS")}` : ""}`],
                ["Cargado por", `${(p.usuario as { nombre: string } | null)?.nombre ?? "—"} · ${hora(p.creado)}`],
                ["Modificado por", p.modificado && `${(p.editor as { nombre: string } | null)?.nombre ?? "—"} · ${hora(p.modificado)}`],
              ]}
            />
            <Seccion titulo="Firma">
              <div className="grid grid-cols-2 gap-8 px-6 pt-10 pb-6 text-center text-xs text-suave">
                <p className="border-t border-tinta/60 pt-1">{esCobro ? "Work Shop" : "Recibí conforme"}</p>
                <p className="border-t border-tinta/60 pt-1">Aclaración</p>
              </div>
            </Seccion>
          </Hoja>

          <aside className="space-y-3 md:sticky md:top-20">
            <section className="card space-y-2">
              <p className="text-xs font-semibold text-suave">Imprimir / compartir</p>
              <BarraAcciones>
                <Accion href={`/pdf/recibo/${p.id}`} nueva primario>PDF A4</Accion>
                <Accion href={`/pdf/recibo/${p.id}?f=ticket`} nueva>Ticket</Accion>
              </BarraAcciones>
            </section>

            {!p.anulado && (
              <details className="card">
                <summary className="font-semibold cursor-pointer">Modificar</summary>
                <form action={modificarPago} className="mt-3 space-y-3">
                  <input type="hidden" name="pago_id" value={p.id} />
                  <CamposCobro
                    cajas={cc.cajas}
                    cotizacion={cc.cotizacion}
                    monedaCuenta={p.moneda}
                    importeSugerido={Number(p.importe_caja)}
                    cajaInicial={p.caja_id}
                    tcInicial={distinta ? tcUi : undefined}
                    nombres
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Fecha</label>
                      <input className="input" name="fecha" type="date" defaultValue={p.fecha} />
                    </div>
                    <div>
                      <label className="label">Concepto</label>
                      <input className="input" name="notas" defaultValue={p.notas ?? ""} />
                    </div>
                  </div>
                  <button className="btn-primario w-full">Guardar cambios</button>
                </form>
              </details>
            )}

            {perfil.rol === "admin" && !p.anulado && (
              <form action={anularPagoDesdeRecibo}>
                <input type="hidden" name="pago_id" value={p.id} />
                <button className="btn-peligro w-full h-10 text-sm">Anular {esCobro ? "recibo" : "orden de pago"}</button>
              </form>
            )}
          </aside>
        </div>
      </Pagina>
    </>
  );
}
