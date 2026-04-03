"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useLineasCreditoCliente } from "@/hooks/useLineaCredito"
import { useCliente } from "@/hooks/useClientes"
import { Button } from "@/components/ui/button"
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
import { formatMoney, formatDate } from "@/lib/utils"

function estadoBadge(estado: string) {
  const variant = estado === "activa" ? "default" : estado === "liquidada" ? "secondary" : "destructive"
  const label = estado === "activa" ? "Activa" : estado === "liquidada" ? "Liquidada" : "Suspendida"
  return <Badge variant={variant}>{label}</Badge>
}

export default function CreditosClientePage() {
  const params = useParams()
  const clienteId = params.id as string
  const { data: lineas, isLoading } = useLineasCreditoCliente(clienteId)
  const clienteQuery = useCliente(clienteId)
  const clienteNombre = clienteQuery.data?.nombre ?? ""

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/clientes/${clienteId}`}>&larr; Cliente</Link>
        </Button>
        <h1 className="text-2xl font-bold">Créditos de {clienteNombre}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Líneas de crédito</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !lineas || lineas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Sin líneas de crédito registradas
            </p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {lineas.map((l) => {
                  const pendiente = l.saldo_total - l.saldo_pagado
                  return (
                    <Link key={l.id} href={`/clientes/${clienteId}/credito/${l.id}`} className="block">
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          {estadoBadge(l.estado)}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(l.fecha_inicio)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Total</p>
                            <p className="text-xs font-mono font-bold tabular-nums">{formatMoney(l.saldo_total)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Pagado</p>
                            <p className="text-xs font-mono tabular-nums text-green-600">{formatMoney(l.saldo_pagado)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Pendiente</p>
                            <p className="text-xs font-mono tabular-nums text-orange-600">{formatMoney(pendiente)}</p>
                          </div>
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                          <span>{l.periodicidad === "semanal" ? "Semanal" : l.periodicidad === "quincenal" ? "Quincenal" : "Mensual"}</span>
                          <span>{l.meses_credito} {l.meses_credito === 1 ? "mes" : "meses"}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha inicio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead>Periodicidad</TableHead>
                      <TableHead>Plazo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l) => {
                      const pendiente = l.saldo_total - l.saldo_pagado
                      return (
                        <TableRow key={l.id}>
                          <TableCell>
                            <Link href={`/clientes/${clienteId}/credito/${l.id}`}>
                              {estadoBadge(l.estado)}
                            </Link>
                          </TableCell>
                          <TableCell>{formatDate(l.fecha_inicio)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{formatMoney(l.saldo_total)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-green-600">{formatMoney(l.saldo_pagado)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-orange-600">{formatMoney(pendiente)}</TableCell>
                          <TableCell className="capitalize">{l.periodicidad}</TableCell>
                          <TableCell>{l.meses_credito} {l.meses_credito === 1 ? "mes" : "meses"}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
