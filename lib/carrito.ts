import type { ProductoVenta, Tercero } from "@/components/Carrito";
import { precioEnLista, type Lista } from "./data";
import { createClient } from "./supabase/server";

/** Carga todo lo que necesita la pantalla de venta/compra en una sola ida a la base. */
export async function datosCarrito(modo: "venta" | "compra") {
  const supabase = await createClient();
  const [productos, stock, reservado, listas, precios, terceros] = await Promise.all([
    supabase.from("productos").select("id, nombre, costo_usd").eq("activo", true).order("nombre"),
    supabase.from("stock_actual").select("producto_id, stock"),
    supabase.from("stock_reservado").select("producto_id, reservado"),
    supabase.from("listas_precios").select("*").eq("activa", true).order("orden"),
    supabase.from("precios").select("producto_id, lista_id, precio_usd"),
    modo === "venta"
      ? supabase.from("clientes").select("id, nombre, lista_id, habilitado, limite_credito_usd").order("nombre")
      : supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  const saldos =
    modo === "venta"
      ? await supabase.from("saldos_clientes").select("cliente_id, saldo_usd, saldo_ars")
      : await supabase.from("saldos_proveedores").select("proveedor_id, saldo_usd, saldo_ars");

  const stockMap = new Map((stock.data ?? []).map((s) => [s.producto_id, Number(s.stock)]));
  const resMap = new Map((reservado.data ?? []).map((s) => [s.producto_id, Number(s.reservado)]));
  const manual = new Map((precios.data ?? []).map((p) => [`${p.producto_id}-${p.lista_id}`, Number(p.precio_usd)]));
  const ls = (listas.data ?? []) as Lista[];

  const prods: ProductoVenta[] = (productos.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    stock: stockMap.get(p.id) ?? 0,
    reservado: resMap.get(p.id) ?? 0,
    costo: Number(p.costo_usd),
    precios: Object.fromEntries(ls.map((l) => [l.id, precioEnLista(Number(p.costo_usd), l, manual, p.id)])),
  }));

  const saldoMap = new Map(
    (saldos.data ?? []).map((s: Record<string, unknown>) => [
      Number(s.cliente_id ?? s.proveedor_id),
      { usd: Number(s.saldo_usd), ars: Number(s.saldo_ars) },
    ]),
  );
  const ters: Tercero[] = ((terceros.data ?? []) as Record<string, unknown>[]).map((t) => ({
    id: Number(t.id),
    nombre: String(t.nombre),
    lista_id: (t.lista_id as number | null) ?? null,
    habilitado: (t.habilitado as boolean | undefined) ?? true,
    limite: t.limite_credito_usd == null ? null : Number(t.limite_credito_usd),
    saldo_usd: saldoMap.get(Number(t.id))?.usd ?? 0,
    saldo_ars: saldoMap.get(Number(t.id))?.ars ?? 0,
  }));

  return { productos: prods, terceros: ters, listaDefault: ls[0]?.id ?? null };
}
