"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { useVendedorActual } from "@/hooks/useVendedorActual"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { vendedor, isAdmin, isLoading } = useVendedorActual()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isLoading || !vendedor) return

    // Force password change
    if (vendedor.debe_cambiar_password) {
      router.push("/cambiar-password")
      return
    }

    // Vendedor can access /clientes, /ventas, /abonos
    if (
      !isAdmin &&
      !pathname.startsWith("/clientes") &&
      !pathname.startsWith("/ventas") &&
      !pathname.startsWith("/abonos")
    ) {
      router.push("/clientes")
    }
  }, [vendedor, isAdmin, isLoading, pathname, router])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex flex-1 flex-col sm:pl-64">
        <Header onMenuToggle={() => setIsMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  )
}
