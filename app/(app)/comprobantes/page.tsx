import Link from "next/link";
import { Encabezado, Pagina, Vacio } from "@/components/ui";
import { fecha, money, nroComprobante, TIPOS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Comprobantes({ searchParams }: { searchParams: Promise<{ tipo?: string; cliente?: string; desde?: string }> }) {
  const { tipo, cliente, desde } = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from("comprobantes")
    .select("id, tipo, numero, fecha, total, moneda, estado, clientes(nombre), proveedores(nombre)")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(150);
  if (tipo) q = q.eq("tipo", tipo);
  if (cliente) q = q.eq("cliente_id", cliente);
  if (desde) q = q.gte("fecha", desde);
  const { data } = await q;

  const filtros: [string, string][] = [["", "Todos"], ...Object.entries(TIPOS).map(([k, v]) => [k, v.label] as [string, string])];

  return (
    <>
      <Encabezado titulo="Comprobantes" volver="/mas" />
      <Pagina>
        <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-1">
          {filtros.map(([v, t]) => (
            <Link
              key={v}
              href={`/comprobantes?${new URLSearchParams({ ...(v ? { tipo: v } : {}), ...(cliente ? { cliente } : {}) })}`}
              className={`chip h-8 px-3 whitespace-nowrap border ${(tipo ?? "") === v ? "bg-marca text-white border-marca" : "bg-white border-linea"}`}
            >
              {t}
            </Link>
          ))}
        </div>
        <form className="flex gap-2 items-end">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <div className="flex-1">
            <label className="label">Desde</label>
            <input className="input" type="date" name="desde" defaultValue={desde} />
          </div>
          <button className="btn-secundario">Filtrar</button>
        </form>
        <section className="card p-0 overflow-hidden">
          {(data ?? []).map((c) => {
            const tercero = (c.clientes as unknown as { nombre: string } | null)?.nombre ?? (c.proveedores as unknown as { nombre: string } | null)?.nombre;
            return (
              <Link key={c.id} href={`/comprobantes/${c.id}`} className="fila">
                <div className="flex-1 min-w-0">
                  <p className={`truncate font-medium ${c.estado === "anulado" ? "line-through text-suave" : ""}`}>{tercero}</p>
                  <p className="text-xs text-suave">
                    {nroComprobante(c.tipo, c.numero)} · {fecha(c.fecha)}
                    {c.estado === "abierto" && <span className="chip bg-acento/20 text-tinta ml-1">abierto</span>}
                  </p>
                </div>
                <span className="font-semibold">{money(c.total, c.moneda)}</span>
              </Link>
            );
          })}
          {(data ?? []).length === 0 && <Vacio texto="No hay comprobantes." />}
        </section>
      </Pagina>
    </>
  );
}
