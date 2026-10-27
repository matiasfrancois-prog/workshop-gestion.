import Link from "next/link";
import { BotonFlotante, Buscador, Encabezado, Pagina, Saldo, Vacio } from "@/components/ui";
import { fecha } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string; orden?: string }> }) {
  const { q, orden } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("saldos_clientes").select("*").limit(300);
  if (q) query = query.ilike("nombre", `%${q}%`);
  query = orden === "deuda" ? query.order("saldo_usd", { ascending: false }) : query.order("ultimo_mov", { ascending: false, nullsFirst: false });
  const { data } = await query;

  return (
    <>
      <Encabezado titulo="Clientes" />
      <Pagina>
        <Buscador q={q} placeholder="Buscar cliente" />
        <div className="flex gap-2">
          {[
            ["", "Recientes"],
            ["deuda", "Mayor deuda"],
          ].map(([v, t]) => (
            <Link
              key={v}
              href={`/clientes?${new URLSearchParams({ ...(q ? { q } : {}), ...(v ? { orden: v } : {}) })}`}
              className={`chip h-8 px-3 border ${(orden ?? "") === v ? "bg-marca text-white border-marca" : "bg-white border-linea"}`}
            >
              {t}
            </Link>
          ))}
        </div>
        <section className="card p-0 overflow-hidden">
          {(data ?? []).map((c) => (
            <Link key={c.cliente_id} href={`/clientes/${c.cliente_id}`} className="fila">
              <div className="flex-1 min-w-0">
                <p className={`truncate font-medium ${c.habilitado ? "" : "text-suave"}`}>
                  {c.nombre} {!c.habilitado && <span className="chip bg-mal/10 text-mal ml-1">Deshabilitado</span>}
                </p>
                <p className="text-xs text-suave">Último mov. {fecha(c.ultimo_mov)}</p>
              </div>
              <div className="text-right text-sm">
                <p><Saldo valor={c.saldo_usd} moneda="USD" /></p>
                {Number(c.saldo_ars) !== 0 && <p><Saldo valor={c.saldo_ars} moneda="ARS" /></p>}
              </div>
            </Link>
          ))}
          {(data ?? []).length === 0 && <Vacio texto="No hay clientes." />}
        </section>
      </Pagina>
      <BotonFlotante href="/clientes/nuevo" label="Cliente" />
    </>
  );
}
