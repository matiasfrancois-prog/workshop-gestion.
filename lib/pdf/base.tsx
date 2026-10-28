import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";

// Sin cortar palabras con guiones
Font.registerHyphenationCallback((palabra) => [palabra]);

// Diseño en blanco y negro (la impresora de Work Shop es B/N)
export const s = StyleSheet.create({
  pagina: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  ticket: { padding: 10, fontSize: 8, fontFamily: "Helvetica", color: "#000" },
  fila: { flexDirection: "row" },
  negrita: { fontFamily: "Helvetica-Bold" },
  suave: { color: "#555" },
  caja: { borderWidth: 1, borderColor: "#111", padding: 8 },
  linea: { borderBottomWidth: 0.5, borderBottomColor: "#999" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#111" },
  td: { paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#bbb" },
  derecha: { textAlign: "right" },
  centro: { textAlign: "center" },
});

export type Empresa = {
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  direccion: string | null;
  localidad: string | null;
  telefono: string | null;
  email: string | null;
  pie: string | null;
};

/** Encabezado A4: empresa a la izquierda, tipo y número de documento a la derecha. */
export function Cabecera({ e, titulo, numero, fecha, extra }: { e: Empresa; titulo: string; numero: string; fecha: string; extra?: string }) {
  return (
    <View style={[s.fila, { borderWidth: 1, borderColor: "#111", marginBottom: 12 }]}>
      <View style={{ flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: "#111" }}>
        <Text style={[s.negrita, { fontSize: 18 }]}>{e.nombre}</Text>
        {e.razon_social && <Text>{e.razon_social}</Text>}
        {e.direccion && <Text>{[e.direccion, e.localidad].filter(Boolean).join(" · ")}</Text>}
        <Text>{[e.telefono && `Tel. ${e.telefono}`, e.email].filter(Boolean).join(" · ")}</Text>
        {e.cuit && <Text>CUIT {e.cuit}</Text>}
      </View>
      <View style={{ width: 70, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderRightColor: "#111" }}>
        <Text style={[s.negrita, { fontSize: 30 }]}>X</Text>
        <Text style={{ fontSize: 6, textAlign: "center" }}>NO VÁLIDO{"\n"}COMO FACTURA</Text>
      </View>
      <View style={{ flex: 1, padding: 10 }}>
        <Text style={[s.negrita, { fontSize: 13 }]}>{titulo}</Text>
        <Text style={[s.negrita, { fontSize: 12, marginTop: 2 }]}>N° {numero}</Text>
        <Text style={{ marginTop: 6 }}>Fecha: {fecha}</Text>
        {extra && <Text>{extra}</Text>}
      </View>
    </View>
  );
}

export function Pie({ e }: { e: Empresa }) {
  return (
    <Text
      style={{ position: "absolute", bottom: 18, left: 32, right: 32, fontSize: 7, color: "#555", textAlign: "center" }}
      fixed
      render={({ pageNumber, totalPages }) => `${e.pie ?? "Documento no válido como factura."} · Página ${pageNumber} de ${totalPages}`}
    />
  );
}

export function Firma({ texto }: { texto: string }) {
  return (
    <View style={{ width: 180, marginTop: 40, borderTopWidth: 0.5, borderTopColor: "#111", paddingTop: 3 }}>
      <Text style={s.centro}>{texto}</Text>
    </View>
  );
}

/** Página A4 estándar */
export function A4({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Document title={titulo} author="Work Shop">
      <Page size="A4" style={s.pagina}>
        {children}
      </Page>
    </Document>
  );
}

/** Página de ticket 80 mm (72 mm imprimibles). El alto se estima según el contenido. */
export function Ticket({ titulo, lineas, children }: { titulo: string; lineas: number; children: React.ReactNode }) {
  const mm = 2.835;
  return (
    <Document title={titulo} author="Work Shop">
      <Page size={{ width: 80 * mm, height: Math.max(120, 70 + lineas * 7) * mm }} style={s.ticket}>
        {children}
      </Page>
    </Document>
  );
}

export async function respuestaPdf(doc: ReactElement, nombre: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(doc as any);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
