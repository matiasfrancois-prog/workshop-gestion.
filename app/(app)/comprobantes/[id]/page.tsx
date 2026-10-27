import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado, Pagina } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { fecha, money, nroComprobante, num, TIPOS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { anular, convertirEnVenta } from "../actions";

export default async function Comprobante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await getPerfil();
  const esAdmin = perfil.rol === "admin";
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("comprobantes")
    .select("*, clientes(id, nombre, telefono), proveedores(id, nombre), comprobante_items(*), perfiles(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const cli = c.clientes as { id: number; nombre: string; telefono: string | null } | null;
  const prov = c.proveedores as { id: number; nombre: string } | null;
  const items = (c.comprobante_items ?? []) as { id: number; descripcion: string; cantidad: number; precio_unit: number; costo_unit: number | null; subtotal: number }[];
  const nro = nroComprobante(c.tipo, c.numero);
  const costo = items.reduce((a, i) => a + Number(i.cantidad) * Number(i.costo_unit ?? 0), 0);

  // Texto listo para WhatsApp (sin costos ni stock)
  const texto = [
    `*Work Shop* · ${TIPOS[c.tipo].label} ${nro}`,
    "",
    ...items.map((i) => `📱 ${num(i.cantidad)} x ${i.descripcion} — ${money(i.precio_unit, c.moneda)}`),
    "",
    `*Total: ${money(c.total, c.moneda)}*`,
  ].join("\n");
  const tel = (cli?.telefono ?? "").replace(/\D/g, "");
  const wa = `https://wa.me/${tel ? (tel.startsWith("54") ? tel : "549" + tel) : ""}?text=${encodeURIComponent(texto)}`;

  return (
    <>
      <Encabezado titulo={nro} volver="/comprobantes" />
      <Pagina>
        <section className="card space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-suave">{TIPOS[c.tipo].label} · {fecha(c.fecha)}</p>
            <span className={`chip ${c.estado === "anulado" ? "bg-mal/10 text-mal" : c.estado === "abierto" ? "bg-acento/20" : "bg-ok/10 text-ok"}`}>{c.estado}</span>
          </div>
          <Link href={cli ? `/clientes/${cli.id}` : `/proveedores/${prov?.id}`} className="text-lg font-semibold text-marca block">
            {cli?.nombre ?? prov?.nombre}
          </Link>
          {c.perfiles && <p className="text-xs text-suave">Cargado por {(c.perfiles as { nombre: string }).nombre}</p>}
        </section>

        <section className="card p-0 overflow-hidden">
          {items.map((i) => (
            <div key={i.id} className="fila">
              <div className="flex-1 min-w-0">
                <p className="font-medium">📱 {i.descripcion}</p>
                <p className="text-xs text-suave">
                  {num(i.cantidad)} x {money(i.precio_unit, c.moneda)}
                  {esAdmin && i.costo_unit !== null && c.tipo === "venta" && <> · costo {money(i.costo_unit)}</>}
                </p>
              </div>
              <span className="font-semibold">{money(i.subtotal, c.moneda)}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 bg-fondo">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">{money(c.total, c.moneda)}</span>
          </div>
          {esAdmin && c.tipo === "venta" && c.moneda === "USD" && costo > 0 && (
            <p className="px-4 pb-3 text-xs text-suave bg-fondo">
              Ganancia {money(Number(c.total) - costo)} ({(((Number(c.total) - costo) / costo) * 100).toFixed(1)}%)
            </p>
          )}
        </section>

        {c.observaciones && <p className="card text-sm">{c.observaciones}</p>}

        {cli && (
          <a href={wa} target="_blank" className="btn-primario w-full">
            Enviar por WhatsApp
          </a>
        )}

        {(c.tipo === "presupuesto" || (c.tipo === "pedido" && c.estado === "abierto")) && (
          <form action={convertirEnVenta}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn-secundario w-full">Convertir en venta</button>
          </form>
        )}

        {esAdmin && c.estado !== "anulado" && (
          <form action={anular}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn-peligro w-full">Anular comprobante</button>
          </form>
        )}
      </Pagina>
    </>
  );
}
