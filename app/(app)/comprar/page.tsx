import Carrito from "@/components/Carrito";
import { Encabezado, Pagina } from "@/components/ui";
import { datosCarrito } from "@/lib/carrito";
import { getCajasYCotizacion, getPerfil } from "@/lib/data";

export default async function Comprar({ searchParams }: { searchParams: Promise<{ proveedor?: string }> }) {
  const { proveedor } = await searchParams;
  const perfil = await getPerfil();
  const [{ productos, terceros, disponibles }, cc] = await Promise.all([datosCarrito("compra"), getCajasYCotizacion()]);
  return (
    <>
      <Encabezado titulo="Cargar compra" volver="/mas" />
      <Pagina>
        <p className="text-xs text-suave">El costo de cada producto se recalcula por promedio ponderado con lo que ya hay en stock.</p>
        <Carrito
          modo="compra"
          tipoInicial="compra"
          terceros={terceros}
          terceroInicial={proveedor ? Number(proveedor) : null}
          productos={productos}
          disponibles={disponibles}
          listaDefault={null}
          verCostos={perfil.rol === "admin"}
          cajas={cc.cajas}
          cotizacion={cc.cotizacion}
        />
      </Pagina>
    </>
  );
}
