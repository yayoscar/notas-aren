"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { formatMoney } from "@/lib/utils"
import type { LineaCredito } from "@/lib/supabase/types"

interface Props {
  clienteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HistorialCrediticioDialog({
  clienteId,
  open,
  onOpenChange,
}: Props) {
  const supabase = createClient()

  const { data: lineas, isLoading } = useQuery<LineaCredito[]>({
    queryKey: ["historial_crediticio", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lineas_credito")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as LineaCredito[]
    },
    enabled: !!clienteId && open,
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Historial crediticio</AlertDialogTitle>
          <AlertDialogDescription>
            Líneas de crédito del cliente seleccionado
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !lineas || lineas.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">
            Sin historial de créditos
          </p>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="space-y-2 md:hidden">
              {lineas.map((lc) => {
                const saldoPendiente = lc.saldo_total - lc.saldo_pagado
                return (
                  <div key={lc.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {new Date(lc.fecha_inicio).toLocaleDateString("es-MX")}
                      </span>
                      <Badge
                        variant={
                          lc.estado === "liquidada" ? "secondary" : "default"
                        }
                      >
                        {lc.estado === "liquidada" ? "Liquidada" : "Activa"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Saldo total</p>
                        <p className="text-sm font-mono tabular-nums">
                          {formatMoney(lc.saldo_total)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Pagado</p>
                        <p className="text-sm font-mono tabular-nums text-green-600">
                          {formatMoney(lc.saldo_pagado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Pendiente</p>
                        <p className="text-sm font-mono tabular-nums text-orange-600">
                          {formatMoney(saldoPendiente)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Periodicidad: {lc.periodicidad}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha inicio</TableHead>
                    <TableHead>Periodicidad</TableHead>
                    <TableHead className="text-right">Saldo total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((lc) => {
                    const saldoPendiente = lc.saldo_total - lc.saldo_pagado
                    return (
                      <TableRow key={lc.id}>
                        <TableCell>
                          {new Date(lc.fecha_inicio).toLocaleDateString("es-MX")}
                        </TableCell>
                        <TableCell className="capitalize">
                          {lc.periodicidad}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(lc.saldo_total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(lc.saldo_pagado)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(saldoPendiente)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              lc.estado === "liquidada"
                                ? "secondary"
                                : "default"
                            }
                          >
                            {lc.estado === "liquidada"
                              ? "Liquidada"
                              : "Activa"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogAction>Cerrar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
