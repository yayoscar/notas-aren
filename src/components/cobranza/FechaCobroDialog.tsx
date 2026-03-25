"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAsignarFechaCobro } from "@/hooks/useCobranza"
import type { CreditoCobranza } from "@/hooks/useCobranza"

interface Props {
  credito: CreditoCobranza | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FechaCobroDialog({ credito, open, onOpenChange }: Props) {
  const asignar = useAsignarFechaCobro()
  const [fecha, setFecha] = useState("")

  useEffect(() => {
    if (credito?.fecha_cobro_especifica) {
      setFecha(credito.fecha_cobro_especifica)
    } else {
      setFecha("")
    }
  }, [credito])

  function handleGuardar() {
    if (!credito || !fecha) return
    asignar.mutate(
      { venta_id: credito.id, fecha_cobro_especifica: fecha },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  function handleQuitar() {
    if (!credito) return
    asignar.mutate(
      { venta_id: credito.id, fecha_cobro_especifica: null },
      {
        onSuccess: () => {
          setFecha("")
          onOpenChange(false)
        },
      }
    )
  }

  if (!credito) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Asignar fecha de cobro</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {credito.clientes?.nombre} — {credito.folio}
          </p>

          <div className="space-y-2">
            <Label>Fecha de cobro</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {credito.fecha_cobro_especifica ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={handleQuitar}
                disabled={asignar.isPending}
              >
                Quitar fecha
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleGuardar}
                disabled={asignar.isPending || !fecha}
              >
                {asignar.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
