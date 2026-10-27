import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Perfil = { id: string; nombre: string; rol: "admin" | "vendedor"; activo: boolean };

export async function getPerfil(): Promise<Perfil> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!data || !data.activo) redirect("/login?error=sin-perfil");
  return data as Perfil;
}

export type Lista = { id: number; nombre: string; margen_pct: number | null; activa: boolean };

/** Precio de un producto en una lista: precio manual si existe, si no costo + margen. */
export function precioEnLista(
  costo: number,
  lista: Lista | undefined,
  manual: Map<string, number>,
  productoId: number,
): number {
  if (!lista) return 0;
  const m = manual.get(`${productoId}-${lista.id}`);
  if (m !== undefined) return m;
  if (lista.margen_pct === null) return 0;
  return Math.round(costo * (1 + Number(lista.margen_pct) / 100) * 100) / 100;
}
