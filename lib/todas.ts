/** Supabase devuelve como máximo 1000 filas por consulta: esto pide de a páginas hasta traer todo. */
export async function todas<T>(pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>, max = 50000): Promise<T[]> {
  const tam = 1000;
  const out: T[] = [];
  for (let desde = 0; desde < max; desde += tam) {
    const { data, error } = await pagina(desde, desde + tam - 1);
    if (error) throw new Error(String((error as { message?: string }).message ?? error));
    out.push(...(data ?? []));
    if (!data || data.length < tam) break;
  }
  return out;
}
