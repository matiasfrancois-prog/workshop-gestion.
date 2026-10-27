import Link from "next/link";
import type { Moneda } from "@/lib/format";
import { money } from "@/lib/format";

export function Encabezado({ titulo, volver, accion }: { titulo: string; volver?: string; accion?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-marca text-white pt-[env(safe-area-inset-top)]">
      <div className="max-w-xl mx-auto flex items-center gap-2 h-14 px-3">
        {volver && (
          <Link href={volver} aria-label="Volver" className="size-10 grid place-items-center rounded-full active:bg-white/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
        )}
        <h1 className={`flex-1 truncate text-[17px] font-semibold ${volver ? "" : "pl-1"}`}>{titulo}</h1>
        {accion}
      </div>
    </header>
  );
}

export function Pagina({ children }: { children: React.ReactNode }) {
  return <main className="max-w-xl mx-auto px-3 pt-3 pb-28 space-y-3">{children}</main>;
}

export function Buscador({ q, placeholder, extra }: { q?: string; placeholder: string; extra?: React.ReactNode }) {
  return (
    <form className="flex gap-2">
      <input className="input" name="q" defaultValue={q} placeholder={placeholder} type="search" />
      {extra}
      <button className="btn-secundario px-3" aria-label="Buscar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
    </form>
  );
}

export function Saldo({ valor, moneda }: { valor: number; moneda: Moneda }) {
  const v = Number(valor);
  if (v === 0) return <span className="text-suave">{money(0, moneda)}</span>;
  return <span className={v > 0 ? "text-mal font-semibold" : "text-ok font-semibold"}>{money(v, moneda)}</span>;
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="text-center text-suave py-10 text-sm">{texto}</p>;
}

export function BotonFlotante({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="fixed right-4 bottom-24 z-20 btn-primario rounded-full shadow-lg shadow-marca/30 px-5">
      + {label}
    </Link>
  );
}
