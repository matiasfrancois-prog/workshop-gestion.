import { respuestaPdf } from "@/lib/pdf/base";
import { empresa, type TerceroPdf } from "@/lib/pdf/datos";
import { CuentaA4, type MovCuenta } from "@/lib/pdf/documentos";
import { createClient } from "@/lib/supabase/server";
import { todas } from "@/lib/todas";

export async function GET(_req: Request, { params }: { params: Promise<{ tabla: string; id: string }> }) {
  const { tabla, id } = await params;
  const esCliente = tabla === "clientes";
  const supabase = await createClient();
  const [e, { data: t }] = await Promise.all([
    empresa(),
    supabase.from(esCliente ? "clientes" : "proveedores").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!t) return new Response("No encontrado", { status: 404 });
  const movs = await todas((a, b) =>
    supabase
      .from(esCliente ? "ctacte_clientes" : "ctacte_proveedores")
      .select("moneda, fecha, origen, concepto, numero, importe")
      .eq(esCliente ? "cliente_id" : "proveedor_id", id)
      .order("fecha")
      .order("origen_id")
      .range(a, b),
  );
  return respuestaPdf(
    <CuentaA4 e={e} t={t as TerceroPdf} esCliente={esCliente} movs={(movs as MovCuenta[]).map((m) => ({ ...m, importe: Number(m.importe) }))} />,
    `Cuenta-${(t as TerceroPdf).nombre}`,
  );
}
