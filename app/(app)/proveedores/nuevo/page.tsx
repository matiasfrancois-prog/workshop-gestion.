import FormTercero from "@/components/FormTercero";
import { Encabezado, Pagina } from "@/components/ui";

export default function NuevoProveedor() {
  return (
    <>
      <Encabezado titulo="Nuevo proveedor" volver="/proveedores" />
      <Pagina>
        <FormTercero tabla="proveedores" />
      </Pagina>
    </>
  );
}
