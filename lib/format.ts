export type Moneda = "USD" | "ARS";
export type MonedaCaja = Moneda | "USDT";

const nf = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function money(n: number | string | null | undefined, moneda: MonedaCaja = "USD"): string {
  const v = Number(n ?? 0);
  const simbolo = moneda === "USD" ? "US$" : moneda === "USDT" ? "USDT" : "$";
  return `${simbolo} ${nf.format(v)}`;
}

export function nroRecibo(esCobro: boolean, numero: number): string {
  return `${esCobro ? "REC" : "OP"}-${String(numero).padStart(5, "0")}`;
}

export function num(n: number | string | null | undefined): string {
  return nf0.format(Number(n ?? 0));
}

export function fecha(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export const TIPOS: Record<string, { label: string; corto: string }> = {
  presupuesto: { label: "Presupuesto", corto: "PRE" },
  pedido: { label: "Pedido", corto: "PED" },
  venta: { label: "Venta", corto: "VTA" },
  nc_venta: { label: "Nota de crédito cliente", corto: "NCV" },
  nd_venta: { label: "Nota de débito cliente", corto: "NDV" },
  compra: { label: "Compra", corto: "CMP" },
  nc_compra: { label: "Nota de crédito proveedor", corto: "NCC" },
  nd_compra: { label: "Nota de débito proveedor", corto: "NDC" },
};

export function nroComprobante(tipo: string, numero: number): string {
  return `${TIPOS[tipo]?.corto ?? tipo.toUpperCase()}-${String(numero).padStart(5, "0")}`;
}
