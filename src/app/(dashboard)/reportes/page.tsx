"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useVentasPorPeriodo,
  useVentasPorVendedor,
  useVentasPorTipo,
  useProductosMasVendidos,
  useCreditosResumen,
  useIngresosVsEgresos,
  usePagosPorMetodo,
  usePagosPorCuenta,
  usePagosPorVendedorYMetodo,
} from "@/hooks/useReportes"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { formatMoney } from "@/lib/utils"

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
  const pagosMetodo = usePagosPorMetodo(fechaInicio, fechaFin)
  const pagosCuenta = usePagosPorCuenta(fechaInicio, fechaFin)
  const pagosVendedorMetodo = usePagosPorVendedorYMetodo(fechaInicio, fechaFin)

  const totalVentas =
    ventasPeriodo.data?.reduce((sum, v) => sum + v.total, 0) ?? 0
  const totalGastos = ingresosEgresos.data?.egresos ?? 0
  const balance = (ingresosEgresos.data?.ingresos ?? 0) - totalGastos
  const creditosActivos =
    creditosResumen.data?.find((c) => c.estado === "Activos")?.count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>

        {/* ==================== TAB: GENERAL ==================== */}
        <TabsContent value="general" className="mt-4 space-y-6">
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
                    <p className="text-xl font-bold">{formatMoney(totalVentas)}</p>
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
                    <p className="text-xl font-bold">{formatMoney(totalGastos)}</p>
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
                      {formatMoney(balance)}
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                      formatter={(v) => [formatMoney(Number(v)), "Monto"]}
                    />
                    <Bar dataKey="monto" radius={4}>
                      <Cell fill="hsl(26, 52%, 34%)" />
                      <Cell fill="hsl(18, 55%, 42%)" />
                    </Bar>
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
          </div>
        </TabsContent>

        {/* ==================== TAB: VENTAS ==================== */}
        <TabsContent value="ventas" className="mt-4 space-y-6">
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
                      formatter={(v) => [formatMoney(Number(v)), "Total"]}
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
                      formatter={(v) => [formatMoney(Number(v)), "Total"]}
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
                      formatter={(v) => [formatMoney(Number(v)), "Total"]}
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
          </div>
        </TabsContent>

        {/* ==================== TAB: PAGOS ==================== */}
        <TabsContent value="pagos" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Pagos por método */}
            <Card>
              <CardHeader>
                <CardTitle>Por método de pago</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pagosMetodo.data ?? []}
                      dataKey="total"
                      nameKey="tipo"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }: PieLabelRenderProps) =>
                        `${name ?? ""}: ${formatMoney(Number(value ?? 0))}`
                      }
                    >
                      {(pagosMetodo.data ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [formatMoney(Number(v)), "Total"]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Transferencias por cuenta */}
            <Card>
              <CardHeader>
                <CardTitle>Transferencias por cuenta bancaria</CardTitle>
              </CardHeader>
              <CardContent>
                {(pagosCuenta.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Sin transferencias en este periodo
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={pagosCuenta.data ?? []}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis
                        dataKey="cuenta"
                        type="category"
                        fontSize={12}
                        width={120}
                      />
                      <Tooltip
                        formatter={(v) => [formatMoney(Number(v)), "Total"]}
                      />
                      <Bar dataKey="total" fill="hsl(30, 55%, 72%)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Tabla vendedor × método */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Pagos por vendedor y método</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Efectivo</TableHead>
                      <TableHead className="text-right">Transferencia</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Retiro s/tarjeta</TableHead>
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pagosVendedorMetodo.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Sin pagos en este periodo
                        </TableCell>
                      </TableRow>
                    )}
                    {(pagosVendedorMetodo.data ?? []).map((row) => (
                      <TableRow key={row.vendedor}>
                        <TableCell className="font-medium">{row.vendedor}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.efectivo)}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.transferencia)}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{formatMoney(row.retiro_sin_tarjeta)}</TableCell>
                        <TableCell className="text-right font-bold">{formatMoney(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    {(pagosVendedorMetodo.data ?? []).length > 0 && (
                      <TableRow className="border-t-2">
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatMoney((pagosVendedorMetodo.data ?? []).reduce((s, r) => s + r.efectivo, 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatMoney((pagosVendedorMetodo.data ?? []).reduce((s, r) => s + r.transferencia, 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold hidden sm:table-cell">
                          {formatMoney((pagosVendedorMetodo.data ?? []).reduce((s, r) => s + r.retiro_sin_tarjeta, 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatMoney((pagosVendedorMetodo.data ?? []).reduce((s, r) => s + r.total, 0))}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
