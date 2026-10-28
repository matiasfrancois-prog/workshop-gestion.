import { notFound } from "next/navigation";
import Carrito from "@/components/Carrito";
import { Encabezado, Pagina } from "@/components/ui";
import { datosCarrito } from "@/lib/carrito";
import { getCajasYCotizacion, getPerfil } from "@/lib/data";
import { nroComprobante } from "@/lib/format";
import { precargar } from "@/lib/precarga";

const COMPRAS = ["compra", "nc_compra", "nd_compra", "orden_compra"];

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await getPerfil();
  const c = await precargar(id, true);
  if (!c) notFound();
  if (c.estado === "anulado") notFound();
  const modo = COMPRAS.includes(c.tipo) ? "compra" : "venta";
  const [datos, cc] = await Promise.all([datosCarrito(modo), getCajasYCotizacion()]);

  // Las series propias de este comprobante cuentan como disponibles para volver a elegirlas
  const disponibles = { ...datos.disponibles };
  if (c.tipo === "venta" || c.tipo === "nc_compra") {
    for (const it of c.items) if (it.producto_id && it.series?.length) disponibles[it.producto_id] = [...(disponibles[it.producto_id] ?? []), ...it.series];
  }

  return (
    <>
      <Encabezado titulo={`Modificar ${nroComprobante(c.tipo, c.numero)}`} volver={`/comprobantes/${id}`} />
      <Pagina>
        <p className="card text-xs text-suave">
          Al guardar se recalculan stock, IMEI, costo promedio y cuenta corriente. El número no cambia y queda registrado quién lo modificó.
        </p>
        <Carrito
          modo={modo}
          tipoInicial={c.tipo as never}
          terceros={datos.terceros}
          terceroInicial={c.cliente_id ?? c.proveedor_id}
          productos={datos.productos}
          disponibles={disponibles}
          listaDefault={datos.listaDefault}
          verCostos={perfil.rol === "admin"}
          cajas={cc.cajas}
          cotizacion={cc.cotizacion}
          lineasIniciales={c.items}
          monedaInicial={c.moneda}
          cabecera={c.cabecera}
          editar={{ id: c.id, titulo: nroComprobante(c.tipo, c.numero) }}
        />
      </Pagina>
    </>
  );
}
