// Piezas visuales para mostrar comprobantes "como documento": una hoja blanca con encabezado,
// datos en filas (estilo Cianbox) y tabla de renglones.

export type EmpresaHoja = { nombre: string; direccion: string | null; localidad: string | null; telefono: string | null; email: string | null; cuit: string | null };

export function Hoja({ children, anulado }: { children: React.ReactNode; anulado?: boolean }) {
  return (
    <article className="relative bg-white rounded-sm border border-linea shadow-[0_1px_2px_rgba(0,0,0,.06),0_8px_24px_rgba(0,0,0,.06)] overflow-hidden">
      {anulado && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center z-10">
          <span className="text-mal/25 font-black text-6xl md:text-8xl -rotate-12 tracking-widest">ANULADO</span>
        </div>
      )}
      {children}
    </article>
  );
}

export function CabeceraHoja({ e, titulo, numero, fecha, sub }: { e: EmpresaHoja; titulo: string; numero: string; fecha: string; sub?: string }) {
  return (
    <header className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] border-b border-tinta/80">
      <div className="p-4 hidden md:block">
        <p className="text-xl font-extrabold tracking-tight">{e.nombre}</p>
        <p className="text-xs text-suave leading-relaxed">
          {[e.direccion, e.localidad].filter(Boolean).join(" · ")}
          <br />
          {[e.telefono && `Tel. ${e.telefono}`, e.email].filter(Boolean).join(" · ")}
          {e.cuit && <><br />CUIT {e.cuit}</>}
        </p>
      </div>
      <div className="order-2 md:order-none w-16 md:w-20 border-l md:border-x border-tinta/80 grid place-items-center text-center py-2">
        <span className="text-3xl font-black leading-none">X</span>
        <span className="text-[8px] leading-tight text-suave">NO VÁLIDO<br />COMO FACTURA</span>
      </div>
      <div className="p-4">
        <p className="text-[13px] font-bold tracking-wide text-suave">{titulo}</p>
        <p className="text-xl md:text-2xl font-extrabold font-mono">{numero}</p>
        <p className="text-sm">Fecha: <b>{fecha}</b></p>
        {sub && <p className="text-xs text-suave">{sub}</p>}
      </div>
    </header>
  );
}

/** Filas "Etiqueta …… valor" como en el detalle de Cianbox */
export function Datos({ filas }: { filas: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-linea text-sm">
      {filas
        .filter(([, v]) => v !== null && v !== undefined && v !== false && v !== "")
        .map(([k, v]) => (
          <div key={k} className="flex gap-4 px-4 py-2.5">
            <dt className="text-suave w-32 md:w-48 shrink-0">{k}</dt>
            <dd className="flex-1 text-right md:text-left font-medium min-w-0 break-words">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-linea">
      <h3 className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-suave">{titulo}</h3>
      {children}
    </section>
  );
}

export function BarraAcciones({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function Accion({ href, children, primario, nueva, peligro }: { href: string; children: React.ReactNode; primario?: boolean; nueva?: boolean; peligro?: boolean }) {
  const cls = primario ? "btn-primario" : peligro ? "btn-peligro" : "btn-secundario";
  return (
    <a href={href} target={nueva ? "_blank" : undefined} className={`${cls} h-10 px-3 text-sm`}>
      {children}
    </a>
  );
}
