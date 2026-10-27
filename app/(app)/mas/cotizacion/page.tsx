import { Encabezado, Pagina } from "@/components/ui";
import { fecha, num } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { guardarCotizacion } from "../actions";

export default async function Cotizacion() {
  const supabase = await createClient();
  const { data } = await supabase.from("cotizaciones").select("*").order("fecha", { ascending: false }).limit(15);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return (
    <>
      <Encabezado titulo="Dólar del día" volver="/mas" />
      <Pagina>
        <form action={guardarCotizacion} className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" name="fecha" defaultValue={hoy} required />
            </div>
            <div>
              <label className="label">1 US$ = $</label>
              <input className="input" type="number" step="0.01" inputMode="decimal" name="usd_ars" required />
            </div>
          </div>
          <button className="btn-primario w-full">Guardar</button>
        </form>
        <section className="card p-0 overflow-hidden">
          {(data ?? []).map((c) => (
            <div key={c.id} className="fila">
              <span className="flex-1">{fecha(c.fecha)}</span>
              <span className="font-semibold">$ {num(c.usd_ars)}</span>
            </div>
          ))}
        </section>
      </Pagina>
    </>
  );
}
