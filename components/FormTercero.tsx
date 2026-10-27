import { guardarTercero } from "@/app/(app)/clientes/actions";

type Tercero = {
  id: number;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad?: string | null;
  lista_id?: number | null;
  limite_credito_usd?: number | null;
  habilitado?: boolean;
  activo?: boolean;
  notas: string | null;
};

export default function FormTercero({
  tabla,
  t,
  listas = [],
}: {
  tabla: "clientes" | "proveedores";
  t?: Tercero;
  listas?: { id: number; nombre: string }[];
}) {
  const esCliente = tabla === "clientes";
  return (
    <form action={guardarTercero} className="space-y-3">
      <input type="hidden" name="tabla" value={tabla} />
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="card space-y-3">
        <Campo label="Nombre *" name="nombre" v={t?.nombre} required />
        <Campo label="Razón social" name="razon_social" v={t?.razon_social} />
        <div className="grid grid-cols-2 gap-3">
          <Campo label="CUIT" name="cuit" v={t?.cuit} inputMode="numeric" />
          <Campo label="Teléfono / WhatsApp" name="telefono" v={t?.telefono} inputMode="tel" />
        </div>
        <Campo label="Email" name="email" v={t?.email} type="email" />
        <Campo label="Dirección" name="direccion" v={t?.direccion} />
        {esCliente && <Campo label="Localidad" name="localidad" v={t?.localidad} />}
      </div>

      {esCliente && (
        <div className="card grid grid-cols-2 gap-3">
          <div>
            <label className="label">Lista de precios</label>
            <select className="input" name="lista_id" defaultValue={t?.lista_id ?? listas[0]?.id ?? ""}>
              {listas.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
          <Campo label="Límite crédito US$" name="limite_credito_usd" v={t?.limite_credito_usd} type="number" inputMode="decimal" />
        </div>
      )}

      <div className="card space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="habilitado" defaultChecked={t ? (esCliente ? t.habilitado : t.activo) : true} className="size-5 accent-marca" />
          {esCliente ? "Habilitado para comprar" : "Activo"}
        </label>
        <div>
          <label className="label">Notas</label>
          <textarea className="input h-20 py-2" name="notas" defaultValue={t?.notas ?? ""} />
        </div>
      </div>
      <button className="btn-primario w-full">Guardar</button>
    </form>
  );
}

function Campo({
  label,
  name,
  v,
  ...rest
}: { label: string; name: string; v?: string | number | null } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" name={name} defaultValue={v ?? ""} {...rest} />
    </div>
  );
}
