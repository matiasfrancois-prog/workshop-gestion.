import BottomNav from "@/components/BottomNav";
import { getPerfil } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await getPerfil();
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
