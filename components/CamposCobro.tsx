"use client";
import { useEffect, useState } from "react";
import { money, type Moneda, type MonedaCaja } from "@/lib/format";

export type Caja = { id: number; nombre: string; moneda: MonedaCaja };
export type Cobro = { caja_id: number; importe_caja: number; moneda: Moneda; importe: number };

/** Tipo de cambio sugerido para pasar de la moneda de la caja a la de la cuenta corriente. */
function tcSugerido(caja: MonedaCaja, cuenta: Moneda, cotiz: number): number {
  if (caja === cuenta) return 1;
  if ((caja === "USDT" || caja === "USD") && cuenta === "USD") return 1;
  return cotiz || 0; // $ por US$: se completa con el dólar del día (editable)
}

/**
 * Elegir caja (Pesos / Dólares / USDT…), importe recibido y a qué cuenta corriente se imputa.
 * Si las monedas difieren, pide tipo de cambio. Ej: 200 USDT cancelan US$ 200.
 */
export default function CamposCobro({
  cajas,
  cotizacion,
  monedaCuenta,
  importeSugerido,
  onChange,
  nombres,
}: {
  cajas: Caja[];
  cotizacion: number;
  monedaCuenta: Moneda;
  importeSugerido?: number;
  onChange?: (c: Cobro | null) => void;
  nombres?: boolean; // agrega inputs ocultos para enviar en un <form>
}) {
  const inicial = cajas.find((c) => c.moneda === monedaCuenta) ?? cajas[0];
  const [cajaId, setCajaId] = useState(inicial?.id ?? 0);
  const [cuenta, setCuenta] = useState<Moneda>(monedaCuenta);
  const caja = cajas.find((c) => c.id === cajaId) ?? inicial;
  const [tc, setTc] = useState(tcSugerido(caja?.moneda ?? "USD", monedaCuenta, cotizacion));
  const [importeCaja, setImporteCaja] = useState<string>(importeSugerido ? String(importeSugerido) : "");

  useEffect(() => setCuenta(monedaCuenta), [monedaCuenta]);
  useEffect(() => setTc(tcSugerido(caja?.moneda ?? "USD", cuenta, cotizacion)), [caja?.moneda, cuenta, cotizacion]);

  const distinta = caja && caja.moneda !== cuenta;
  const ic = Number(importeCaja) || 0;
  // ARS → USD divide; USD/USDT → ARS multiplica; USDT → USD 1:1 por tc
  const imputado =
    !distinta ? ic : !(tc > 0) ? 0 : caja.moneda === "ARS" ? Math.round((ic / tc) * 100) / 100 : Math.round(ic * tc * 100) / 100;

  useEffect(() => {
    onChange?.(caja && ic > 0 && imputado > 0 ? { caja_id: caja.id, importe_caja: ic, moneda: cuenta, importe: imputado } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caja?.id, ic, imputado, cuenta]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {cajas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCajaId(c.id)}
            className={`h-10 rounded-xl border text-sm font-semibold truncate px-2 ${c.id === caja?.id ? "bg-marca text-white border-marca" : "bg-white border-linea"}`}
          >
            {c.nombre}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Recibido ({caja?.moneda})</label>
          <input className="input" type="number" step="0.01" inputMode="decimal" value={importeCaja} onChange={(e) => setImporteCaja(e.target.value)} />
        </div>
        <div>
          <label className="label">Imputar a cuenta</label>
          <select className="input" value={cuenta} onChange={(e) => setCuenta(e.target.value as Moneda)}>
            <option value="USD">US$</option>
            <option value="ARS">$</option>
          </select>
        </div>
      </div>
      {distinta && (
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="label">{caja.moneda === "USDT" && cuenta === "USD" ? "1 USDT = US$" : caja.moneda === "ARS" ? "1 US$ = $" : `1 ${caja.moneda} = $`}</label>
            <input className="input" type="number" step="0.0001" inputMode="decimal" value={tc} onChange={(e) => setTc(Number(e.target.value))} />
          </div>
          <p className="text-sm pb-3">
            {tc > 0 ? (
              <>Descuenta <b>{money(imputado, cuenta)}</b></>
            ) : (
              <span className="text-mal">Cargá la cotización</span>
            )}
          </p>
        </div>
      )}
      {nombres && caja && (
        <>
          <input type="hidden" name="caja_id" value={caja.id} />
          <input type="hidden" name="importe_caja" value={ic} />
          <input type="hidden" name="moneda" value={cuenta} />
          <input type="hidden" name="importe" value={imputado} />
        </>
      )}
    </div>
  );
}
