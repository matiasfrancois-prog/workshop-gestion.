"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ItemNuevo = { producto_id: number | null; descripcion: string; cantidad: number; precio_unit: number };

export type NuevoComprobante = {
  tipo: "presupuesto" | "pedido" | "venta" | "nc_venta" | "compra" | "nc_compra";
  cliente_id: number | null;
  proveedor_id: number | null;
  moneda: "USD" | "ARS";
  items: ItemNuevo[];
  observaciones: string | null;
  origen_id?: number | null;
};

export async function crearComprobante(c: NuevoComprobante): Promise<{ id?: number; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_comprobante", {
    p_tipo: c.tipo,
    p_cliente_id: c.cliente_id,
    p_proveedor_id: c.proveedor_id,
    p_moneda: c.moneda,
    p_items: c.items,
    p_observaciones: c.observaciones,
    p_origen_id: c.origen_id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { id: data as number };
}

export async function anular(form: FormData) {
  const supabase = await createClient();
  const id = Number(form.get("id"));
  const { error } = await supabase.rpc("anular_comprobante", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/comprobantes/${id}`);
}

/** Convierte un presupuesto o pedido en venta, con los mismos ítems y precios. */
export async function convertirEnVenta(form: FormData) {
  const supabase = await createClient();
  const id = Number(form.get("id"));
  const { data: c } = await supabase.from("comprobantes").select("*, comprobante_items(*)").eq("id", id).single();
  if (!c) throw new Error("Comprobante no encontrado");
  const items = (c.comprobante_items as ItemNuevo[]).map((i) => ({
    producto_id: i.producto_id,
    descripcion: i.descripcion,
    cantidad: Number(i.cantidad),
    precio_unit: Number(i.precio_unit),
  }));
  const r = await crearComprobante({
    tipo: "venta",
    cliente_id: c.cliente_id,
    proveedor_id: null,
    moneda: c.moneda,
    items,
    observaciones: c.observaciones,
    origen_id: id,
  });
  if (r.error) throw new Error(r.error);
  redirect(`/comprobantes/${r.id}`);
}
