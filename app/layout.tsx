import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Work Shop · Gestión",
  description: "Sistema de gestión de Work Shop",
  appleWebApp: { capable: true, title: "Work Shop", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#12584c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
