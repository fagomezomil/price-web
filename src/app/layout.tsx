import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";

import { Barra } from "@/components/sitio";

import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
});

const jbMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "REMITO.com.ar — todos los precios de hoy, a una vuelta",
    template: "%s · REMITO.com.ar",
  },
  description:
    "Precios de supermercado comparados por sucursal: canasta, historial y alertas. Data abierta SEPA + relevamiento propio, actualizado a diario.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${archivo.variable} ${jbMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <Barra />
        {children}
      </body>
    </html>
  );
}
