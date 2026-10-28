import { createClient } from "@/lib/supabase/server";
import type { Empresa } from "./base";

export type TerceroPdf = {
  id: number;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad?: string | null;
};

export type ItemPdf = { id: number; descripcion: string; cantidad: number; precio_unit: number; subtotal: number; series: string[] };

export type ComprobantePdf = {
  id: number;
  tipo: string;
  numero: number;
  fecha: string;
  moneda: "USD" | "ARS";
  total: number;
  estado: string;
  observaciones: string | null;
  cliente: TerceroPdf | null;
  proveedor: TerceroPdf | null;
  items: ItemPdf[];
  vendedor: string | null;
};

const TERCERO = "id, nombre, razon_social, cuit, telefono, email, direccion";

export async function empresa(): Promise<Empresa> {
  const supabase = await createClient();
  const { data } = await supabase.from("empresa").select("*").single();
  return (data ?? { nombre: "WORK SHOP" }) as Empresa;
}

export async function comprobante(id: string): Promise<ComprobantePdf | null> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("comprobantes")
    .select(`*, clientes(${TERCERO}, localidad), proveedores(${TERCERO}), perfiles(nombre), comprobante_items(id, descripcion, cantidad, precio_unit, subtotal, item_series(unidades(serie)))`)
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  type ItemRaw = Omit<ItemPdf, "series"> & { item_series: { unidades: { serie: string } }[] };
  return {
    ...c,
    total: Number(c.total),
    cliente: c.clientes as TerceroPdf | null,
    proveedor: c.proveedores as TerceroPdf | null,
    vendedor: (c.perfiles as { nombre: string } | null)?.nombre ?? null,
    items: ((c.comprobante_items ?? []) as ItemRaw[])
      .sort((a, b) => a.id - b.id)
      .map((i) => ({
        id: i.id,
        descripcion: i.descripcion,
        cantidad: Number(i.cantidad),
        precio_unit: Number(i.precio_unit),
        subtotal: Number(i.subtotal),
        series: i.item_series.map((x) => x.unidades.serie).sort(),
      })),
  };
}

export async function saldoTercero(tabla: "clientes" | "proveedores", id: number) {
  const supabase = await createClient();
  const vista = tabla === "clientes" ? "saldos_clientes" : "saldos_proveedores";
  const col = tabla === "clientes" ? "cliente_id" : "proveedor_id";
  const { data } = await supabase.from(vista).select("saldo_usd, saldo_ars").eq(col, id).maybeSingle();
  return { usd: Number(data?.saldo_usd ?? 0), ars: Number(data?.saldo_ars ?? 0) };
}
