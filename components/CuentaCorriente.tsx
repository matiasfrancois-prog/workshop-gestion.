import Link from "next/link";
import { anularPago, registrarPago } from "@/app/(app)/clientes/actions";
import { fecha, money, nroComprobante, nroRecibo, type Moneda } from "@/lib/format";
import CamposCobro, { type Caja } from "./CamposCobro";

export type Mov = {
  moneda: Moneda;
  fecha: string;
  origen: "comprobante" | "pago";
  origen_id: number;
  concepto: string;
  numero: number | null;
  importe: number;
};

/** Cuenta corriente con US$ y $ separados, saldo corrido, cobros/pagos con caja y PDF. */
export default function CuentaCorriente({
  tabla,
  id,
  movs,
  esAdmin,
  cajas,
  cotizacion,
  error,
  reciboNuevo,
}: {
  tabla: "clientes" | "proveedores";
  id: number;
  movs: Mov[];
  esAdmin: boolean;
  cajas: Caja[];
  cotizacion: number;
  error?: string;
  reciboNuevo?: string;
}) {
  const esCliente = tabla === "clientes";
  return (
    <>
      {error && <p className="card text-sm text-mal">{error}</p>}
      {reciboNuevo && (
        <div className="card flex items-center gap-3 border-ok/40">
          <p className="flex-1 text-sm font-semibold text-ok">✓ {esCliente ? "Cobro registrado" : "Pago registrado"}</p>
          <a href={`/pdf/recibo/${reciboNuevo}`} target="_blank" className="btn-secundario h-10 text-sm">PDF</a>
          <a href={`/pdf/recibo/${reciboNuevo}?f=ticket`} target="_blank" className="btn-secundario h-10 text-sm">Ticket</a>
        </div>
      )}

      <details className="card" open={false}>
        <summary className="font-semibold cursor-pointer">{esCliente ? "Registrar cobro" : "Registrar pago"}</summary>
        <form action={registrarPago} className="mt-3 space-y-3">
          <input type="hidden" name="tabla" value={tabla} />
          <input type="hidden" name="id" value={id} />
          <CamposCobro cajas={cajas} cotizacion={cotizacion} monedaCuenta="USD" nombres />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input className="input" name="fecha" type="date" />
            </div>
            <div>
              <label className="label">Nota</label>
              <input className="input" name="notas" placeholder="Opcional" />
            </div>
          </div>
          <button className="btn-primario w-full">Guardar y generar {esCliente ? "recibo" : "orden de pago"}</button>
        </form>
      </details>

      <a href={`/pdf/cuenta/${tabla}/${id}`} target="_blank" className="btn-secundario w-full">
        Resumen de cuenta (PDF)
      </a>

      {(["USD", "ARS"] as Moneda[]).map((m) => {
        const lista = movs
          .filter((x) => x.moneda === m)
          .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.origen_id - b.origen_id));
        if (lista.length === 0) return null;
        let corrido = 0;
        const conSaldo = lista.map((x) => ({ ...x, saldo: (corrido += Number(x.importe)) }));
        return (
          <section key={m} className="card p-0 overflow-hidden">
            <h2 className="px-4 pt-3 pb-1 font-semibold flex justify-between">
              Cuenta en {m === "USD" ? "US$" : "$"} <span className={corrido > 0 ? "text-mal" : "text-ok"}>{money(corrido, m)}</span>
            </h2>
            {conSaldo.reverse().slice(0, 60).map((x) => (
              <div key={`${x.origen}-${x.origen_id}`} className="fila">
                <div className="flex-1 min-w-0">
                  {x.origen === "comprobante" ? (
                    <Link href={`/comprobantes/${x.origen_id}`} className="text-sm font-medium text-marca">
                      {nroComprobante(x.concepto, x.numero ?? 0)}
                    </Link>
                  ) : (
                    <a href={`/pdf/recibo/${x.origen_id}`} target="_blank" className="text-sm font-medium text-marca">
                      {nroRecibo(esCliente, x.numero ?? 0)} <span className="text-suave font-normal">{x.concepto.split("·")[1]}</span>
                    </a>
                  )}
                  <p className="text-xs text-suave">{fecha(x.fecha)} · saldo {money(x.saldo, m)}</p>
                </div>
                <span className={`font-semibold ${Number(x.importe) > 0 ? "" : "text-ok"}`}>{money(x.importe, m)}</span>
                {x.origen === "pago" && esAdmin && (
                  <form action={anularPago}>
                    <input type="hidden" name="tabla" value={tabla} />
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="pago_id" value={x.origen_id} />
                    <button className="text-xs text-mal px-1" title="Anular">✕</button>
                  </form>
                )}
              </div>
            ))}
          </section>
        );
      })}
      {movs.length === 0 && <p className="text-center text-sm text-suave py-6">Sin movimientos en cuenta corriente.</p>}
    </>
  );
}
