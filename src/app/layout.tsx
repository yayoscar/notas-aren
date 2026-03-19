import type { Metadata } from "next"
import "./globals.css"
import { QueryProvider } from "@/providers/QueryProvider"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Notas de Aren — Perfumería",
  description: "Sistema de gestión de inventario — Notas de Aren Perfumería",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="font-body antialiased">
        <QueryProvider>
          {children}
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  )
}
