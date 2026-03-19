"use client"

import { useMemo } from "react"
import Link from "next/link"
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
import {
  isBefore,
  addDays,
  addMonths,
  nextFriday,
  lastDayOfMonth,
  setDate,
} from "date-fns"

function calcularProximoPago(
  periodicidad: string | null,
  fechaPrimerPago: string | null,
  mesesCredito: number | null
): Date | null {
  if (!periodicidad || !fechaPrimerPago) return null

  const hoy = new Date()
  let fecha = new Date(fechaPrimerPago)
  const fechaFin = addMonths(new Date(fechaPrimerPago), mesesCredito ?? 2)

  // Avanzar hasta la próxima fecha de pago después de hoy
  while (isBefore(fecha, hoy)) {
    if (periodicidad === "semanal") {
      fecha = nextFriday(fecha)
    } else if (periodicidad === "quincenal") {
      const day = fecha.getDate()
      if (day <= 15) {
        fecha = lastDayOfMonth(fecha)
      } else {
        const nextMonth = new Date(fecha)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        fecha = setDate(nextMonth, 15)
      }
    } else {
      const nextMonth = new Date(fecha)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      fecha = lastDayOfMonth(nextMonth)
    }

    // No generar fechas más allá del plazo del crédito
    if (isBefore(fechaFin, fecha)) return null
  }

  return fecha
}

export default function SeguimientoPagosPage() {
  const { data: creditos, isLoading } = useCreditosActivos()

  const { proximosAPagar, atrasados, todos } = useMemo(() => {
    if (!creditos) return { proximosAPagar: [], atrasados: [], todos: [] }

    const hoy = new Date()
    const en3Dias = addDays(hoy, 3)

    const conFechas = creditos.map((c) => ({
      ...c,
      proximoPago: calcularProximoPago(
        c.periodicidad,
        c.fecha_primer_pago,
        c.meses_credito
      ),
    }))

    return {
      proximosAPagar: conFechas.filter(
        (c) =>
          c.proximoPago &&
          !isBefore(c.proximoPago, hoy) &&
          isBefore(c.proximoPago, en3Dias)
      ),
      atrasados: conFechas.filter(
        (c) => c.proximoPago && isBefore(c.proximoPago, hoy)
      ),
      todos: conFechas,
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atrasados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.clientes?.nombre}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/ventas/${c.id}`}
                        className="hover:underline"
                      >
                        {c.folio}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      ${c.saldo_restante.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {c.proximoPago?.toLocaleDateString("es-MX")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Próximos a pagar */}
      {proximosAPagar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos a pagar ({proximosAPagar.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Próximo pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proximosAPagar.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.clientes?.nombre}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/ventas/${c.id}`}
                        className="hover:underline"
                      >
                        {c.folio}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      ${c.saldo_restante.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {c.proximoPago?.toLocaleDateString("es-MX")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Todos los créditos activos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Créditos activos ({todos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Abonado</TableHead>
                <TableHead className="text-right">Restante</TableHead>
                <TableHead>Plazo</TableHead>
                <TableHead>Periodicidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todos.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    Sin créditos activos
                  </TableCell>
                </TableRow>
              )}
              {todos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/ventas/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.folio}
                    </Link>
                  </TableCell>
                  <TableCell>{c.clientes?.nombre}</TableCell>
                  <TableCell className="text-right">
                    ${c.total.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    ${c.total_abonado.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-orange-600 font-medium">
                    ${c.saldo_restante.toFixed(2)}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
