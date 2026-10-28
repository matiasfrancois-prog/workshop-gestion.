"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ajustarStock } from "@/app/(app)/productos/actions";
import Escaner from "./Escaner";

/** Ajuste de stock: entrada (con series nuevas) o salida (eligiendo series del stock). */
export default function AjusteStock({ productoId, llevaSerie, enStock }: { productoId: number; llevaSerie: boolean; enStock: string[] }) {
  const router = useRouter();
  const [sentido, setSentido] = useState<"entra" | "sale">("sale");
  const [series, setSeries] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pend, start] = useTransition();

  function agregar(cs: string[]) {
    setError(null);
    if (sentido === "sale") {
      const malos = cs.filter((c) => !enStock.includes(c));
      if (malos.length) setError(`No están en stock: ${malos.join(", ")}`);
      cs = cs.filter((c) => enStock.includes(c));
    }
    setSeries((s) => [...new Set([...s, ...cs])]);
  }

  function guardar() {
    const n = llevaSerie ? series.length : Number(cantidad);
    if (!n) return setError(llevaSerie ? "Cargá al menos una serie." : "Indicá la cantidad.");
    start(async () => {
      const r = await ajustarStock(productoId, sentido === "entra" ? n : -n, series, nota);
      if (r?.error) setError(r.error);
      else {
        setSeries([]);
        setCantidad("");
        setNota("");
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["sale", "entra"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSentido(s);
              setSeries([]);
            }}
            className={`h-10 rounded-xl border font-semibold text-sm ${sentido === s ? "bg-marca text-white border-marca" : "bg-white border-linea"}`}
          >
            {s === "sale" ? "Sale (baja, falla…)" : "Entra (conteo, alta)"}
          </button>
        ))}
      </div>
      {llevaSerie ? (
        <>
          <Escaner onCodigos={agregar} />
          {series.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {series.map((s) => (
                <button key={s} type="button" onClick={() => setSeries(series.filter((x) => x !== s))} className="chip bg-fondo border border-linea font-mono text-[11px]">
                  {s} <span className="text-mal ml-1">×</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <input className="input" type="number" inputMode="numeric" placeholder="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      )}
      <input className="input" placeholder="Motivo: conteo, falla, RMA…" value={nota} onChange={(e) => setNota(e.target.value)} />
      {error && <p className="text-sm text-mal">{error}</p>}
      <button type="button" disabled={pend} onClick={guardar} className="btn-secundario w-full">
        {pend ? "Guardando…" : `Registrar ajuste${llevaSerie && series.length ? ` (${series.length})` : ""}`}
      </button>
    </div>
  );
}
