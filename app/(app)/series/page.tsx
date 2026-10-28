import Link from "next/link";
import { Buscador, Encabezado, Pagina, Vacio } from "@/components/ui";
import { fecha, nroComprobante, TIPOS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const ESTADO: Record<string, [string, string]> = {
  en_stock: ["En stock", "bg-ok/10 text-ok"],
  vendida: ["Vendida", "bg-marca/10 text-marca"],
  devuelta: ["Devuelta a proveedor", "bg-acento/20"],
  baja: ["Baja", "bg-mal/10 text-mal"],
};

// Buscar un IMEI: qué producto es, dónde está y todo su recorrido (útil para garantías / RMA)
export default async function Series({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const termino = (q ?? "").trim().toUpperCase();

  const unidades = termino
    ? (await supabase.from("unidades").select("id, serie, estado, costo_usd, ingreso, productos(id, nombre)").ilike("serie", `%${termino}%`).limit(20)).data ?? []
    : [];
  const historial = unidades.length
    ? (await supabase.from("historial_series").select("*").in("unidad_id", unidades.map((u) => u.id)).order("fecha")).data ?? []
    : [];

  return (
    <>
      <Encabezado titulo="Buscar IMEI / serie" volver="/mas" />
      <Pagina>
        <Buscador q={q} placeholder="IMEI o últimos dígitos" />
        {termino && unidades.length === 0 && <Vacio texto="No se encontró esa serie." />}
        {unidades.map((u) => {
          const p = u.productos as unknown as { id: number; nombre: string };
          const [txt, cls] = ESTADO[u.estado];
          return (
            <section key={u.id} className="card space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="font-mono font-semibold">{u.serie}</p>
                  <Link href={`/productos/${p.id}`} className="text-marca text-sm">📱 {p.nombre}</Link>
                </div>
                <span className={`chip ${cls}`}>{txt}</span>
              </div>
              <div className="border-t border-linea pt-2 space-y-1.5">
                {historial
                  .filter((h) => h.unidad_id === u.id)
                  .map((h) => (
                    <Link key={`${h.comprobante_id}`} href={`/comprobantes/${h.comprobante_id}`} className="flex text-sm gap-2">
                      <span className="text-suave w-20">{fecha(h.fecha)}</span>
                      <span className={`flex-1 ${h.estado === "anulado" ? "line-through text-suave" : ""}`}>
                        {TIPOS[h.tipo]?.label} {nroComprobante(h.tipo, h.numero)} · {h.tercero}
                      </span>
                    </Link>
                  ))}
              </div>
            </section>
          );
        })}
      </Pagina>
    </>
  );
}
