"use client"

import { useMemo } from "react"
import { useCreditosActivos } from "@/hooks/usePagos"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { isBefore, addDays } from "date-fns"
import { formatMoney, formatDate } from "@/lib/utils"

export default function SeguimientoPagosPage() {
  const { data: creditos, isLoading } = useCreditosActivos()

  const { proximosAPagar, atrasados, todos } = useMemo(() => {
    if (!creditos) return { proximosAPagar: [], atrasados: [], todos: [] }

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const en3Dias = addDays(hoy, 3)

    return {
      atrasados: creditos.filter(
        (c) =>
          c.fecha_siguiente_pago &&
          isBefore(new Date(c.fecha_siguiente_pago), hoy)
      ),
      proximosAPagar: creditos.filter(
        (c) =>
          c.fecha_siguiente_pago &&
          !isBefore(new Date(c.fecha_siguiente_pago), hoy) &&
          isBefore(new Date(c.fecha_siguiente_pago), en3Dias)
      ),
      todos: creditos,
    }
  }, [creditos])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Seguimiento de Pagos</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Seguimiento de Pagos</h1>

      {/* Atrasados */}
      {atrasados.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              Pagos atrasados ({atrasados.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {atrasados.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-red-200 dark:border-red-900/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {c.clientes?.nombre}
                    </span>
                    <Badge variant="destructive">
                      {formatDate(c.fecha_siguiente_pago!)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {c.periodicidad === "semanal"
                        ? "Semanal"
                        : c.periodicidad === "quincenal"
                          ? "Quincenal"
                          : "Mensual"}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-orange-600">
                      {formatMoney(c.saldo_pendiente)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Saldo pendiente</TableHead>
                  <TableHead>Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atrasados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.clientes?.nombre}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(c.saldo_pendiente)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {formatDate(c.fecha_siguiente_pago!)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Proximos a pagar */}
      {proximosAPagar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Proximos a pagar ({proximosAPagar.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {proximosAPagar.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {c.clientes?.nombre}
                    </span>
                    <Badge variant="outline">
                      {formatDate(c.fecha_siguiente_pago!)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {c.periodicidad === "semanal"
                        ? "Semanal"
                        : c.periodicidad === "quincenal"
                          ? "Quincenal"
                          : "Mensual"}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-orange-600">
                      {formatMoney(c.saldo_pendiente)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Saldo pendiente</TableHead>
                  <TableHead>Proximo pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proximosAPagar.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.clientes?.nombre}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(c.saldo_pendiente)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatDate(c.fecha_siguiente_pago!)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Todos los creditos activos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Creditos activos ({todos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {todos.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Sin creditos activos
              </p>
            )}
            {todos.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {c.clientes?.nombre}
                  </span>
                  {c.fecha_siguiente_pago && (
                    <span className="text-xs text-muted-foreground">
                      Sig. pago: {formatDate(c.fecha_siguiente_pago)}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Total</div>
                    <div className="text-sm font-mono tabular-nums">
                      {formatMoney(c.saldo_total)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Abonado</div>
                    <div className="text-sm font-mono tabular-nums text-green-600">
                      {formatMoney(c.saldo_pagado)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Pendiente</div>
                    <div className="text-sm font-mono tabular-nums text-orange-600">
                      {formatMoney(c.saldo_pendiente)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 text-xs">
                  <Badge variant="outline">
                    {c.meses_credito ?? 2}{" "}
                    {(c.meses_credito ?? 2) === 1 ? "mes" : "meses"}
                  </Badge>
                  <Badge variant="secondary">
                    {c.periodicidad === "semanal"
                      ? "Semanal"
                      : c.periodicidad === "quincenal"
                        ? "Quincenal"
                        : "Mensual"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Abonado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead>Plazo</TableHead>
                <TableHead>Periodicidad</TableHead>
                <TableHead>Sig. pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todos.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    Sin creditos activos
                  </TableCell>
                </TableRow>
              )}
              {todos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.clientes?.nombre}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(c.saldo_total)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatMoney(c.saldo_pagado)}
                  </TableCell>
                  <TableCell className="text-right text-orange-600 font-medium">
                    {formatMoney(c.saldo_pendiente)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {c.meses_credito ?? 2}{" "}
                      {(c.meses_credito ?? 2) === 1 ? "mes" : "meses"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {c.periodicidad === "semanal"
                        ? "Semanal"
                        : c.periodicidad === "quincenal"
                          ? "Quincenal"
                          : "Mensual"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.fecha_siguiente_pago
                      ? formatDate(c.fecha_siguiente_pago)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
