import { guardarCategoria } from "@/app/(app)/caja/actions";
import { Encabezado, Pagina } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function Categorias({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("categorias_gasto").select("*").order("orden");
  return (
    <>
      <Encabezado titulo="Categorías de gasto" volver="/mas" />
      <Pagina>
        {error && <p className="card text-sm text-mal">{error}</p>}
        {[...(data ?? []), null].map((c) => (
          <form key={c?.id ?? "nueva"} action={guardarCategoria} className="card grid grid-cols-[1fr_70px_auto] gap-2 items-end">
            {c && <input type="hidden" name="id" value={c.id} />}
            <div>
              <label className="label">{c ? "Nombre" : "Nueva categoría"}</label>
              <input className="input h-10" name="nombre" defaultValue={c?.nombre} required />
            </div>
            <div>
              <label className="label">Orden</label>
              <input className="input h-10" name="orden" type="number" defaultValue={c?.orden ?? (data?.length ?? 0) + 1} />
            </div>
            <button className="btn-secundario h-10">{c ? "Guardar" : "Crear"}</button>
            <label className="col-span-3 flex items-center gap-2 text-sm">
              <input type="checkbox" name="activa" defaultChecked={c?.activa ?? true} className="size-5 accent-marca" /> Activa
            </label>
          </form>
        ))}
      </Pagina>
    </>
  );
}
