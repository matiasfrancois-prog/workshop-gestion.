import Link from "next/link";
import { Encabezado, Pagina } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { money, nroComprobante, num } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Inicio() {
  const perfil = await getPerfil();
  const supabase = await createClient();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const inicioMes = hoy.slice(0, 8) + "01";

  const [ventasMes, saldos, stock, cotiz, ultimos] = await Promise.all([
    supabase.from("comprobantes").select("tipo, fecha, moneda, total").in("tipo", ["venta", "nc_venta"]).eq("estado", "confirmado").gte("fecha", inicioMes),
    supabase.from("saldos_clientes").select("saldo_usd, saldo_ars"),
    supabase.from("stock_actual").select("producto_id, nombre, stock, stock_minimo"),
    supabase.from("cotizaciones").select("fecha, usd_ars").order("fecha", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("comprobantes").select("id, tipo, numero, fecha, total, moneda, clientes(nombre), proveedores(nombre)").order("creado", { ascending: false }).limit(6),
  ]);

  const suma = (rows: { tipo: string; total: number; moneda: string }[], m: string) =>
    rows.filter((r) => r.moneda === m).reduce((a, r) => a + (r.tipo === "venta" ? 1 : -1) * Number(r.total), 0);
  const vm = ventasMes.data ?? [];
  const vh = vm.filter((r) => r.fecha === hoy);
  const aCobrarUsd = (saldos.data ?? []).reduce((a, r) => a + Math.max(0, Number(r.saldo_usd)), 0);
  const aCobrarArs = (saldos.data ?? []).reduce((a, r) => a + Math.max(0, Number(r.saldo_ars)), 0);
  const bajos = (stock.data ?? []).filter((p) => Number(p.stock_minimo) > 0 && Number(p.stock) <= Number(p.stock_minimo));

  return (
    <>
      <Encabezado titulo={`Hola, ${perfil.nombre}`} />
      <Pagina>
        <section className="grid grid-cols-2 gap-3">
          <Kpi titulo="Ventas hoy" valor={money(suma(vh, "USD"))} sub={suma(vh, "ARS") ? money(suma(vh, "ARS"), "ARS") : undefined} />
          <Kpi titulo="Ventas del mes" valor={money(suma(vm, "USD"))} sub={suma(vm, "ARS") ? money(suma(vm, "ARS"), "ARS") : undefined} />
          <Kpi titulo="A cobrar" valor={money(aCobrarUsd)} sub={aCobrarArs ? money(aCobrarArs, "ARS") : undefined} href="/clientes?orden=deuda" />
          <Kpi
            titulo="Dólar del día"
            valor={cotiz.data ? `$ ${num(cotiz.data.usd_ars)}` : "Cargar"}
            sub={cotiz.data && cotiz.data.fecha !== hoy ? "No es de hoy" : undefined}
            href="/mas/cotizacion"
          />
        </section>

        <section className="grid grid-cols-3 gap-2">
          <Atajo href="/vender?tipo=presupuesto" texto="Presupuesto" />
          <Atajo href="/vender?tipo=pedido" texto="Pedido" />
          <Atajo href="/comprar" texto="Compra" />
        </section>

        {bajos.length > 0 && (
          <section className="card p-0 overflow-hidden">
            <h2 className="px-4 pt-3 pb-2 font-semibold flex items-center justify-between">
              Stock bajo <span className="chip bg-mal/10 text-mal">{bajos.length}</span>
            </h2>
            {bajos.slice(0, 6).map((p) => (
              <Link key={p.producto_id} href={`/productos/${p.producto_id}`} className="fila">
                <span className="flex-1 truncate">📱 {p.nombre}</span>
                <span className="text-mal font-semibold">{num(p.stock)}</span>
              </Link>
            ))}
          </section>
        )}

        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 pt-3 pb-2 font-semibold flex items-center justify-between">
            Últimos movimientos
            <Link href="/comprobantes" className="text-sm text-marca">Ver todos</Link>
          </h2>
          {(ultimos.data ?? []).map((c) => {
            const tercero = (c.clientes as unknown as { nombre: string } | null)?.nombre ?? (c.proveedores as unknown as { nombre: string } | null)?.nombre;
            return (
              <Link key={c.id} href={`/comprobantes/${c.id}`} className="fila">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{tercero}</p>
                  <p className="text-xs text-suave">{nroComprobante(c.tipo, c.numero)}</p>
                </div>
                <span className="font-semibold">{money(c.total, c.moneda)}</span>
              </Link>
            );
          })}
          {(ultimos.data ?? []).length === 0 && <p className="px-4 pb-4 text-sm text-suave">Todavía no hay comprobantes.</p>}
        </section>
      </Pagina>
    </>
  );
}

function Kpi({ titulo, valor, sub, href }: { titulo: string; valor: string; sub?: string; href?: string }) {
  const body = (
    <div className="card h-full">
      <p className="text-[12px] text-suave font-medium">{titulo}</p>
      <p className="text-[19px] font-bold mt-1 leading-tight">{valor}</p>
      {sub && <p className="text-[12px] text-suave mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Atajo({ href, texto }: { href: string; texto: string }) {
  return (
    <Link href={href} className="btn-secundario text-[14px] h-11">
      {texto}
    </Link>
  );
}
