import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado, Pagina } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { fecha, money, nroComprobante, num } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import AjusteStock from "@/components/AjusteStock";
import { todas } from "@/lib/todas";
import FormProducto from "../FormProducto";

const TIPO_MOV: Record<string, string> = {
  compra: "Compra",
  venta: "Venta",
  nc_venta: "Devolución cliente",
  nc_compra: "Devolución proveedor",
  ajuste: "Ajuste",
};

export default async function Producto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const perfil = await getPerfil();
  const esAdmin = perfil.rol === "admin";
  const supabase = await createClient();

  const { data: p } = await supabase.from("productos").select("*, marcas(nombre), categorias(nombre)").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: listas }, { data: precios }, { data: stock }, { data: movs }, { data: marcas }, { data: categorias }] = await Promise.all([
    supabase.from("listas_precios").select("id, nombre, margen_pct").eq("activa", true).order("orden"),
    supabase.from("precios").select("lista_id, precio_usd").eq("producto_id", id),
    supabase.from("stock_actual").select("stock").eq("producto_id", id).single(),
    supabase.from("movimientos_stock").select("id, fecha, cantidad, tipo, nota, comprobantes(id, tipo, numero, clientes(nombre), proveedores(nombre))").eq("producto_id", id).order("fecha", { ascending: false }).limit(30),
    supabase.from("marcas").select("nombre").order("nombre"),
    supabase.from("categorias").select("nombre").order("nombre"),
  ]);

  const manual = Object.fromEntries((precios ?? []).map((x) => [x.lista_id, Number(x.precio_usd)]));
  const producto = {
    ...p,
    marca: (p.marcas as { nombre: string } | null)?.nombre ?? null,
    categoria: (p.categorias as { nombre: string } | null)?.nombre ?? null,
  };

  if (editar) {
    return (
      <>
        <Encabezado titulo="Editar producto" volver={`/productos/${id}`} />
        <Pagina>
          <FormProducto
            producto={producto}
            listas={listas ?? []}
            preciosManuales={manual}
            marcas={(marcas ?? []).map((m) => m.nombre)}
            categorias={(categorias ?? []).map((m) => m.nombre)}
            esAdmin={esAdmin}
          />
        </Pagina>
      </>
    );
  }

  const s = Number(stock?.stock ?? 0);
  const enStock = (
    await todas((a, b) => supabase.from("unidades").select("serie").eq("producto_id", id).eq("estado", "en_stock").order("serie").range(a, b))
  ).map((u) => u.serie as string);
  return (
    <>
      <Encabezado
        titulo={p.nombre}
        volver="/productos"
        accion={<Link href={`/productos/${id}?editar=1`} className="text-sm font-semibold px-3 py-2 rounded-lg bg-white/10">Editar</Link>}
      />
      <Pagina>
        <section className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-suave">Stock</p>
            <p className={`text-2xl font-bold ${s <= 0 ? "text-mal" : ""}`}>{num(s)}</p>
            {p.stock_minimo > 0 && <p className="text-xs text-suave">mínimo {p.stock_minimo}</p>}
          </div>
          {esAdmin && (
            <div className="card">
              <p className="text-xs text-suave">Costo promedio</p>
              <p className="text-2xl font-bold">{money(p.costo_usd)}</p>
            </div>
          )}
        </section>

        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 pt-3 pb-1 font-semibold">Precios</h2>
          {(listas ?? []).map((l) => {
            const precio = manual[l.id] ?? (l.margen_pct !== null ? Number(p.costo_usd) * (1 + Number(l.margen_pct) / 100) : 0);
            const margen = Number(p.costo_usd) > 0 ? ((precio - Number(p.costo_usd)) / Number(p.costo_usd)) * 100 : 0;
            return (
              <div key={l.id} className="fila">
                <span className="flex-1">{l.nombre}</span>
                {esAdmin && <span className="text-xs text-suave">{margen.toFixed(1)}%</span>}
                <span className="font-semibold">{money(precio)}</span>
              </div>
            );
          })}
        </section>

        {p.lleva_serie && (
          <details className="card">
            <summary className="font-semibold cursor-pointer">IMEI / series en stock ({enStock.length})</summary>
            {enStock.length !== s && <p className="text-xs text-mal mt-2">⚠️ El stock ({num(s)}) no coincide con las series cargadas ({enStock.length}).</p>}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {enStock.map((x) => (
                <Link key={x} href={`/series?q=${encodeURIComponent(x)}`} className="chip bg-fondo border border-linea font-mono text-[11px]">{x}</Link>
              ))}
            </div>
          </details>
        )}

        <details className="card">
          <summary className="font-semibold cursor-pointer">Ajustar stock</summary>
          <AjusteStock productoId={p.id} llevaSerie={p.lleva_serie} enStock={enStock} />
        </details>

        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 pt-3 pb-1 font-semibold">Movimientos</h2>
          {(movs ?? []).map((m) => {
            const c = m.comprobantes as unknown as { id: number; tipo: string; numero: number; clientes: { nombre: string } | null; proveedores: { nombre: string } | null } | null;
            const contenido = (
              <>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{c ? c.clientes?.nombre ?? c.proveedores?.nombre : TIPO_MOV[m.tipo]}</p>
                  <p className="text-xs text-suave">
                    {fecha(m.fecha)} · {c ? nroComprobante(c.tipo, c.numero) : m.nota ?? "Ajuste"}
                  </p>
                </div>
                <span className={`font-semibold ${Number(m.cantidad) < 0 ? "text-mal" : "text-ok"}`}>
                  {Number(m.cantidad) > 0 ? "+" : ""}
                  {num(m.cantidad)}
                </span>
              </>
            );
            return c ? (
              <Link key={m.id} href={`/comprobantes/${c.id}`} className="fila">{contenido}</Link>
            ) : (
              <div key={m.id} className="fila">{contenido}</div>
            );
          })}
          {(movs ?? []).length === 0 && <p className="px-4 pb-4 text-sm text-suave">Sin movimientos.</p>}
        </section>
      </Pagina>
    </>
  );
}
