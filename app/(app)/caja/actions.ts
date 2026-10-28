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
  });
  volver(error?.message);
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
