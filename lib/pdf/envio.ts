import type { Envio } from "./documentos";

export function envioDesdeUrl(req: Request): Envio {
  const q = new URL(req.url).searchParams;
  const g = (k: string) => (q.get(k) ?? "").trim();
  return {
    r_nombre: g("r_nombre") || "WORK SHOP",
    r_tel: g("r_tel"),
    r_dir: g("r_dir"),
    r_localidad: g("r_localidad"),
    d_nombre: g("d_nombre"),
    d_doc: g("d_doc"),
    d_tel: g("d_tel"),
    d_dir: g("d_dir"),
    d_localidad: g("d_localidad"),
    d_provincia: g("d_provincia"),
    d_cp: g("d_cp"),
    transporte: g("transporte"),
    bultos: g("bultos"),
    obs: g("obs"),
    fragil: q.get("fragil") === "1",
  };
}
