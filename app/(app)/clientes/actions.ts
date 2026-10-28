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

/** Cobro a cliente o pago a proveedor: genera recibo / orden de pago y mueve la caja. */
export async function registrarPago(form: FormData) {
  const supabase = await createClient();
  const tabla = form.get("tabla") === "proveedores" ? "proveedores" : "clientes";
  const id = Number(form.get("id"));
  const { data, error } = await supabase.rpc("registrar_pago", {
    p_cliente_id: tabla === "clientes" ? id : null,
    p_proveedor_id: tabla === "proveedores" ? id : null,
    p_caja_id: Number(form.get("caja_id")),
    p_importe_caja: Number(form.get("importe_caja")),
    p_moneda: form.get("moneda") === "ARS" ? "ARS" : "USD",
    p_importe: Number(form.get("importe")),
    p_fecha: t(form, "fecha") ?? undefined,
    p_notas: t(form, "notas"),
  });
  if (error) redirect(`/${tabla}/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(`/${tabla}/${id}?recibo=${data}`);
}

export async function anularPago(form: FormData) {
  const supabase = await createClient();
  const tabla = form.get("tabla") === "proveedores" ? "proveedores" : "clientes";
  const id = Number(form.get("id"));
  const { error } = await supabase.rpc("anular_pago", { p_id: Number(form.get("pago_id")) });
  if (error) redirect(`/${tabla}/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(`/${tabla}/${id}`);
}

/** Nota de crédito / débito sin mercadería (descuento, diferencia de cambio, saldo inicial…). */
export async function registrarNota(form: FormData) {
  const supabase = await createClient();
  const tabla = form.get("tabla") === "proveedores" ? "proveedores" : "clientes";
  const id = Number(form.get("id"));
  const clase = form.get("clase") === "nd" ? "nd" : "nc";
  const { data, error } = await supabase.rpc("nota_cuenta", {
    p_tipo: `${clase}_${tabla === "clientes" ? "venta" : "compra"}`,
    p_cliente_id: tabla === "clientes" ? id : null,
    p_proveedor_id: tabla === "proveedores" ? id : null,
    p_moneda: form.get("moneda") === "ARS" ? "ARS" : "USD",
    p_importe: Number(form.get("importe")),
    p_concepto: t(form, "concepto"),
    p_fecha: t(form, "fecha") ?? undefined,
  });
  if (error) redirect(`/${tabla}/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(`/comprobantes/${data}?nuevo=1`);
}
