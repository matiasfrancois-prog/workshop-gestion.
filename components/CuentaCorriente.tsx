import Link from "next/link";
import { anularPago, registrarPago } from "@/app/(app)/clientes/actions";
import { fecha, money, nroComprobante, type Moneda } from "@/lib/format";

export type Mov = {
  moneda: Moneda;
  fecha: string;
  origen: "comprobante" | "pago";
  origen_id: number;
  concepto: string;
  numero: number | null;
  importe: number;
};

/** Cuenta corriente con USD y ARS separados, saldo corrido y alta de pagos. */
export default function CuentaCorriente({ tabla, id, movs, esAdmin }: { tabla: "clientes" | "proveedores"; id: number; movs: Mov[]; esAdmin: boolean }) {
  const esCliente = tabla === "clientes";
  return (
    <>
      <details className="card">
        <summary className="font-semibold cursor-pointer">{esCliente ? "Registrar cobro" : "Registrar pago"}</summary>
        <form action={registrarPago} className="mt-3 space-y-3">
          <input type="hidden" name="tabla" value={tabla} />
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div>
              <label className="label">Moneda</label>
              <select className="input" name="moneda">
                <option>USD</option>
                <option>ARS</option>
              </select>
            </div>
            <div>
              <label className="label">Importe</label>
              <input className="input" name="importe" type="number" step="0.01" inputMode="decimal" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Medio</label>
              <select className="input" name="medio">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="cripto">Cripto</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input className="input" name="fecha" type="date" />
            </div>
          </div>
          <input className="input" name="notas" placeholder="Nota (opcional)" />
          <button className="btn-primario w-full">Guardar</button>
        </form>
      </details>

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
              Cuenta en {m} <span className={corrido > 0 ? "text-mal" : "text-ok"}>{money(corrido, m)}</span>
            </h2>
            {conSaldo.reverse().slice(0, 50).map((x) => (
              <div key={`${x.origen}-${x.origen_id}`} className="fila">
                <div className="flex-1 min-w-0">
                  {x.origen === "comprobante" ? (
                    <Link href={`/comprobantes/${x.origen_id}`} className="text-sm font-medium text-marca">
                      {nroComprobante(x.concepto, x.numero ?? 0)}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium capitalize">{x.concepto}</p>
                  )}
                  <p className="text-xs text-suave">{fecha(x.fecha)} · saldo {money(x.saldo, m)}</p>
                </div>
                <span className={`font-semibold ${Number(x.importe) > 0 ? "" : "text-ok"}`}>{money(x.importe, m)}</span>
                {x.origen === "pago" && esAdmin && (
                  <form action={anularPago}>
                    <input type="hidden" name="tabla" value={tabla} />
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="pago_id" value={x.origen_id} />
                    <button className="text-xs text-mal px-1" title="Anular pago">✕</button>
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
