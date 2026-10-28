import { notFound } from "next/navigation";
import { Encabezado, Pagina } from "@/components/ui";
import { nroComprobante } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Datos del envío → Guía de despacho (A4) y Rótulo (media A4, con marca FRÁGIL)
export default async function Despacho({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: c }, { data: emp }] = await Promise.all([
    supabase.from("comprobantes").select("id, tipo, numero, clientes(nombre, telefono, direccion, localidad, cuit)").eq("id", id).maybeSingle(),
    supabase.from("empresa").select("*").single(),
  ]);
  if (!c) notFound();
  const cli = c.clientes as unknown as { nombre: string; telefono: string | null; direccion: string | null; localidad: string | null; cuit: string | null } | null;

  return (
    <>
      <Encabezado titulo={`Despacho ${nroComprobante(c.tipo, c.numero)}`} volver={`/comprobantes/${id}`} />
      <Pagina>
        <form method="get" target="_blank" className="space-y-3">
          <section className="card space-y-3">
            <h2 className="font-semibold">Remitente</h2>
            <Campo label="Nombre" name="r_nombre" v={emp?.nombre} />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Teléfono" name="r_tel" v={emp?.telefono} />
              <Campo label="Localidad" name="r_localidad" v={emp?.localidad} />
            </div>
            <Campo label="Dirección" name="r_dir" v={emp?.direccion} />
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Destinatario</h2>
            <Campo label="Nombre y apellido" name="d_nombre" v={cli?.nombre} />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="DNI / CUIT" name="d_doc" v={cli?.cuit} />
              <Campo label="Teléfono" name="d_tel" v={cli?.telefono} />
            </div>
            <Campo label="Dirección" name="d_dir" v={cli?.direccion} />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Localidad" name="d_localidad" v={cli?.localidad} />
              <Campo label="Provincia" name="d_provincia" />
            </div>
            <Campo label="Código postal" name="d_cp" />
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Envío</h2>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Transporte" name="transporte" placeholder="Correo, Andreani, Via Cargo…" />
              <Campo label="Bultos" name="bultos" v="1" type="number" />
            </div>
            <Campo label="Observaciones" name="obs" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="fragil" value="1" defaultChecked className="size-5 accent-marca" /> Marca de agua FRÁGIL en el rótulo
            </label>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <button formAction={`/pdf/despacho/${c.id}`} className="btn-primario text-sm">Guía de despacho</button>
            <button formAction={`/pdf/rotulo/${c.id}`} className="btn-secundario text-sm">Rótulo</button>
          </div>
        </form>
      </Pagina>
    </>
  );
}

function Campo({ label, name, v, ...rest }: { label: string; name: string; v?: string | null } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" name={name} defaultValue={v ?? ""} {...rest} />
    </div>
  );
}
