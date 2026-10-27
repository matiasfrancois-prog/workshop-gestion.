import { Encabezado, Pagina } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import FormProducto from "../FormProducto";

export default async function NuevoProducto() {
  const perfil = await getPerfil();
  const supabase = await createClient();
  const [{ data: listas }, { data: marcas }, { data: categorias }] = await Promise.all([
    supabase.from("listas_precios").select("id, nombre, margen_pct").eq("activa", true).order("orden"),
    supabase.from("marcas").select("nombre").order("nombre"),
    supabase.from("categorias").select("nombre").order("nombre"),
  ]);
  return (
    <>
      <Encabezado titulo="Nuevo producto" volver="/productos" />
      <Pagina>
        <FormProducto
          listas={listas ?? []}
          preciosManuales={{}}
          marcas={(marcas ?? []).map((m) => m.nombre)}
          categorias={(categorias ?? []).map((m) => m.nombre)}
          esAdmin={perfil.rol === "admin"}
        />
      </Pagina>
    </>
  );
}
