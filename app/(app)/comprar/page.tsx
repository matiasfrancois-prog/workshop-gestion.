import Carrito from "@/components/Carrito";
import { Encabezado, Pagina } from "@/components/ui";
import { datosCarrito } from "@/lib/carrito";
import { getPerfil } from "@/lib/data";

export default async function Comprar({ searchParams }: { searchParams: Promise<{ proveedor?: string }> }) {
  const { proveedor } = await searchParams;
  const perfil = await getPerfil();
  const { productos, terceros } = await datosCarrito("compra");
  return (
    <>
      <Encabezado titulo="Cargar compra" volver="/mas" />
      <Pagina>
        <p className="text-xs text-suave">Al confirmar una compra en dólares se actualiza el costo de cada producto.</p>
        <Carrito
          modo="compra"
          tipoInicial="compra"
          terceros={terceros}
          terceroInicial={proveedor ? Number(proveedor) : null}
          productos={productos}
          listaDefault={null}
          verCostos={perfil.rol === "admin"}
        />
      </Pagina>
    </>
  );
}
