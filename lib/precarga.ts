import type { CabeceraInicial, LineaInicial } from "@/components/Carrito";
import { createClient } from "./supabase/server";

export type Precarga = {
  id: number;
  tipo: string;
  numero: number;
  estado: string;
  cliente_id: number | null;
  proveedor_id: number | null;
  moneda: "USD" | "ARS";
  items: LineaInicial[];
  cabecera: CabeceraInicial;
};

/** Trae un comprobante listo para cargar en el carrito (modificar, copiar, recibir orden de compra, convertir presupuesto). */
export async function precargar(id: string | number, conSeries: boolean): Promise<Precarga | null> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("comprobantes")
    .select("*, comprobante_items(id, producto_id, descripcion, cantidad, precio_unit, item_series(unidades(serie)))")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  type Raw = { id: number; producto_id: number | null; descripcion: string; cantidad: number; precio_unit: number; item_series: { unidades: { serie: string } }[] };
  return {
    id: c.id,
    tipo: c.tipo,
    numero: c.numero,
    estado: c.estado,
    cliente_id: c.cliente_id,
    proveedor_id: c.proveedor_id,
    moneda: c.moneda,
    items: ((c.comprobante_items ?? []) as Raw[])
      .sort((a, b) => a.id - b.id)
      .map((i) => ({
        producto_id: i.producto_id,
        descripcion: i.descripcion,
        cantidad: Number(i.cantidad),
        precio_unit: Number(i.precio_unit),
        series: conSeries ? i.item_series.map((s) => s.unidades.serie) : [],
      })),
    cabecera: {
      fecha: c.fecha,
      nro_externo: c.nro_externo,
      vencimiento: c.vencimiento,
      cotizacion: c.cotizacion ? Number(c.cotizacion) : null,
      actualiza_costos: c.actualiza_costos,
      observaciones: c.observaciones,
    },
  };
}
