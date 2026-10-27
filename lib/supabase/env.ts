export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  return v;
}

export function supabaseKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!v) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return v;
}
