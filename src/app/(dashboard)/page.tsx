"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Package, AlertTriangle, DollarSign, CreditCard, Landmark, Tags, type LucideIcon } from "lucide-react"
import { CumpleanosWidget } from "@/components/dashboard/CumpleanosWidget"
import { useMarcas } from "@/hooks/useMarcas"

type DashboardCard = {
  title: string
  value: number
  icon: LucideIcon
  format: (v: number) => string
  color: string
  alert?: boolean
  breakdown?: { label: string; value: number }[]
}

export default function DashboardPage() {
  const supabase = createClient()

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [productosRes, stockBajoRes, lineasCreditoRes] = await Promise.all([
        supabase.from("productos").select("id, stock_actual, precio_compra, estado_producto", { count: "exact" }).eq("activo", true),
        supabase.from("productos").select("id", { count: "exact" }).eq("activo", true).lte("stock_actual", 5),
        supabase.from("lineas_credito").select("saldo_total, saldo_pagado", { count: "exact" }).eq("estado", "activa"),
      ])

      const productos = (productosRes.data ?? []) as { id: string; stock_actual: number; precio_compra: number; estado_producto: string }[]
      const valorInventario = productos.reduce(
        (sum, p) => sum + p.stock_actual * Number(p.precio_compra),
        0
      )

      const lineasCredito = (lineasCreditoRes.data ?? []) as { saldo_total: number; saldo_pagado: number }[]
      const creditosActivos = lineasCreditoRes.count ?? 0
      const totalEnCredito = lineasCredito.reduce(
        (sum, lc) => sum + (lc.saldo_total - lc.saldo_pagado),
        0
      )

      // Solo productos con stock cuentan para "Total de productos" y su desglose.
      const conStock = productos.filter((p) => p.stock_actual > 0)
      const totalProductos = conStock.length
      const completo = conStock.filter((p) => p.estado_producto === "nuevo").length
      const parcial = conStock.filter((p) => p.estado_producto === "parcial").length
      const tester = conStock.filter((p) => p.estado_producto === "segunda").length

      return {
        totalProductos,
        completo,
        parcial,
        tester,
        stockBajo: stockBajoRes.count ?? 0,
        valorInventario,
        creditosActivos,
        totalEnCredito,
      }
    },
  })

  const marcas = useMarcas()
  const isLoading = stats.isLoading || marcas.isLoading

  const cards: DashboardCard[] = [
    {
      title: "Total de productos",
      value: stats.data?.totalProductos ?? 0,
      icon: Package,
      format: (v: number) => v.toLocaleString("es-MX"),
      color: "text-brand-gold",
      breakdown: [
        { label: "Completo", value: stats.data?.completo ?? 0 },
        { label: "Parcial", value: stats.data?.parcial ?? 0 },
        { label: "Tester", value: stats.data?.tester ?? 0 },
      ],
    },
    {
      title: "Número de marcas",
      value: marcas.data?.length ?? 0,
      icon: Tags,
      format: (v: number) => v.toLocaleString("es-MX"),
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
      title: "Valor del inventario",
      value: stats.data?.valorInventario ?? 0,
      icon: DollarSign,
      format: (v: number) => `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      color: "text-primary",
    },
    {
      title: "Créditos activos",
      value: stats.data?.creditosActivos ?? 0,
      icon: CreditCard,
      format: (v: number) => v.toLocaleString("es-MX"),
      color: "text-brand-gold",
    },
    {
      title: "Total en crédito",
      value: stats.data?.totalEnCredito ?? 0,
      icon: Landmark,
      format: (v: number) => `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      color: "text-brand-terracotta",
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

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <p className={`text-2xl font-body font-bold tabular-nums ${card.alert ? "text-orange-500" : ""}`}>
                    {card.format(card.value)}
                  </p>
                  {card.breakdown && (
                    <div className="mt-2 flex gap-3 text-xs">
                      {card.breakdown.map((b) => (
                        <span key={b.label}>
                          <span className="text-muted-foreground">{b.label} </span>
                          <span className="font-semibold tabular-nums">{b.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
        <CumpleanosWidget />
      </div>
    </div>
  )
}
