import { Encabezado, Pagina } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { guardarEmpresa } from "../actions";

export default async function Empresa({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const supabase = await createClient();
  const { data: e } = await supabase.from("empresa").select("*").single();
  const campos: [string, string][] = [
    ["nombre", "Nombre comercial"],
    ["razon_social", "Razón social"],
    ["cuit", "CUIT"],
    ["direccion", "Dirección"],
    ["localidad", "Localidad"],
    ["telefono", "Teléfono"],
    ["email", "Email"],
    ["pie", "Texto al pie de los comprobantes"],
  ];
  return (
    <>
      <Encabezado titulo="Datos de la empresa" volver="/mas" />
      <Pagina>
        {ok && <p className="card text-sm text-ok font-semibold">✓ Guardado</p>}
        <form action={guardarEmpresa} className="card space-y-3">
          {campos.map(([k, l]) => (
            <div key={k}>
              <label className="label">{l}</label>
              <input className="input" name={k} defaultValue={(e as Record<string, string | null> | null)?.[k] ?? ""} />
            </div>
          ))}
          <button className="btn-primario w-full">Guardar</button>
        </form>
      </Pagina>
    </>
  );
}
