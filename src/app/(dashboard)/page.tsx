"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Package, AlertTriangle, ArrowDownToLine, DollarSign } from "lucide-react"

export default function DashboardPage() {
  const supabase = createClient()

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [productosRes, stockBajoRes, entradasRes] = await Promise.all([
        supabase.from("productos").select("id, stock_actual, precio_compra", { count: "exact" }).eq("activo", true),
        supabase.from("productos").select("id", { count: "exact" }).eq("activo", true).lte("stock_actual", 5),
        supabase.from("entradas").select("id, total", { count: "exact" }).order("created_at", { ascending: false }).limit(5),
      ])

      const productos = (productosRes.data ?? []) as { id: string; stock_actual: number; precio_compra: number }[]
      const valorInventario = productos.reduce(
        (sum, p) => sum + p.stock_actual * Number(p.precio_compra),
        0
      )

      return {
        totalProductos: productosRes.count ?? 0,
        stockBajo: stockBajoRes.count ?? 0,
        totalEntradas: entradasRes.count ?? 0,
        valorInventario,
      }
    },
  })

  const cards = [
    {
      title: "Total productos",
      value: stats.data?.totalProductos ?? 0,
      icon: Package,
      format: (v: number) => v.toString(),
      color: "text-brand-gold",
    },
    {
      title: "Stock bajo",
      value: stats.data?.stockBajo ?? 0,
      icon: AlertTriangle,
      format: (v: number) => v.toString(),
      alert: (stats.data?.stockBajo ?? 0) > 0,
      color: "text-brand-terracotta",
    },
    {
      title: "Entradas registradas",
      value: stats.data?.totalEntradas ?? 0,
      icon: ArrowDownToLine,
      format: (v: number) => v.toString(),
      color: "text-brand-sand",
    },
    {
      title: "Valor del inventario",
      value: stats.data?.valorInventario ?? 0,
      icon: DollarSign,
      format: (v: number) => `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      color: "text-primary",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen general de tu inventario
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="card-hover border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg bg-secondary p-2 ${card.alert ? "text-orange-500" : card.color}`}>
                <card.icon className="h-4 w-4" strokeWidth={1.5} />
              </div>
            </CardHeader>
            <CardContent>
              {stats.isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className={`text-2xl font-display font-semibold ${card.alert ? "text-orange-500" : ""}`}>
                  {card.format(card.value)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
