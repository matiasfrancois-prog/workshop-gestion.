"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function texto(form: FormData, k: string) {
  const v = String(form.get(k) ?? "").trim();
  return v === "" ? null : v;
}

async function idPorNombre(tabla: "marcas" | "categorias", nombre: string | null) {
  if (!nombre) return null;
  const supabase = await createClient();
  const { data } = await supabase.from(tabla).select("id").ilike("nombre", nombre).maybeSingle();
  if (data) return data.id as number;
  const { data: nuevo, error } = await supabase.from(tabla).insert({ nombre }).select("id").single();
  if (error) throw new Error(error.message);
  return nuevo.id as number;
}

export async function guardarProducto(form: FormData) {
  const supabase = await createClient();
  const id = texto(form, "id");
  const costo = Number(form.get("costo_usd") ?? 0);
  const datos = {
    nombre: texto(form, "nombre")!,
    codigo: texto(form, "codigo"),
    codigo_barras: texto(form, "codigo_barras"),
    marca_id: await idPorNombre("marcas", texto(form, "marca")),
    categoria_id: await idPorNombre("categorias", texto(form, "categoria")),
    stock_minimo: Number(form.get("stock_minimo") ?? 0),
    activo: form.get("activo") === "on",
    notas: texto(form, "notas"),
    actualizado: new Date().toISOString(),
  };

  let productoId = id ? Number(id) : null;
  if (productoId) {
    const { data: antes } = await supabase.from("productos").select("costo_usd").eq("id", productoId).single();
    const { error } = await supabase.from("productos").update({ ...datos, costo_usd: costo }).eq("id", productoId);
    if (error) throw new Error(error.message);
    if (antes && Number(antes.costo_usd) !== costo) {
      await supabase.from("historial_costos").insert({ producto_id: productoId, costo_usd: costo, origen: "manual" });
    }
  } else {
    const { data, error } = await supabase.from("productos").insert({ ...datos, costo_usd: costo }).select("id").single();
    if (error) throw new Error(error.message);
    productoId = data.id as number;
    await supabase.from("historial_costos").insert({ producto_id: productoId, costo_usd: costo, origen: "alta" });
  }

  // Precios manuales por lista (vacío = usa el margen de la lista)
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("precio_")) continue;
    const listaId = Number(k.slice(7));
    const valor = String(v).trim();
    if (valor === "") {
      await supabase.from("precios").delete().eq("producto_id", productoId).eq("lista_id", listaId);
    } else {
      await supabase.from("precios").upsert({ producto_id: productoId, lista_id: listaId, precio_usd: Number(valor), actualizado: new Date().toISOString() });
    }
  }

  revalidatePath("/productos");
  redirect(`/productos/${productoId}`);
}

export async function ajustarStock(form: FormData) {
  const supabase = await createClient();
  const productoId = Number(form.get("producto_id"));
  const cantidad = Number(form.get("cantidad"));
  if (!cantidad) redirect(`/productos/${productoId}`);
  const { error } = await supabase.from("movimientos_stock").insert({
    producto_id: productoId,
    cantidad,
    tipo: "ajuste",
    nota: texto(form, "nota"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/productos/${productoId}`);
  redirect(`/productos/${productoId}`);
}
