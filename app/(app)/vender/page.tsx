import Carrito, { type LineaInicial } from "@/components/Carrito";
import { Encabezado, Pagina } from "@/components/ui";
import { datosCarrito } from "@/lib/carrito";
import { getCajasYCotizacion, getPerfil } from "@/lib/data";
import { nroComprobante } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const VALIDOS = ["venta", "pedido", "presupuesto", "nc_venta"] as const;

export default async function Vender({ searchParams }: { searchParams: Promise<{ cliente?: string; tipo?: string; desde?: string }> }) {
  const { cliente, tipo, desde } = await searchParams;
  const perfil = await getPerfil();
  const [{ productos, terceros, listaDefault, disponibles }, cc] = await Promise.all([datosCarrito("venta"), getCajasYCotizacion()]);

  // Convertir presupuesto / pedido en venta: se precargan cliente, ítems y precios
  let origen: { id: number; tipo: string; numero: number; cliente_id: number; moneda: "USD" | "ARS"; items: LineaInicial[] } | null = null;
  if (desde) {
    const supabase = await createClient();
    const { data } = await supabase.from("comprobantes").select("id, tipo, numero, cliente_id, moneda, comprobante_items(producto_id, descripcion, cantidad, precio_unit)").eq("id", desde).maybeSingle();
    if (data) origen = { ...data, items: (data.comprobante_items as LineaInicial[]).map((i) => ({ ...i, cantidad: Number(i.cantidad), precio_unit: Number(i.precio_unit) })) };
  }

  const t = origen ? "venta" : (VALIDOS as readonly string[]).includes(tipo ?? "") ? (tipo as (typeof VALIDOS)[number]) : "venta";
  return (
    <>
      <Encabezado titulo={origen ? `Venta desde ${nroComprobante(origen.tipo, origen.numero)}` : "Nuevo comprobante"} volver={origen ? `/comprobantes/${origen.id}` : undefined} />
      <Pagina>
        <Carrito
          modo="venta"
          tipoInicial={t}
          terceros={terceros}
          terceroInicial={origen?.cliente_id ?? (cliente ? Number(cliente) : null)}
          productos={productos}
          disponibles={disponibles}
          listaDefault={listaDefault}
          verCostos={perfil.rol === "admin"}
          cajas={cc.cajas}
          cotizacion={cc.cotizacion}
          lineasIniciales={origen?.items}
          monedaInicial={origen?.moneda}
          origenId={origen?.id}
        />
      </Pagina>
    </>
  );
}
