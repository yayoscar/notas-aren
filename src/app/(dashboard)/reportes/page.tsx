"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useVentasPorPeriodo,
  useVentasPorVendedor,
  useVentasPorTipo,
  useProductosMasVendidos,
  useCreditosResumen,
  useIngresosVsEgresos,
} from "@/hooks/useReportes"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  type PieLabelRenderProps,
} from "recharts"
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from "lucide-react"

const COLORS = [
  "hsl(26, 52%, 34%)",
  "hsl(30, 55%, 72%)",
  "hsl(36, 65%, 50%)",
  "hsl(18, 55%, 42%)",
]

export default function ReportesPage() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]

  const [fechaInicio, setFechaInicio] = useState(firstDay)
  const [fechaFin, setFechaFin] = useState(lastDay)

  const ventasPeriodo = useVentasPorPeriodo(fechaInicio, fechaFin)
  const ventasVendedor = useVentasPorVendedor(fechaInicio, fechaFin)
  const ventasTipo = useVentasPorTipo(fechaInicio, fechaFin)
  const productosTop = useProductosMasVendidos(fechaInicio, fechaFin)
  const creditosResumen = useCreditosResumen()
  const ingresosEgresos = useIngresosVsEgresos(fechaInicio, fechaFin)

  const totalVentas =
    ventasPeriodo.data?.reduce((sum, v) => sum + v.total, 0) ?? 0
  const totalGastos = ingresosEgresos.data?.egresos ?? 0
  const balance = (ingresosEgresos.data?.ingresos ?? 0) - totalGastos
  const creditosActivos =
    creditosResumen.data?.find((c) => c.estado === "Activos")?.count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Desde</Label>
          <Input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-40"
          />
          <Label className="text-sm">Hasta</Label>
          <Input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ventas</p>
                <p className="text-xl font-bold">${totalVentas.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gastos</p>
                <p className="text-xl font-bold">${totalGastos.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p
                  className={`text-xl font-bold ${balance >= 0 ? "text-green-600" : "text-destructive"}`}
                >
                  ${balance.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <CreditCard className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Créditos activos
                </p>
                <p className="text-xl font-bold">{creditosActivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ventas por periodo */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas por periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ventasPeriodo.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "short",
                    })
                  }
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Total"]}
                />
                <Bar dataKey="total" fill="hsl(26, 52%, 34%)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ventas por vendedor */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas por vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={ventasVendedor.data ?? []}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="vendedor" type="category" fontSize={12} width={100} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Total"]}
                />
                <Bar dataKey="total" fill="hsl(30, 55%, 72%)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ventas por tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ventasTipo.data ?? []}
                  dataKey="total"
                  nameKey="tipo"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }: PieLabelRenderProps) => `${name ?? ""} (${value ?? 0})`}
                >
                  {(ventasTipo.data ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Total"]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Productos más vendidos */}
        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={productosTop.data ?? []}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} />
                <YAxis
                  dataKey="producto"
                  type="category"
                  fontSize={11}
                  width={120}
                  tickFormatter={(v) =>
                    v.length > 18 ? v.substring(0, 18) + "…" : v
                  }
                />
                <Tooltip />
                <Bar
                  dataKey="cantidad"
                  fill="hsl(36, 65%, 50%)"
                  radius={4}
                  name="Unidades"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Créditos resumen */}
        <Card>
          <CardHeader>
            <CardTitle>Créditos: activos vs liquidados</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={creditosResumen.data ?? []}
                  dataKey="count"
                  nameKey="estado"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }: PieLabelRenderProps) => `${name ?? ""}: ${value ?? 0}`}
                >
                  {(creditosResumen.data ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ingresos vs Egresos */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos vs Egresos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    tipo: "Ingresos",
                    monto: ingresosEgresos.data?.ingresos ?? 0,
                  },
                  {
                    tipo: "Egresos",
                    monto: ingresosEgresos.data?.egresos ?? 0,
                  },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Monto"]}
                />
                <Bar dataKey="monto" radius={4}>
                  <Cell fill="hsl(26, 52%, 34%)" />
                  <Cell fill="hsl(18, 55%, 42%)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
