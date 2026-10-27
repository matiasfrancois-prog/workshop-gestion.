import { Encabezado } from "@/components/ui";

// Fase 1: el comparador actual se muestra dentro del sistema.
// Fase 2: los precios de proveedores pasan a la base y se cruzan con stock y ventas.
export default function Comparador() {
  const url = process.env.NEXT_PUBLIC_COMPARADOR_URL ?? "https://wor-kshop.github.io/workshop-precios/comparador_work_shop.html#interno";
  return (
    <>
      <Encabezado
        titulo="Comparador"
        volver="/mas"
        accion={
          <a href={url} target="_blank" className="text-sm font-semibold px-3 py-2 rounded-lg bg-white/10">
            Abrir
          </a>
        }
      />
      <iframe src={url} title="Comparador de precios" className="w-full border-0 bg-white" style={{ height: "calc(100dvh - 56px - 64px)" }} />
    </>
  );
}
