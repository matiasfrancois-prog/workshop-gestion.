"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Inicio", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/productos", label: "Productos", icon: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm3 17h4" },
  { href: "/vender", label: "Vender", icon: "M12 5v14M5 12h14", destacado: true },
  { href: "/clientes", label: "Clientes", icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm13 9v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.75" },
  { href: "/mas", label: "Más", icon: "M4 6h16M4 12h16M4 18h16" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-linea pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5 max-w-xl mx-auto">
        {items.map((it) => {
          const activo = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} className="flex flex-col items-center justify-center h-16 gap-1 text-[11px] font-medium">
                {it.destacado ? (
                  <span className="size-11 -mt-5 rounded-full bg-acento text-tinta grid place-items-center shadow-lg shadow-acento/30">
                    <Icono d={it.icon} />
                  </span>
                ) : (
                  <span className={activo ? "text-marca" : "text-suave"}>
                    <Icono d={it.icon} />
                  </span>
                )}
                <span className={activo ? "text-marca" : "text-suave"}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Icono({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
