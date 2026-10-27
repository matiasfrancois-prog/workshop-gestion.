import Link from "next/link";
import { BotonFlotante, Buscador, Encabezado, Pagina, Saldo, Vacio } from "@/components/ui";
import { fecha } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Proveedores({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("saldos_proveedores").select("*").order("nombre").limit(300);
  if (q) query = query.ilike("nombre", `%${q}%`);
  const { data } = await query;

  return (
    <>
      <Encabezado titulo="Proveedores" volver="/mas" />
      <Pagina>
        <Buscador q={q} placeholder="Buscar proveedor" />
        <section className="card p-0 overflow-hidden">
          {(data ?? []).map((p) => (
            <Link key={p.proveedor_id} href={`/proveedores/${p.proveedor_id}`} className="fila">
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{p.nombre}</p>
                <p className="text-xs text-suave">Último mov. {fecha(p.ultimo_mov)}</p>
              </div>
              <div className="text-right text-sm">
                <p><Saldo valor={p.saldo_usd} moneda="USD" /></p>
                {Number(p.saldo_ars) !== 0 && <p><Saldo valor={p.saldo_ars} moneda="ARS" /></p>}
              </div>
            </Link>
          ))}
          {(data ?? []).length === 0 && <Vacio texto="No hay proveedores." />}
        </section>
      </Pagina>
      <BotonFlotante href="/proveedores/nuevo" label="Proveedor" />
    </>
  );
}
