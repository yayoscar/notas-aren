"use client"

import { useState } from "react"
import { useCrearSegunda } from "@/hooks/useProductosDerivados"
import type { Producto } from "@/lib/supabase/types"
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

interface Props {
  producto: Producto
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegistrarSegundaDialog({ producto, open, onOpenChange }: Props) {
  const [cantidad, setCantidad] = useState(1)
  const crearSegunda = useCrearSegunda()

  function handleSubmit() {
    crearSegunda.mutate(
      {
        producto_origen_id: producto.id,
        cantidad,
        descontar_stock: true,
      },
      {
        onSuccess: () => {
          setCantidad(1)
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar como Tester</DialogTitle>
          <DialogDescription>
            Se descontará del stock de <strong>{producto.nombre}</strong> y se
            creará (o actualizará) un registro tester. El precio se puede
            ajustar después con &quot;Editar precio&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Stock disponible:</span>
            <span className="font-mono font-medium">
              {producto.stock_actual}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cantidad_segunda">Cantidad de unidades</Label>
            <Input
              id="cantidad_segunda"
              type="number"
              min={1}
              max={producto.stock_actual}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
            />
            {cantidad > producto.stock_actual && (
              <p className="text-sm text-destructive">
                No puedes registrar más testers que el stock disponible
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              crearSegunda.isPending ||
              cantidad < 1 ||
              cantidad > producto.stock_actual
            }
          >
            {crearSegunda.isPending ? "Registrando..." : "Registrar Tester"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
