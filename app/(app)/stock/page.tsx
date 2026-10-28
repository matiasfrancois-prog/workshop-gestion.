import Link from "next/link";
import { Encabezado, Pagina, Vacio } from "@/components/ui";
import { num } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Rotación de los últimos 30 días: cuántos días de stock quedan a este ritmo de venta.
export default async function Stock({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista = "reponer" } = await searchParams;
  const supabase = await createClient();
  const hace30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ data: stock }, { data: ventas }, { data: camino }] = await Promise.all([
    supabase.from("stock_actual").select("producto_id, nombre, stock, stock_minimo"),
    supabase.from("movimientos_stock").select("producto_id, cantidad").eq("tipo", "venta").gte("fecha", hace30),
    supabase.from("stock_en_camino").select("producto_id, en_camino"),
  ]);
  const enCamino = new Map((camino ?? []).map((c) => [c.producto_id, Number(c.en_camino)]));

  const vendido = new Map<number, number>();
  for (const v of ventas ?? []) vendido.set(v.producto_id, (vendido.get(v.producto_id) ?? 0) - Number(v.cantidad));

  const filas = (stock ?? []).map((p) => {
    const v30 = vendido.get(p.producto_id) ?? 0;
    const dias = v30 > 0 ? Math.round(Number(p.stock) / (v30 / 30)) : null;
    return { ...p, stock: Number(p.stock), v30, dias };
  });

  const vistas: Record<string, { titulo: string; filtro: (f: (typeof filas)[number]) => boolean; orden: (a: (typeof filas)[number], b: (typeof filas)[number]) => number }> = {
    reponer: { titulo: "Reponer (≤ 7 días o bajo mínimo)", filtro: (f) => (f.dias !== null && f.dias <= 7) || (f.stock_minimo > 0 && f.stock <= f.stock_minimo), orden: (a, b) => (a.dias ?? 0) - (b.dias ?? 0) },
    sinstock: { titulo: "Sin stock con venta", filtro: (f) => f.stock <= 0 && f.v30 > 0, orden: (a, b) => b.v30 - a.v30 },
    sobrestock: { titulo: "Sobrestock (> 45 días)", filtro: (f) => f.dias !== null && f.dias > 45, orden: (a, b) => (b.dias ?? 0) - (a.dias ?? 0) },
    quieto: { titulo: "Sin rotación en 30 días", filtro: (f) => f.stock > 0 && f.v30 === 0, orden: (a, b) => b.stock - a.stock },
  };
  const actual = vistas[vista] ?? vistas.reponer;
  const lista = filas.filter(actual.filtro).sort(actual.orden);

  return (
    <>
      <Encabezado titulo="Stock" volver="/mas" />
      <Pagina>
        <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-1">
          {Object.entries(vistas).map(([k, v]) => (
            <Link key={k} href={`/stock?vista=${k}`} className={`chip h-8 px-3 whitespace-nowrap border ${vista === k ? "bg-marca text-white border-marca" : "bg-white border-linea"}`}>
              {v.titulo.split(" (")[0]}
            </Link>
          ))}
        </div>
        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 pt-3 pb-1 font-semibold">{actual.titulo}</h2>
          {lista.map((p) => (
            <Link key={p.producto_id} href={`/productos/${p.producto_id}`} className="fila">
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">📱 {p.nombre}</p>
                <p className="text-xs text-suave">
                  Vendidos 30 días: {num(p.v30)}
                  {p.dias !== null && ` · ${p.dias} días de stock`}
                  {enCamino.get(p.producto_id) ? ` · ${num(enCamino.get(p.producto_id))} en camino` : ""}
                </p>
              </div>
              <span className={`font-bold ${p.stock <= 0 ? "text-mal" : ""}`}>{num(p.stock)}</span>
            </Link>
          ))}
          {lista.length === 0 && <Vacio texto="Nada en esta lista." />}
        </section>
      </Pagina>
    </>
  );
}
