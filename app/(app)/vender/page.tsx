import Carrito from "@/components/Carrito";
import { Encabezado, Pagina } from "@/components/ui";
import { datosCarrito } from "@/lib/carrito";
import { getPerfil } from "@/lib/data";

const VALIDOS = ["venta", "pedido", "presupuesto", "nc_venta"] as const;

export default async function Vender({ searchParams }: { searchParams: Promise<{ cliente?: string; tipo?: string }> }) {
  const { cliente, tipo } = await searchParams;
  const perfil = await getPerfil();
  const { productos, terceros, listaDefault } = await datosCarrito("venta");
  const t = (VALIDOS as readonly string[]).includes(tipo ?? "") ? (tipo as (typeof VALIDOS)[number]) : "venta";
  return (
    <>
      <Encabezado titulo="Nuevo comprobante" />
      <Pagina>
        <Carrito
          modo="venta"
          tipoInicial={t}
          terceros={terceros}
          terceroInicial={cliente ? Number(cliente) : null}
          productos={productos}
          listaDefault={listaDefault}
          verCostos={perfil.rol === "admin"}
        />
      </Pagina>
    </>
  );
}
