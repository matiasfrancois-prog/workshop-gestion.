import { nroRecibo, type MonedaCaja } from "@/lib/format";
import { respuestaPdf } from "@/lib/pdf/base";
import { empresa, saldoTercero, type TerceroPdf } from "@/lib/pdf/datos";
import { ReciboA4, ReciboTicket, type ReciboPdf } from "@/lib/pdf/documentos";
import { createClient } from "@/lib/supabase/server";

const T = "id, nombre, razon_social, cuit, telefono, email, direccion";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = new URL(req.url).searchParams.get("f") === "ticket";
  const supabase = await createClient();
  const [e, { data: p }] = await Promise.all([
    empresa(),
    supabase.from("pagos").select(`*, cajas(nombre, moneda), clientes(${T}), proveedores(${T})`).eq("id", id).maybeSingle(),
  ]);
  if (!p) return new Response("No encontrado", { status: 404 });
  const esCobro = p.cliente_id !== null;
  const tercero = (esCobro ? p.clientes : p.proveedores) as TerceroPdf;
  const caja = p.cajas as { nombre: string; moneda: MonedaCaja };
  const r: ReciboPdf = {
    numero: p.numero,
    fecha: p.fecha,
    esCobro,
    anulado: p.anulado,
    tercero,
    caja: caja.nombre,
    monedaCaja: caja.moneda,
    importeCaja: Number(p.importe_caja),
    moneda: p.moneda,
    importe: Number(p.importe),
    tipoCambio: p.tipo_cambio ? Number(p.tipo_cambio) : null,
    notas: p.notas,
    saldo: await saldoTercero(esCobro ? "clientes" : "proveedores", tercero.id),
  };
  return respuestaPdf(ticket ? <ReciboTicket e={e} r={r} /> : <ReciboA4 e={e} r={r} />, nroRecibo(esCobro, p.numero));
}
