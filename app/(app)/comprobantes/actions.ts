"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ItemNuevo = { producto_id: number | null; descripcion: string; cantidad: number; precio_unit: number; series?: string[] };

export type NuevoComprobante = {
  tipo: "presupuesto" | "pedido" | "venta" | "nc_venta" | "nd_venta" | "compra" | "nc_compra" | "nd_compra" | "orden_compra";
  cliente_id: number | null;
  proveedor_id: number | null;
  moneda: "USD" | "ARS";
  items: ItemNuevo[];
  observaciones: string | null;
  origen_id?: number | null;
};

/** Datos de cabecera opcionales (como en Cianbox) */
export type ExtraComprobante = {
  fecha?: string | null;
  nro_externo?: string | null;
  vencimiento?: string | null;
  cotizacion?: number | null;
  actualiza_costos?: boolean;
  contado?: boolean;
};

export type CobroNuevo = { caja_id: number; importe_caja: number; moneda: "USD" | "ARS"; importe: number };

/** Crea el comprobante y, si se indicó, el cobro/pago en el mismo momento. */
export async function crearComprobante(
  c: NuevoComprobante,
  cobro?: CobroNuevo | null,
  extra: ExtraComprobante = {},
): Promise<{ id?: number; recibo?: number; error?: string; errorCobro?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_comprobante", {
    p_tipo: c.tipo,
    p_cliente_id: c.cliente_id,
    p_proveedor_id: c.proveedor_id,
    p_moneda: c.moneda,
    p_items: c.items,
    p_observaciones: c.observaciones,
    p_origen_id: c.origen_id ?? null,
    p_extra: { ...extra, contado: !!cobro },
  });
  if (error) return { error: error.message };
  const id = data as number;

  let recibo: number | undefined;
  let errorCobro: string | undefined;
  if (cobro) {
    const r = await supabase.rpc("registrar_pago", {
      p_cliente_id: c.cliente_id,
      p_proveedor_id: c.proveedor_id,
      p_caja_id: cobro.caja_id,
      p_importe_caja: cobro.importe_caja,
      p_moneda: cobro.moneda,
      p_importe: cobro.importe,
      p_notas: null,
    });
    if (r.error) errorCobro = r.error.message;
    else recibo = r.data as number;
  }
  revalidatePath("/", "layout");
  return { id, recibo, errorCobro };
}

export async function nuevasSeries(cantidad: number): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nuevas_series", { p_cantidad: Math.min(Math.max(cantidad, 0), 500) });
  if (error) throw new Error(error.message);
  return (data as string[]) ?? [];
}

export async function anular(form: FormData) {
  const supabase = await createClient();
  const id = Number(form.get("id"));
  const { error } = await supabase.rpc("anular_comprobante", { p_id: id });
  if (error) redirect(`/comprobantes/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(`/comprobantes/${id}`);
}

/** Modificar un comprobante existente: mismo número, se recalculan stock, series, costo y cuenta corriente. */
export async function modificarComprobante(id: number, c: NuevoComprobante, extra: ExtraComprobante = {}): Promise<{ id?: number; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("modificar_comprobante", {
    p_id: id,
    p_cliente_id: c.cliente_id,
    p_proveedor_id: c.proveedor_id,
    p_moneda: c.moneda,
    p_items: c.items,
    p_observaciones: c.observaciones,
    p_extra: extra,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { id };
}
