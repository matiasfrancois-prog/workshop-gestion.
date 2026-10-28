import Carrito from "@/components/Carrito";
import { Encabezado, Pagina } from "@/components/ui";
import { datosCarrito } from "@/lib/carrito";
import { getCajasYCotizacion, getPerfil } from "@/lib/data";
import { nroComprobante } from "@/lib/format";
import { precargar } from "@/lib/precarga";

export default async function Comprar({ searchParams }: { searchParams: Promise<{ proveedor?: string; desde?: string; copiar?: string; tipo?: string }> }) {
  const { proveedor, desde, copiar, tipo } = await searchParams;
  const perfil = await getPerfil();
  const [{ productos, terceros, disponibles }, cc] = await Promise.all([datosCarrito("compra"), getCajasYCotizacion()]);

  // desde = recibir una orden de compra · copiar = duplicar un comprobante
  const base = desde ? await precargar(desde, false) : copiar ? await precargar(copiar, false) : null;
  const titulo = desde && base ? `Recibir ${nroComprobante(base.tipo, base.numero)}` : copiar && base ? `Copia de ${nroComprobante(base.tipo, base.numero)}` : "Nueva compra";
  const tipoInicial = desde ? "compra" : ((base?.tipo ?? tipo ?? "compra") as "compra");

  return (
    <>
      <Encabezado titulo={titulo} volver={base ? `/comprobantes/${base.id}` : "/comprobantes?grupo=compras"} />
      <Pagina>
        {desde && <p className="card text-xs text-suave">Cargá los IMEI de lo que llegó y ajustá cantidades o precios si hace falta. Al confirmar, la orden queda cerrada.</p>}
        <Carrito
          modo="compra"
          tipoInicial={tipoInicial}
          terceros={terceros}
          terceroInicial={base?.proveedor_id ?? (proveedor ? Number(proveedor) : null)}
          productos={productos}
          disponibles={disponibles}
          listaDefault={null}
          verCostos={perfil.rol === "admin"}
          cajas={cc.cajas}
          cotizacion={cc.cotizacion}
          lineasIniciales={base?.items}
          monedaInicial={base?.moneda}
          cabecera={base ? { nro_externo: base.cabecera.nro_externo, observaciones: base.cabecera.observaciones } : undefined}
          origenId={desde ? base?.id : null}
        />
      </Pagina>
    </>
  );
}
