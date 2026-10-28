import { respuestaPdf } from "@/lib/pdf/base";
import { comprobante } from "@/lib/pdf/datos";
import { RotuloA4 } from "@/lib/pdf/documentos";
import { envioDesdeUrl } from "@/lib/pdf/envio";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await comprobante(id);
  if (!c) return new Response("No encontrado", { status: 404 });
  return respuestaPdf(<RotuloA4 c={c} envio={envioDesdeUrl(req)} />, `Rotulo-${c.numero}`);
}
