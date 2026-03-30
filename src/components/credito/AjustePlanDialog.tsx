"use client"

import { useState, useMemo } from "react"
import { useAjustarPlanPagos } from "@/hooks/useLineaCredito"
import type { LineaCredito } from "@/lib/supabase/types"
import { formatMoney } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  lineaCredito: LineaCredito
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AjustePlanDialog({ lineaCredito, open, onOpenChange }: Props) {
  const [mesesCredito, setMesesCredito] = useState(lineaCredito.meses_credito)
  const [periodicidad, setPeriodicidad] = useState(lineaCredito.periodicidad)
  const [fechaSiguientePago, setFechaSiguientePago] = useState(lineaCredito.fecha_siguiente_pago ?? "")
  const ajustar = useAjustarPlanPagos()

  const saldoPendiente = lineaCredito.saldo_total - lineaCredito.saldo_pagado

  // Compute projected payment calendar
  const calendario = useMemo(() => {
    if (!fechaSiguientePago || saldoPendiente <= 0) return []

    // Calculate number of payments remaining
    const periodoDias = periodicidad === "semanal" ? 7 : periodicidad === "quincenal" ? 14 : 30
    const totalPagos = Math.max(1, Math.ceil(mesesCredito * 30 / periodoDias))
    const cuota = Math.ceil((saldoPendiente / totalPagos) * 100) / 100

    const pagos: { fecha: string; monto: number }[] = []
    let fecha = new Date(fechaSiguientePago + "T12:00:00")
    let restante = saldoPendiente

    for (let i = 0; i < totalPagos && restante > 0; i++) {
      const montoEste = Math.min(cuota, restante)
      pagos.push({
        fecha: fecha.toLocaleDateString("es-MX"),
        monto: montoEste,
      })
      restante -= montoEste
      // Advance date: semanal = +7 dias, quincenal = 15 y fin de mes, mensual = fin de mes
      if (periodicidad === "semanal") {
        fecha = new Date(fecha.getTime() + 7 * 86400000)
      } else if (periodicidad === "quincenal") {
        const day = fecha.getDate()
        if (day <= 15) {
          fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 12)
        } else {
          fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 15, 12)
        }
      } else {
        fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 2, 0, 12)
      }
    }

    return pagos
  }, [fechaSiguientePago, saldoPendiente, mesesCredito, periodicidad])

  function handleSubmit() {
    ajustar.mutate(
      {
        linea_credito_id: lineaCredito.id,
        meses_credito: mesesCredito,
        periodicidad,
        fecha_siguiente_pago: fechaSiguientePago,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar plan de pagos</DialogTitle>
          <DialogDescription>
            Modifica el plazo, periodicidad o fecha del siguiente pago. Saldo pendiente:{" "}
            <span className="font-mono font-medium text-foreground">{formatMoney(saldoPendiente)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Meses credito */}
          <div className="space-y-2">
            <Label>Plazo (meses)</Label>
            <Select value={String(mesesCredito)} onValueChange={(v) => setMesesCredito(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} {m === 1 ? "mes" : "meses"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Periodicidad */}
          <div className="space-y-2">
            <Label>Periodicidad</Label>
            <Select value={periodicidad} onValueChange={setPeriodicidad}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quincenal">Quincenal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha siguiente pago */}
          <div className="space-y-2">
            <Label>Fecha siguiente pago</Label>
            <Input
              type="date"
              value={fechaSiguientePago}
              onChange={(e) => setFechaSiguientePago(e.target.value)}
            />
          </div>

          {/* Preview calendario */}
          {calendario.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium mb-2">Calendario proyectado ({calendario.length} pagos)</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {calendario.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{p.fecha}</span>
                    <span className="font-mono tabular-nums">{formatMoney(p.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={ajustar.isPending || !fechaSiguientePago}>
            {ajustar.isPending ? "Guardando..." : "Confirmar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
