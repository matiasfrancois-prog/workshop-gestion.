"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function ingresar(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error) redirect("/login?error=1");
  redirect("/");
}

export async function salir() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
