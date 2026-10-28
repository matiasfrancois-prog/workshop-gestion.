"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function volver(error?: string) {
  revalidatePath("/", "layout");
  redirect(error ? `/caja?error=${encodeURIComponent(error)}` : "/caja?ok=1");
}

export async function movimientoManual(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("movimiento_caja", {
    p_caja_id: Number(form.get("caja_id")),
    p_tipo: String(form.get("tipo")),
    p_importe: Number(form.get("importe")),
    p_concepto: String(form.get("concepto") ?? "").trim() || null,
    p_fecha: String(form.get("fecha") || "") || undefined,
    p_categoria_id: form.get("tipo") === "gasto" && form.get("categoria_id") ? Number(form.get("categoria_id")) : null,
  });
  volver(error?.message);
}

export async function guardarCategoria(form: FormData) {
  const supabase = await createClient();
  const id = form.get("id");
  const datos = { nombre: String(form.get("nombre")).trim(), activa: form.get("activa") === "on", orden: Number(form.get("orden") ?? 0) };
  const { error } = id ? await supabase.from("categorias_gasto").update(datos).eq("id", Number(id)) : await supabase.from("categorias_gasto").insert(datos);
  revalidatePath("/", "layout");
  redirect(`/mas/categorias${error ? `?error=${encodeURIComponent(error.message)}` : ""}`);
}

export async function transferencia(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("transferir_caja", {
    p_origen: Number(form.get("origen")),
    p_importe_origen: Number(form.get("importe_origen")),
    p_destino: Number(form.get("destino")),
    p_importe_destino: Number(form.get("importe_destino")),
    p_concepto: String(form.get("concepto") ?? "").trim() || "Cambio / transferencia",
    p_fecha: String(form.get("fecha") || "") || undefined,
  });
  volver(error?.message);
}

export async function anularMovimiento(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_movimiento_caja", { p_id: Number(form.get("id")) });
  volver(error?.message);
}

/** Saldo inicial o arqueo: se carga lo que hay realmente y se registra la diferencia. */
export async function fijarSaldo(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fijar_saldo_caja", {
    p_caja_id: Number(form.get("caja_id")),
    p_saldo_real: Number(form.get("saldo_real")),
    p_tipo: form.get("tipo") === "saldo_inicial" ? "saldo_inicial" : "arqueo",
    p_concepto: String(form.get("concepto") ?? "").trim() || null,
    p_fecha: String(form.get("fecha") || "") || undefined,
  });
  volver(error?.message);
}
