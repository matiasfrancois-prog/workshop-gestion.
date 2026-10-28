import { Text, View } from "@react-pdf/renderer";
import { fecha, money, nroComprobante, nroRecibo, num, type Moneda, type MonedaCaja } from "@/lib/format";
import { A4, Cabecera, Firma, Pie, s, Ticket, type Empresa } from "./base";
import type { ComprobantePdf, TerceroPdf } from "./datos";

const TITULOS: Record<string, string> = {
  presupuesto: "PRESUPUESTO",
  pedido: "NOTA DE PEDIDO",
  venta: "COMPROBANTE DE VENTA",
  nc_venta: "NOTA DE CRÉDITO",
  nd_venta: "NOTA DE DÉBITO",
  compra: "INGRESO DE MERCADERÍA",
  nc_compra: "NOTA DE CRÉDITO PROVEEDOR",
  nd_compra: "NOTA DE DÉBITO PROVEEDOR",
  orden_compra: "ORDEN DE COMPRA",
};

function DatosTercero({ t, rotulo }: { t: TerceroPdf | null; rotulo: string }) {
  if (!t) return null;
  return (
    <View style={[s.caja, { marginBottom: 12 }]}>
      <View style={s.fila}>
        <Text style={[s.negrita, { width: 70 }]}>{rotulo}:</Text>
        <Text style={[s.negrita, { flex: 1 }]}>{t.razon_social || t.nombre}</Text>
        {t.cuit && <Text>CUIT/DNI: {t.cuit}</Text>}
      </View>
      {(t.direccion || t.localidad) && (
        <View style={s.fila}>
          <Text style={{ width: 70 }}>Domicilio:</Text>
          <Text>{[t.direccion, t.localidad].filter(Boolean).join(", ")}</Text>
        </View>
      )}
      {(t.telefono || t.email) && (
        <View style={s.fila}>
          <Text style={{ width: 70 }}>Contacto:</Text>
          <Text>{[t.telefono, t.email].filter(Boolean).join(" · ")}</Text>
        </View>
      )}
    </View>
  );
}

