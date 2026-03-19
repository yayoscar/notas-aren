"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import {
  LayoutDashboard,
  Package,
  Truck,
  ClipboardList,
  ArrowDownToLine,
  Users,
  UserCog,
  ShoppingCart,
  Wallet,
  CalendarCheck,
  Receipt,
  BarChart3,
} from "lucide-react"

type NavItem = {
  name: string
  href: string
  icon: typeof LayoutDashboard
  adminOnly: boolean
  group: "menu" | "comercial"
}

const allNavigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, adminOnly: true, group: "menu" },
  { name: "Inventario", href: "/inventario", icon: Package, adminOnly: true, group: "menu" },
  { name: "Entradas", href: "/entradas", icon: ArrowDownToLine, adminOnly: true, group: "menu" },
  { name: "Clientes", href: "/clientes", icon: Users, adminOnly: false, group: "menu" },
  { name: "Proveedores", href: "/proveedores", icon: Truck, adminOnly: true, group: "menu" },
  { name: "Catálogos", href: "/catalogos", icon: ClipboardList, adminOnly: true, group: "menu" },
  { name: "Vendedores", href: "/vendedores", icon: UserCog, adminOnly: true, group: "menu" },
  // Comercial
  { name: "Ventas", href: "/ventas", icon: ShoppingCart, adminOnly: false, group: "comercial" },
  { name: "Abonos", href: "/abonos", icon: Wallet, adminOnly: false, group: "comercial" },
  { name: "Seguimiento", href: "/seguimiento-pagos", icon: CalendarCheck, adminOnly: true, group: "comercial" },
  { name: "Gastos", href: "/gastos", icon: Receipt, adminOnly: true, group: "comercial" },
  { name: "Reportes", href: "/reportes", icon: BarChart3, adminOnly: true, group: "comercial" },
]

export function Sidebar() {
  const pathname = usePathname()
  const { vendedor, isAdmin } = useVendedorActual()

  const navigation = isAdmin
    ? allNavigation
    : allNavigation.filter((item) => !item.adminOnly)

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-border/60 bg-card sm:flex">
      {/* Brand header */}
      <div className="flex h-16 items-center border-b border-border/60 px-6">
        <Link href={isAdmin ? "/" : "/clientes"} className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3h6l1 4H8L9 3Z" />
              <path d="M8 7c-1 2-2 5-2 9a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4c0-4-1-7-2-9H8Z" />
              <rect x="10" y="1" width="4" height="3" rx="1" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground">
              Notas de Aren
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Perfumería
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {(["menu", "comercial"] as const).map((group) => {
          const items = navigation.filter((item) => item.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-4">
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                {group === "menu" ? "Menú" : "Comercial"}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Bottom user info */}
      <div className="border-t border-border/60 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
          <span className="text-[11px] text-muted-foreground">
            {vendedor?.nombre ?? "Sistema de inventario"}
          </span>
        </div>
      </div>
    </aside>
  )
}
