import { Encabezado, Pagina } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { guardarLista } from "../actions";

export default async function Listas() {
  const supabase = await createClient();
  const { data } = await supabase.from("listas_precios").select("*").order("orden");
  return (
    <>
      <Encabezado titulo="Listas de precios" volver="/mas" />
      <Pagina>
        <p className="text-xs text-suave px-1">
          Margen % se aplica sobre el costo. Si lo dejás vacío, los precios de esa lista se cargan a mano en cada producto. La primera lista activa es la que se usa por defecto.
        </p>
        {[...(data ?? []), null].map((l) => (
          <form key={l?.id ?? "nueva"} action={guardarLista} className="card space-y-3">
            {l && <input type="hidden" name="id" value={l.id} />}
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
              <div>
                <label className="label">{l ? "Nombre" : "Nueva lista"}</label>
                <input className="input" name="nombre" defaultValue={l?.nombre} required />
              </div>
              <div>
                <label className="label">Margen %</label>
                <input className="input" name="margen_pct" type="number" step="0.1" inputMode="decimal" defaultValue={l?.margen_pct ?? ""} />
              </div>
              <div>
                <label className="label">Orden</label>
                <input className="input" name="orden" type="number" inputMode="numeric" defaultValue={l?.orden ?? (data?.length ?? 0) + 1} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="activa" defaultChecked={l?.activa ?? true} className="size-5 accent-marca" /> Activa
              </label>
              <button className="btn-secundario h-10">{l ? "Guardar" : "Crear"}</button>
            </div>
          </form>
        ))}
      </Pagina>
    </>
  );
}
