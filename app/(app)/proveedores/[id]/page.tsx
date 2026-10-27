import Link from "next/link";
import { notFound } from "next/navigation";
import CuentaCorriente, { type Mov } from "@/components/CuentaCorriente";
import FormTercero from "@/components/FormTercero";
import { Encabezado, Pagina, Saldo } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function Proveedor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const perfil = await getPerfil();
  const supabase = await createClient();
  const { data: p } = await supabase.from("proveedores").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  if (editar) {
    return (
      <>
        <Encabezado titulo="Editar proveedor" volver={`/proveedores/${id}`} />
        <Pagina>
          <FormTercero tabla="proveedores" t={p} />
        </Pagina>
      </>
    );
  }

  const [{ data: saldo }, { data: movs }] = await Promise.all([
    supabase.from("saldos_proveedores").select("saldo_usd, saldo_ars").eq("proveedor_id", id).single(),
    supabase.from("ctacte_proveedores").select("*").eq("proveedor_id", id),
  ]);

  return (
    <>
      <Encabezado
        titulo={p.nombre}
        volver="/proveedores"
        accion={<Link href={`/proveedores/${id}?editar=1`} className="text-sm font-semibold px-3 py-2 rounded-lg bg-white/10">Editar</Link>}
      />
      <Pagina>
        <section className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-suave">Le debemos US$</p>
            <p className="text-xl"><Saldo valor={saldo?.saldo_usd ?? 0} moneda="USD" /></p>
          </div>
          <div className="card">
            <p className="text-xs text-suave">Le debemos $</p>
            <p className="text-xl"><Saldo valor={saldo?.saldo_ars ?? 0} moneda="ARS" /></p>
          </div>
        </section>
        <Link href={`/comprar?proveedor=${id}`} className="btn-primario w-full">Cargar compra</Link>
        <CuentaCorriente tabla="proveedores" id={p.id} movs={(movs ?? []) as Mov[]} esAdmin={perfil.rol === "admin"} />
      </Pagina>
    </>
  );
}
