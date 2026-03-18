import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dropea Dashboard",
  description: "Dashboard de P&L para dropshipping con Dropea",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
