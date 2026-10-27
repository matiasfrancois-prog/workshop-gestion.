import Link from "next/link";
import { notFound } from "next/navigation";
import CuentaCorriente, { type Mov } from "@/components/CuentaCorriente";
import FormTercero from "@/components/FormTercero";
import { Encabezado, Pagina, Saldo } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Cliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const perfil = await getPerfil();
  const supabase = await createClient();
  const { data: c } = await supabase.from("clientes").select("*, listas_precios(nombre)").eq("id", id).maybeSingle();
  if (!c) notFound();

  if (editar) {
    const { data: listas } = await supabase.from("listas_precios").select("id, nombre").eq("activa", true).order("orden");
    return (
      <>
        <Encabezado titulo="Editar cliente" volver={`/clientes/${id}`} />
        <Pagina>
          <FormTercero tabla="clientes" t={c} listas={listas ?? []} />
        </Pagina>
      </>
    );
  }

  const [{ data: saldo }, { data: movs }] = await Promise.all([
    supabase.from("saldos_clientes").select("saldo_usd, saldo_ars").eq("cliente_id", id).single(),
    supabase.from("ctacte_clientes").select("*").eq("cliente_id", id),
  ]);
  const tel = (c.telefono ?? "").replace(/\D/g, "");
  const excedido = c.limite_credito_usd !== null && Number(saldo?.saldo_usd ?? 0) > Number(c.limite_credito_usd);

  return (
    <>
      <Encabezado
        titulo={c.nombre}
        volver="/clientes"
        accion={<Link href={`/clientes/${id}?editar=1`} className="text-sm font-semibold px-3 py-2 rounded-lg bg-white/10">Editar</Link>}
      />
      <Pagina>
        {!c.habilitado && <p className="card border-mal/30 text-mal text-sm">Cliente deshabilitado.</p>}
        <section className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-suave">Saldo US$</p>
            <p className="text-xl"><Saldo valor={saldo?.saldo_usd ?? 0} moneda="USD" /></p>
            {c.limite_credito_usd !== null && (
              <p className={`text-xs ${excedido ? "text-mal font-semibold" : "text-suave"}`}>Límite {money(c.limite_credito_usd)}</p>
            )}
          </div>
          <div className="card">
            <p className="text-xs text-suave">Saldo $</p>
            <p className="text-xl"><Saldo valor={saldo?.saldo_ars ?? 0} moneda="ARS" /></p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <Link href={`/vender?cliente=${id}`} className="btn-primario text-sm">Vender</Link>
          <Link href={`/vender?cliente=${id}&tipo=presupuesto`} className="btn-secundario text-sm">Presup.</Link>
          {tel ? (
            <a href={`https://wa.me/${tel.startsWith("54") ? tel : "549" + tel}`} className="btn-secundario text-sm">WhatsApp</a>
          ) : (
            <Link href={`/comprobantes?cliente=${id}`} className="btn-secundario text-sm">Historial</Link>
          )}
        </section>

        <section className="card text-sm space-y-1">
          {c.razon_social && <p><span className="text-suave">Razón social:</span> {c.razon_social}</p>}
          {c.cuit && <p><span className="text-suave">CUIT:</span> {c.cuit}</p>}
          {c.telefono && <p><span className="text-suave">Tel:</span> {c.telefono}</p>}
          {c.direccion && <p><span className="text-suave">Dirección:</span> {c.direccion} {c.localidad}</p>}
          <p><span className="text-suave">Lista:</span> {(c.listas_precios as { nombre: string } | null)?.nombre ?? "—"}</p>
          {c.notas && <p className="text-suave">{c.notas}</p>}
        </section>

        <CuentaCorriente tabla="clientes" id={c.id} movs={(movs ?? []) as Mov[]} esAdmin={perfil.rol === "admin"} />
      </Pagina>
    </>
  );
}
