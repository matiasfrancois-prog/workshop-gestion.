import Link from "next/link";
import { Encabezado, Pagina } from "@/components/ui";
import { getPerfil } from "@/lib/data";
import { salir } from "@/app/login/actions";

const grupos: { titulo: string; items: [string, string, string][]; soloAdmin?: boolean }[] = [
  {
    titulo: "Operación",
    items: [
      ["/comprobantes", "Comprobantes", "Ventas, pedidos, presupuestos y compras"],
      ["/comprar", "Cargar compra", "Ingreso de mercadería"],
      ["/proveedores", "Proveedores", "Datos y cuenta corriente"],
      ["/stock", "Stock", "Reposición y equipos sin rotación"],
      ["/comparador", "Comparador de precios", "Precios de mercado del día"],
    ],
  },
  {
    titulo: "Configuración",
    soloAdmin: true,
    items: [
      ["/mas/cotizacion", "Dólar del día", "Cotización para pasar a pesos"],
      ["/mas/listas", "Listas de precios", "Márgenes por lista"],
    ],
  },
];

export default async function Mas() {
  const perfil = await getPerfil();
  return (
    <>
      <Encabezado titulo="Más" />
      <Pagina>
        {grupos
          .filter((g) => !g.soloAdmin || perfil.rol === "admin")
          .map((g) => (
            <section key={g.titulo}>
              <h2 className="text-xs font-semibold text-suave uppercase tracking-wide px-1 mb-2">{g.titulo}</h2>
              <div className="card p-0 overflow-hidden">
                {g.items.map(([href, t, d]) => (
                  <Link key={href} href={href} className="fila">
                    <div className="flex-1">
                      <p className="font-medium">{t}</p>
                      <p className="text-xs text-suave">{d}</p>
                    </div>
                    <span className="text-suave">›</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        <section className="card flex items-center justify-between">
          <div>
            <p className="font-medium">{perfil.nombre}</p>
            <p className="text-xs text-suave capitalize">{perfil.rol}</p>
          </div>
          <form action={salir}>
            <button className="btn-secundario h-10">Salir</button>
          </form>
        </section>
      </Pagina>
    </>
  );
}
