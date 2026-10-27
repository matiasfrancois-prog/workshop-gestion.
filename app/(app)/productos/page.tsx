import Link from "next/link";
import { BotonFlotante, Buscador, Encabezado, Pagina, Vacio } from "@/components/ui";
import { getPerfil, precioEnLista, type Lista } from "@/lib/data";
import { money, num } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Productos({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  const { q, filtro } = await searchParams;
  const perfil = await getPerfil();
  const supabase = await createClient();

  let query = supabase.from("productos").select("id, nombre, codigo, costo_usd, stock_minimo, activo").order("nombre").limit(200);
  if (q) for (const palabra of q.trim().split(/\s+/)) query = query.ilike("nombre", `%${palabra}%`);
  if (filtro !== "inactivos") query = query.eq("activo", true);

  const [{ data: productos }, { data: stock }, { data: reservado }, { data: listas }, { data: precios }] = await Promise.all([
    query,
    supabase.from("stock_actual").select("producto_id, stock"),
    supabase.from("stock_reservado").select("producto_id, reservado"),
    supabase.from("listas_precios").select("*").eq("activa", true).order("orden"),
    supabase.from("precios").select("producto_id, lista_id, precio_usd"),
  ]);

  const stockMap = new Map((stock ?? []).map((s) => [s.producto_id, Number(s.stock)]));
  const resMap = new Map((reservado ?? []).map((s) => [s.producto_id, Number(s.reservado)]));
  const manual = new Map((precios ?? []).map((p) => [`${p.producto_id}-${p.lista_id}`, Number(p.precio_usd)]));
  const listaBase = (listas ?? [])[0] as Lista | undefined;

  let filas = productos ?? [];
  if (filtro === "con-stock") filas = filas.filter((p) => (stockMap.get(p.id) ?? 0) > 0);
  if (filtro === "sin-stock") filas = filas.filter((p) => (stockMap.get(p.id) ?? 0) <= 0);

  return (
    <>
      <Encabezado titulo="Productos" />
      <Pagina>
        <Buscador q={q} placeholder="Buscar: a17 128, g06…" />
        <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-1">
          {[
            ["", "Todos"],
            ["con-stock", "Con stock"],
            ["sin-stock", "Sin stock"],
            ["inactivos", "Incluir inactivos"],
          ].map(([v, t]) => (
            <Link
              key={v}
              href={`/productos?${new URLSearchParams({ ...(q ? { q } : {}), ...(v ? { filtro: v } : {}) })}`}
              className={`chip h-8 px-3 whitespace-nowrap border ${(filtro ?? "") === v ? "bg-marca text-white border-marca" : "bg-white border-linea text-tinta"}`}
            >
              {t}
            </Link>
          ))}
        </div>

        <section className="card p-0 overflow-hidden">
          {filas.map((p) => {
            const s = stockMap.get(p.id) ?? 0;
            const r = resMap.get(p.id) ?? 0;
            const precio = precioEnLista(Number(p.costo_usd), listaBase, manual, p.id);
            return (
              <Link key={p.id} href={`/productos/${p.id}`} className="fila">
                <div className="flex-1 min-w-0">
                  <p className={`truncate font-medium ${p.activo ? "" : "text-suave line-through"}`}>📱 {p.nombre}</p>
                  <p className="text-xs text-suave">
                    {listaBase?.nombre}: {money(precio)}
                    {perfil.rol === "admin" && <> · costo {money(p.costo_usd)}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${s <= 0 ? "text-mal" : s <= p.stock_minimo ? "text-acento" : ""}`}>{num(s)}</p>
                  {r > 0 && <p className="text-[11px] text-suave">{num(r)} reserv.</p>}
                </div>
              </Link>
            );
          })}
          {filas.length === 0 && <Vacio texto="No hay productos para mostrar." />}
        </section>
      </Pagina>
      <BotonFlotante href="/productos/nuevo" label="Producto" />
    </>
  );
}
