import { respuestaPdf } from "@/lib/pdf/base";
import { comprobante, empresa } from "@/lib/pdf/datos";
import { DespachoA4 } from "@/lib/pdf/documentos";
import { envioDesdeUrl } from "@/lib/pdf/envio";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [e, c] = await Promise.all([empresa(), comprobante(id)]);
  if (!c) return new Response("No encontrado", { status: 404 });
  return respuestaPdf(<DespachoA4 e={e} c={c} envio={envioDesdeUrl(req)} />, `GD-${String(c.numero).padStart(5, "0")}`);
}