// ---------- Comprobante (venta, pedido, presupuesto, compra, NC) ----------
export function ComprobanteA4({ e, c, saldo }: { e: Empresa; c: ComprobantePdf; saldo?: { usd: number; ars: number } }) {
  const esCompra = ["compra", "nc_compra", "nd_compra", "orden_compra"].includes(c.tipo);
  const nro = nroComprobante(c.tipo, c.numero);
  return (
    <A4 titulo={nro}>
      <Cabecera e={e} titulo={TITULOS[c.tipo]} numero={nro} fecha={fecha(c.fecha)} extra={c.vendedor ? `Atendió: ${c.vendedor}` : undefined} />
      {c.estado === "anulado" && <Text style={[s.negrita, { fontSize: 14, textAlign: "center", marginBottom: 8 }]}>*** ANULADO ***</Text>}
      <DatosTercero t={esCompra ? c.proveedor : c.cliente} rotulo={esCompra ? "Proveedor" : "Cliente"} />
      {(c.nro_externo || c.vencimiento || c.cotizacion || ["venta", "compra", "nd_venta", "nd_compra"].includes(c.tipo)) && (
        <View style={[s.fila, { gap: 16, marginTop: -6, marginBottom: 10, flexWrap: "wrap" }]}>
          {c.nro_externo && <Text>Comprobante proveedor: <Text style={s.negrita}>{c.nro_externo}</Text></Text>}
          {["venta", "compra", "nd_venta", "nd_compra"].includes(c.tipo) && (
            <Text>
              Condición: <Text style={s.negrita}>{c.contado ? "Contado" : "Cuenta corriente"}</Text>
              {c.pendiente !== null && (c.pendiente <= 0 ? " · Pagado" : ` · Saldo ${money(c.pendiente, c.moneda)}`)}
            </Text>
          )}
          {c.vencimiento && <Text>Vencimiento: <Text style={s.negrita}>{fecha(c.vencimiento)}</Text></Text>}
          {c.cotizacion && <Text>Cotización: US$ 1 = $ {num(c.cotizacion)}</Text>}
        </View>
      )}

      <View style={s.fila}>
        <Text style={[s.th, { width: 40, textAlign: "center" }]}>Cant.</Text>
        <Text style={[s.th, { flex: 1 }]}>Descripción</Text>
        <Text style={[s.th, s.derecha, { width: 80 }]}>P. unitario</Text>
        <Text style={[s.th, s.derecha, { width: 85 }]}>Subtotal</Text>
      </View>
      {c.items.map((i) => (
        <View key={i.id} style={[s.fila, s.td]} wrap={false}>
          <Text style={{ width: 40, textAlign: "center" }}>{num(i.cantidad)}</Text>
          <View style={{ flex: 1 }}>
            <Text>{i.descripcion}</Text>
            {i.series.length > 0 && <Text style={{ fontSize: 7, color: "#444", marginTop: 2 }}>IMEI/Serie: {i.series.join(" · ")}</Text>}
          </View>
          <Text style={[s.derecha, { width: 80 }]}>{money(i.precio_unit, c.moneda)}</Text>
          <Text style={[s.derecha, { width: 85 }]}>{money(i.subtotal, c.moneda)}</Text>
        </View>
      ))}

      <View style={[s.fila, { marginTop: 10 }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          {c.observaciones && (
            <>
              <Text style={s.negrita}>Observaciones</Text>
              <Text>{c.observaciones}</Text>
            </>
          )}
          {c.tipo === "presupuesto" && <Text style={[s.suave, { marginTop: 6 }]}>Precios sujetos a disponibilidad de stock. Validez: 24 hs.</Text>}
        </View>
        <View style={[s.caja, { width: 190 }]}>
          <View style={s.fila}>
            <Text style={[s.negrita, { flex: 1, fontSize: 12 }]}>TOTAL</Text>
            <Text style={[s.negrita, { fontSize: 12 }]}>{money(c.total, c.moneda)}</Text>
          </View>
          <Text style={[s.suave, { fontSize: 7, marginTop: 2 }]}>Unidades: {num(c.items.reduce((a, i) => a + i.cantidad, 0))}</Text>
        </View>
      </View>

      {saldo && ["venta", "nc_venta", "nd_venta"].includes(c.tipo) && (
        <View style={{ marginTop: 10, alignItems: "flex-end" }}>
          <Text style={s.suave}>
            Saldo de su cuenta corriente: {money(saldo.usd, "USD")}
            {saldo.ars !== 0 ? ` · ${money(saldo.ars, "ARS")}` : ""}
          </Text>
        </View>
      )}

      {(c.tipo === "venta" || c.tipo === "pedido") && (
        <View style={[s.fila, { justifyContent: "space-between", marginTop: 20 }]}>
          <Firma texto="Recibí conforme · Firma" />
          <Firma texto="Aclaración / DNI" />
        </View>
      )}
      <Pie e={e} />
    </A4>
  );
}

export function ComprobanteTicket({ e, c }: { e: Empresa; c: ComprobantePdf }) {
  const nro = nroComprobante(c.tipo, c.numero);
  const t = c.cliente ?? c.proveedor;
  const lineas = c.items.reduce((a, i) => a + 2 + Math.ceil(i.series.length / 2), 0);
  return (
    <Ticket titulo={nro} lineas={lineas}>
      <Text style={[s.negrita, s.centro, { fontSize: 13 }]}>{e.nombre}</Text>
      {e.telefono && <Text style={s.centro}>Tel. {e.telefono}</Text>}
      <Text style={[s.centro, { fontSize: 7 }]}>NO VÁLIDO COMO FACTURA</Text>
      <View style={[s.linea, { marginVertical: 5 }]} />
      <Text style={s.negrita}>{TITULOS[c.tipo]}</Text>
      <Text>N° {nro} · {fecha(c.fecha)}</Text>
      {t && <Text>{t.nombre}</Text>}
      {c.estado === "anulado" && <Text style={s.negrita}>*** ANULADO ***</Text>}
      <View style={[s.linea, { marginVertical: 5 }]} />
      {c.items.map((i) => (
        <View key={i.id} style={{ marginBottom: 4 }} wrap={false}>
          <Text>{i.descripcion}</Text>
          <View style={s.fila}>
            <Text style={{ flex: 1 }}>{num(i.cantidad)} x {money(i.precio_unit, c.moneda)}</Text>
            <Text>{money(i.subtotal, c.moneda)}</Text>
          </View>
          {i.series.length > 0 && <Text style={{ fontSize: 6.5 }}>{i.series.join(" ")}</Text>}
        </View>
      ))}
      <View style={[s.linea, { marginVertical: 5 }]} />
      <View style={s.fila}>
        <Text style={[s.negrita, { flex: 1, fontSize: 11 }]}>TOTAL</Text>
        <Text style={[s.negrita, { fontSize: 11 }]}>{money(c.total, c.moneda)}</Text>
      </View>
      {c.observaciones && <Text style={{ marginTop: 4 }}>{c.observaciones}</Text>}
      <Text style={[s.centro, { marginTop: 10 }]}>¡Gracias por su compra!</Text>
    </Ticket>
  );
}

// ---------- Recibo (cobro a cliente) / Orden de pago (pago a proveedor) ----------
export type ReciboPdf = {
  numero: number;
  fecha: string;
  esCobro: boolean;
  anulado: boolean;
  tercero: TerceroPdf;
  caja: string;
  monedaCaja: MonedaCaja;
  importeCaja: number;
  moneda: Moneda;
  importe: number;
  tipoCambio: number | null;
  notas: string | null;
  saldo: { usd: number; ars: number };
};

export function ReciboA4({ e, r }: { e: Empresa; r: ReciboPdf }) {
  const nro = nroRecibo(r.esCobro, r.numero);
  const distinta = r.monedaCaja !== r.moneda;
  const Cuerpo = ({ copia }: { copia: string }) => (
    <View style={{ height: 380 }}>
      <Cabecera e={e} titulo={r.esCobro ? "RECIBO" : "ORDEN DE PAGO"} numero={nro} fecha={fecha(r.fecha)} extra={copia} />
      {r.anulado && <Text style={[s.negrita, { fontSize: 14, textAlign: "center", marginBottom: 8 }]}>*** ANULADO ***</Text>}
      <DatosTercero t={r.tercero} rotulo={r.esCobro ? "Recibimos de" : "Pagamos a"} />
      <View style={[s.caja, { marginBottom: 10 }]}>
        <View style={s.fila}>
          <Text style={{ flex: 1 }}>{r.esCobro ? "La suma de" : "Entregamos"} ({r.caja}):</Text>
          <Text style={[s.negrita, { fontSize: 14 }]}>{money(r.importeCaja, r.monedaCaja)}</Text>
        </View>
        {distinta && (
          <Text style={[s.suave, { marginTop: 4 }]}>
            Imputado a cuenta corriente en {r.moneda === "USD" ? "dólares" : "pesos"}: {money(r.importe, r.moneda)}
            {r.tipoCambio ? ` (tipo de cambio ${r.tipoCambio.toLocaleString("es-AR")})` : ""}
          </Text>
        )}
        {r.notas && <Text style={{ marginTop: 4 }}>Concepto: {r.notas}</Text>}
      </View>
      <View style={[s.fila, { justifyContent: "space-between", alignItems: "flex-end" }]}>
        <Text style={s.suave}>
          Saldo de cuenta corriente: {money(r.saldo.usd, "USD")}
          {r.saldo.ars !== 0 ? ` · ${money(r.saldo.ars, "ARS")}` : ""}
        </Text>
        <Firma texto={r.esCobro ? "Firma y aclaración Work Shop" : "Recibí conforme"} />
      </View>
    </View>
  );
  return (
    <A4 titulo={nro}>
      <Cuerpo copia="Original" />
      <View style={{ borderTopWidth: 0.5, borderTopColor: "#999", borderStyle: "dashed", marginVertical: 14 }} />
      <Cuerpo copia="Duplicado" />
    </A4>
  );
}

export function ReciboTicket({ e, r }: { e: Empresa; r: ReciboPdf }) {
  const nro = nroRecibo(r.esCobro, r.numero);
  return (
    <Ticket titulo={nro} lineas={6}>
      <Text style={[s.negrita, s.centro, { fontSize: 13 }]}>{e.nombre}</Text>
      {e.telefono && <Text style={s.centro}>Tel. {e.telefono}</Text>}
      <View style={[s.linea, { marginVertical: 5 }]} />
      <Text style={s.negrita}>{r.esCobro ? "RECIBO" : "ORDEN DE PAGO"} N° {nro}</Text>
      <Text>{fecha(r.fecha)}</Text>
      {r.anulado && <Text style={s.negrita}>*** ANULADO ***</Text>}
      <Text style={{ marginTop: 4 }}>{r.esCobro ? "Recibimos de" : "Pagamos a"}: {r.tercero.nombre}</Text>
      <View style={[s.fila, { marginTop: 6 }]}>
        <Text style={{ flex: 1 }}>{r.caja}</Text>
        <Text style={[s.negrita, { fontSize: 11 }]}>{money(r.importeCaja, r.monedaCaja)}</Text>
      </View>
      {r.monedaCaja !== r.moneda && <Text>Imputado: {money(r.importe, r.moneda)}</Text>}
      {r.notas && <Text>{r.notas}</Text>}
      <View style={[s.linea, { marginVertical: 5 }]} />
      <Text>Saldo: {money(r.saldo.usd, "USD")}{r.saldo.ars !== 0 ? ` · ${money(r.saldo.ars, "ARS")}` : ""}</Text>
      <Text style={[s.centro, { marginTop: 18 }]}>________________________</Text>
      <Text style={s.centro}>Firma</Text>
    </Ticket>
  );
}

// ---------- Guía de despacho y rótulo ----------
export type Envio = {
  r_nombre: string;
  r_tel: string;
  r_dir: string;
  r_localidad: string;
  d_nombre: string;
  d_doc: string;
  d_tel: string;
  d_dir: string;
  d_localidad: string;
  d_provincia: string;
  d_cp: string;
  transporte: string;
  bultos: string;
  obs: string;
  fragil: boolean;
};

export function DespachoA4({ e, c, envio }: { e: Empresa; c: ComprobantePdf; envio: Envio }) {
  const nro = `GD-${String(c.numero).padStart(5, "0")}`;
  const destino = [envio.d_dir, envio.d_localidad, envio.d_provincia, envio.d_cp && `CP ${envio.d_cp}`].filter(Boolean).join(", ");
  return (
    <A4 titulo={nro}>
      <Cabecera e={e} titulo="GUÍA DE DESPACHO" numero={nro} fecha={fecha(new Date().toISOString())} extra={`Ref. ${nroComprobante(c.tipo, c.numero)}`} />
      <View style={[s.fila, { gap: 10, marginBottom: 12 }]}>
        <View style={[s.caja, { flex: 1 }]}>
          <Text style={s.negrita}>REMITENTE</Text>
          <Text>{envio.r_nombre}</Text>
          {envio.r_dir && <Text>{[envio.r_dir, envio.r_localidad].filter(Boolean).join(", ")}</Text>}
          {envio.r_tel && <Text>Tel. {envio.r_tel}</Text>}
        </View>
        <View style={[s.caja, { flex: 1 }]}>
          <Text style={s.negrita}>DESTINATARIO</Text>
          <Text style={s.negrita}>{envio.d_nombre}</Text>
          {envio.d_doc && <Text>DNI/CUIT {envio.d_doc}</Text>}
          {destino && <Text>{destino}</Text>}
          {envio.d_tel && <Text>Tel. {envio.d_tel}</Text>}
        </View>
      </View>
      <View style={[s.fila, s.caja, { marginBottom: 12, gap: 20 }]}>
        <Text>Transporte: <Text style={s.negrita}>{envio.transporte || "—"}</Text></Text>
        <Text>Bultos: <Text style={s.negrita}>{envio.bultos || "1"}</Text></Text>
        <Text>Unidades: <Text style={s.negrita}>{num(c.items.reduce((a, i) => a + i.cantidad, 0))}</Text></Text>
      </View>

      <View style={s.fila}>
        <Text style={[s.th, { width: 45, textAlign: "center" }]}>Cant.</Text>
        <Text style={[s.th, { flex: 1 }]}>Detalle</Text>
      </View>
      {c.items.map((i) => (
        <View key={i.id} style={[s.fila, s.td]} wrap={false}>
          <Text style={{ width: 45, textAlign: "center" }}>{num(i.cantidad)}</Text>
          <View style={{ flex: 1 }}>
            <Text>{i.descripcion}</Text>
            {i.series.length > 0 && <Text style={{ fontSize: 7, color: "#444", marginTop: 2 }}>IMEI/Serie: {i.series.join(" · ")}</Text>}
          </View>
        </View>
      ))}
      {envio.obs && <Text style={{ marginTop: 8 }}>Observaciones: {envio.obs}</Text>}

      <View style={[s.fila, { justifyContent: "space-between", marginTop: 30 }]}>
        <Firma texto="Despachó (Work Shop)" />
        <Firma texto="Transporte" />
        <Firma texto="Recibí conforme" />
      </View>
      <Pie e={e} />
    </A4>
  );
}

/** Rótulo en media hoja A4 (mitad superior), con marca de agua FRÁGIL en gris claro. */
export function RotuloA4({ c, envio }: { c: ComprobantePdf; envio: Envio }) {
  const destino1 = envio.d_dir;
  const destino2 = [envio.d_localidad, envio.d_provincia, envio.d_cp && `CP ${envio.d_cp}`].filter(Boolean).join(" · ");
  return (
    <A4 titulo={`Rótulo ${nroComprobante(c.tipo, c.numero)}`}>
      <View style={{ height: 380, borderWidth: 2, borderColor: "#111", padding: 18, position: "relative" }}>
        {envio.fragil && (
          <Text
            style={{
              position: "absolute",
              top: 140,
              left: 40,
              fontSize: 110,
              fontFamily: "Helvetica-Bold",
              color: "#e3e3e3",
              transform: "rotate(-18deg)",
            }}
          >
            FRÁGIL
          </Text>
        )}
        <Text style={[s.suave, { fontSize: 10 }]}>DESTINATARIO</Text>
        <Text style={[s.negrita, { fontSize: 26, marginTop: 4 }]}>{envio.d_nombre}</Text>
        {envio.d_doc && <Text style={{ fontSize: 14, marginTop: 4 }}>DNI/CUIT: {envio.d_doc}</Text>}
        {destino1 && <Text style={{ fontSize: 18, marginTop: 10 }}>{destino1}</Text>}
        {destino2 && <Text style={{ fontSize: 18, marginTop: 2 }}>{destino2}</Text>}
        {envio.d_tel && <Text style={[s.negrita, { fontSize: 16, marginTop: 8 }]}>Tel. {envio.d_tel}</Text>}

        <View style={[s.fila, { marginTop: "auto", borderTopWidth: 1, borderTopColor: "#111", paddingTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.suave, { fontSize: 8 }]}>REMITENTE</Text>
            <Text style={[s.negrita, { fontSize: 11 }]}>{envio.r_nombre}</Text>
            {(envio.r_dir || envio.r_localidad) && <Text>{[envio.r_dir, envio.r_localidad].filter(Boolean).join(", ")}</Text>}
            {envio.r_tel && <Text>Tel. {envio.r_tel}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {envio.transporte && <Text style={[s.negrita, { fontSize: 12 }]}>{envio.transporte}</Text>}
            <Text style={{ fontSize: 12 }}>Bultos: {envio.bultos || "1"}</Text>
            <Text style={s.suave}>Ref. {nroComprobante(c.tipo, c.numero)}</Text>
          </View>
        </View>
      </View>
      <Text style={{ textAlign: "center", fontSize: 7, color: "#888", marginTop: 6 }}>- - - - - - - - - - - - - - - - cortar aquí - - - - - - - - - - - - - - - -</Text>
    </A4>
  );
}

// ---------- Resumen de cuenta corriente ----------
export type MovCuenta = { moneda: Moneda; fecha: string; origen: string; concepto: string; numero: number | null; importe: number };

export function CuentaA4({ e, t, esCliente, movs }: { e: Empresa; t: TerceroPdf; esCliente: boolean; movs: MovCuenta[] }) {
  const hoy = new Date().toISOString();
  return (
    <A4 titulo={`Cuenta ${t.nombre}`}>
      <Cabecera e={e} titulo="RESUMEN DE CUENTA" numero={String(t.id).padStart(5, "0")} fecha={fecha(hoy)} />
      <DatosTercero t={t} rotulo={esCliente ? "Cliente" : "Proveedor"} />
      {(["USD", "ARS"] as Moneda[]).map((m) => {
        const lista = movs.filter((x) => x.moneda === m).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
        if (!lista.length) return null;
        let saldo = 0;
        return (
          <View key={m} style={{ marginBottom: 14 }}>
            <Text style={[s.negrita, { fontSize: 11, marginBottom: 4 }]}>Cuenta en {m === "USD" ? "dólares" : "pesos"}</Text>
            <View style={s.fila}>
              <Text style={[s.th, { width: 60 }]}>Fecha</Text>
              <Text style={[s.th, { flex: 1 }]}>Comprobante</Text>
              <Text style={[s.th, s.derecha, { width: 80 }]}>Debe</Text>
              <Text style={[s.th, s.derecha, { width: 80 }]}>Haber</Text>
              <Text style={[s.th, s.derecha, { width: 85 }]}>Saldo</Text>
            </View>
            {lista.map((x, i) => {
              saldo += Number(x.importe);
              const doc =
                x.origen === "pago"
                  ? `${nroRecibo(esCliente, x.numero ?? 0)} ${x.concepto.split("·")[1] ?? ""}`
                  : nroComprobante(x.concepto, x.numero ?? 0);
              return (
                <View key={i} style={[s.fila, s.td]} wrap={false}>
                  <Text style={{ width: 60 }}>{fecha(x.fecha)}</Text>
                  <Text style={{ flex: 1 }}>{doc}</Text>
                  <Text style={[s.derecha, { width: 80 }]}>{x.importe > 0 ? money(x.importe, m) : ""}</Text>
                  <Text style={[s.derecha, { width: 80 }]}>{x.importe < 0 ? money(-x.importe, m) : ""}</Text>
                  <Text style={[s.derecha, { width: 85 }]}>{money(saldo, m)}</Text>
                </View>
              );
            })}
            <View style={[s.fila, { marginTop: 4 }]}>
              <Text style={[s.negrita, { flex: 1, textAlign: "right", paddingRight: 8 }]}>
                {saldo > 0 ? (esCliente ? "Saldo a pagar" : "Saldo a favor del proveedor") : saldo < 0 ? "Saldo a favor" : "Saldo"}
              </Text>
              <Text style={[s.negrita, s.derecha, { width: 85 }]}>{money(saldo, m)}</Text>
            </View>
          </View>
        );
      })}
      {movs.length === 0 && <Text>Sin movimientos.</Text>}
      <Pie e={e} />
    </A4>
  );
}
