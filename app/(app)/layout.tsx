import { Suspense } from "react";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import { getPerfil } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await getPerfil();
  return (
    <>
      <Suspense>
        <TopNav />
      </Suspense>
      {children}
      <BottomNav />
    </>
  );
}
