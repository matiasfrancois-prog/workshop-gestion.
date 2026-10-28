"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Menú superior para computadora (en el celular se usa la barra inferior)
const items: [string, string][] = [
  ["/", "Inicio"],
  ["/clientes", "Clientes"],
  ["/proveedores", "Proveedores"],
  ["/comprobantes?grupo=ventas", "Ventas"],
  ["/comprobantes?grupo=compras", "Compras"],
  ["/caja", "Caja"],
  ["/productos", "Productos"],
  ["/stock", "Stock"],
  ["/series", "IMEI"],
  ["/mas", "Más"],
];

export default function TopNav() {
  const path = usePathname();
  const sp = useSearchParams();
  const activo = (href: string) => {
    const [p, q] = href.split("?");
    if (p === "/") return path === "/";
    if (q) return path === p && sp.get("grupo") === new URLSearchParams(q).get("grupo");
    return path.startsWith(p) && !(p === "/comprobantes");
  };
  return (
    <nav className="hidden md:block bg-white border-b border-linea">
      <div className="max-w-6xl mx-auto flex items-center gap-1 px-3 h-12">
        <Link href="/" className="flex items-center gap-2 mr-4">
          <span className="size-8 rounded-lg bg-marca text-white grid place-items-center text-xs font-extrabold">WS</span>
          <span className="font-bold tracking-tight">WORK SHOP</span>
        </Link>
        {items.map(([href, t]) => (
          <Link
            key={href}
            href={href}
            className={`px-3 h-12 grid place-items-center text-sm border-b-2 ${activo(href) ? "border-marca text-marca font-semibold" : "border-transparent text-tinta/80 hover:text-marca"}`}
          >
            {t}
          </Link>
        ))}
        <Link href="/vender" className="ml-auto btn h-9 px-4 bg-acento text-tinta text-sm">+ Vender</Link>
        <Link href="/comprar" className="btn h-9 px-4 bg-white border border-linea text-sm">+ Compra</Link>
      </div>
    </nav>
  );
}
