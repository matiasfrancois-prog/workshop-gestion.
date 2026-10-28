import { nroComprobante } from "@/lib/format";
import { respuestaPdf } from "@/lib/pdf/base";
import { comprobante, empresa, saldoTercero } from "@/lib/pdf/datos";
import { ComprobanteA4, ComprobanteTicket } from "@/lib/pdf/documentos";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = new URL(req.url).searchParams.get("f") === "ticket";
  const [e, c] = await Promise.all([empresa(), comprobante(id)]);
  if (!c) return new Response("No encontrado", { status: 404 });
  const saldo = c.cliente ? await saldoTercero("clientes", c.cliente.id) : undefined;
  const doc = ticket ? <ComprobanteTicket e={e} c={c} /> : <ComprobanteA4 e={e} c={c} saldo={saldo} />;
  return respuestaPdf(doc, nroComprobante(c.tipo, c.numero));
}
