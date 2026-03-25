"use client"

import { useState, useEffect } from "react"
import { useCrearPrecio } from "@/hooks/usePreciosHistorico"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { PrecioChangeDialog } from "./PrecioChangeDialog"
import type { Producto } from "@/lib/supabase/types"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"

interface Props {
  producto: Producto
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditarPrecioDialog({ producto, open, onOpenChange }: Props) {
  const [precioCompra, setPrecioCompra] = useState(producto.precio_compra)
  const [precioContado, setPrecioContado] = useState(producto.precio_venta_contado)
  const [precioCredito, setPrecioCredito] = useState(producto.precio_venta_credito)
  const [showConfirm, setShowConfirm] = useState(false)

  const crearPrecio = useCrearPrecio()
  const { vendedor } = useVendedorActual()

  useEffect(() => {
    if (open) {
      setPrecioCompra(producto.precio_compra)
      setPrecioContado(producto.precio_venta_contado)
      setPrecioCredito(producto.precio_venta_credito)
    }
  }, [open, producto])

  const hayCambios =
    precioCompra !== producto.precio_compra ||
    precioContado !== producto.precio_venta_contado ||
    precioCredito !== producto.precio_venta_credito

  function handleSubmit() {
    if (!hayCambios) return
    setShowConfirm(true)
  }

  function handleConfirm() {
    crearPrecio.mutate(
      {
        producto_id: producto.id,
        precio_compra: precioCompra,
        precio_venta_contado: precioContado,
        precio_venta_credito: precioCredito,
        origen: "inventario",
        usuario_id: vendedor?.auth_user_id ?? null,
      },
      {
        onSuccess: () => {
          setShowConfirm(false)
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <>
      <Dialog open={open && !showConfirm} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar precios — {producto.nombre}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio actual</Label>
                <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
                  <p>Compra: <span className="font-mono">{formatMoney(producto.precio_compra)}</span></p>
                  <p>Contado: <span className="font-mono">{formatMoney(producto.precio_venta_contado)}</span></p>
                  <p>Crédito: <span className="font-mono">{formatMoney(producto.precio_venta_credito)}</span></p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nuevo precio</Label>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="precio_compra" className="text-xs text-muted-foreground">Compra</Label>
                    <Input
                      id="precio_compra"
                      type="number"
                      step="0.01"
                      min="0"
                      value={precioCompra}
                      onChange={(e) => setPrecioCompra(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="precio_contado" className="text-xs text-muted-foreground">Contado</Label>
                    <Input
                      id="precio_contado"
                      type="number"
                      step="0.01"
                      min="0"
                      value={precioContado}
                      onChange={(e) => setPrecioContado(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="precio_credito" className="text-xs text-muted-foreground">Crédito</Label>
                    <Input
                      id="precio_credito"
                      type="number"
                      step="0.01"
                      min="0"
                      value={precioCredito}
                      onChange={(e) => setPrecioCredito(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!hayCambios}>
              Revisar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrecioChangeDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        precioActual={{
          precio_compra: producto.precio_compra,
          precio_venta_contado: producto.precio_venta_contado,
          precio_venta_credito: producto.precio_venta_credito,
        }}
        precioNuevo={{
          precio_compra: precioCompra,
          precio_venta_contado: precioContado,
          precio_venta_credito: precioCredito,
        }}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        isPending={crearPrecio.isPending}
      />
    </>
  )
}
