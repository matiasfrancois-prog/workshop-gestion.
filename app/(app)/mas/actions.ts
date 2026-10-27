"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function guardarCotizacion(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cotizaciones")
    .upsert({ fecha: String(form.get("fecha")), usd_ars: Number(form.get("usd_ars")) }, { onConflict: "fecha" });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect("/mas/cotizacion");
}

export async function guardarLista(form: FormData) {
  const supabase = await createClient();
  const id = form.get("id");
  const margen = String(form.get("margen_pct") ?? "").trim();
  const datos = {
    nombre: String(form.get("nombre")).trim(),
    margen_pct: margen === "" ? null : Number(margen),
    orden: Number(form.get("orden") ?? 0),
    activa: form.get("activa") === "on",
  };
  const { error } = id
    ? await supabase.from("listas_precios").update(datos).eq("id", Number(id))
    : await supabase.from("listas_precios").insert(datos);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect("/mas/listas");
}
