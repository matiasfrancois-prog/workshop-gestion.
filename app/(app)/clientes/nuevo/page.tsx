import FormTercero from "@/components/FormTercero";
import { Encabezado, Pagina } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function NuevoCliente() {
  const supabase = await createClient();
  const { data: listas } = await supabase.from("listas_precios").select("id, nombre").eq("activa", true).order("orden");
  return (
    <>
      <Encabezado titulo="Nuevo cliente" volver="/clientes" />
      <Pagina>
        <FormTercero tabla="clientes" listas={listas ?? []} />
      </Pagina>
    </>
  );
}
