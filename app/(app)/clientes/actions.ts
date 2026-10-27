"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function t(form: FormData, k: string) {
  const v = String(form.get(k) ?? "").trim();
  return v === "" ? null : v;
}

export async function guardarTercero(form: FormData) {
  const supabase = await createClient();
  const tabla = form.get("tabla") === "proveedores" ? "proveedores" : "clientes";
  const id = t(form, "id");
  const base = {
    nombre: t(form, "nombre")!,
    razon_social: t(form, "razon_social"),
    cuit: t(form, "cuit"),
    telefono: t(form, "telefono"),
    email: t(form, "email"),
    direccion: t(form, "direccion"),
    notas: t(form, "notas"),
  };
  const datos: Record<string, unknown> =
    tabla === "clientes"
      ? {
          ...base,
          localidad: t(form, "localidad"),
          lista_id: t(form, "lista_id") ? Number(t(form, "lista_id")) : null,
          limite_credito_usd: t(form, "limite_credito_usd") ? Number(t(form, "limite_credito_usd")) : null,
          habilitado: form.get("habilitado") === "on",
        }
      : { ...base, activo: form.get("habilitado") === "on" };

  let nuevoId = id ? Number(id) : null;
  if (nuevoId) {
    const { error } = await supabase.from(tabla).update(datos).eq("id", nuevoId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from(tabla).insert(datos).select("id").single();
    if (error) throw new Error(error.message);
    nuevoId = data.id as number;
  }
  revalidatePath(`/${tabla}`);
  redirect(`/${tabla}/${nuevoId}`);
}

export async function registrarPago(form: FormData) {
  const supabase = await createClient();
  const tabla = form.get("tabla") === "proveedores" ? "proveedores" : "clientes";
  const id = Number(form.get("id"));
  const { error } = await supabase.from("pagos").insert({
    [tabla === "clientes" ? "cliente_id" : "proveedor_id"]: id,
    moneda: form.get("moneda") === "ARS" ? "ARS" : "USD",
    importe: Number(form.get("importe")),
    medio: t(form, "medio") ?? "efectivo",
    notas: t(form, "notas"),
    fecha: t(form, "fecha") ?? undefined,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/${tabla}/${id}`);
  redirect(`/${tabla}/${id}`);
}

export async function anularPago(form: FormData) {
  const supabase = await createClient();
  const tabla = form.get("tabla") === "proveedores" ? "proveedores" : "clientes";
  const id = Number(form.get("id"));
  const { error } = await supabase.from("pagos").update({ anulado: true }).eq("id", Number(form.get("pago_id")));
  if (error) throw new Error(error.message);
  revalidatePath(`/${tabla}/${id}`);
  redirect(`/${tabla}/${id}`);
}
