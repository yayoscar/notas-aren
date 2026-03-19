"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import { Trash2 } from "lucide-react"
import type { VentaDetalleValues } from "@/lib/validations/venta.schema"

interface Props {
  detalles: VentaDetalleValues[]
  tipoVenta: "contado" | "credito" // used for context, reserved for future price validation display
  onUpdate: (index: number, field: string, value: number) => void
  onRemove: (index: number) => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function VentaDetalleTable({ detalles, tipoVenta, onUpdate, onRemove }: Props) {
  const total = detalles.reduce(
    (sum, d) => sum + d.cantidad * d.precio_unitario,
    0
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead className="w-32">Precio</TableHead>
          <TableHead className="w-24">Cant.</TableHead>
          <TableHead className="text-right w-28">Subtotal</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {detalles.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground py-8"
            >
              Agrega productos a la venta
            </TableCell>
          </TableRow>
        )}
        {detalles.map((d, i) => {
          const subtotal = d.cantidad * d.precio_unitario
          const precioMinimo = d._precio_minimo ?? 0
          const precioInvalido = d.precio_unitario < precioMinimo

          return (
            <TableRow key={d.producto_id}>
              <TableCell>
                <p className="text-sm font-medium">{d._nombre}</p>
                <p className="text-xs text-muted-foreground">
                  Stock: {d._stock_actual}
                </p>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  min={precioMinimo}
                  value={d.precio_unitario}
                  onChange={(e) =>
                    onUpdate(i, "precio_unitario", Number(e.target.value))
                  }
                  className={precioInvalido ? "border-destructive" : ""}
                />
                {precioInvalido && (
                  <p className="text-xs text-destructive mt-1">
                    Mín: ${precioMinimo.toFixed(2)}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={1}
                  max={d._stock_actual}
                  value={d.cantidad}
                  onChange={(e) =>
                    onUpdate(i, "cantidad", Number(e.target.value))
                  }
                />
              </TableCell>
              <TableCell className="text-right font-medium">
                ${subtotal.toFixed(2)}
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(i)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
      {detalles.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="font-semibold">
              Total
            </TableCell>
            <TableCell className="text-right font-bold text-lg">
              ${total.toFixed(2)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      )}
    </Table>
  )
}
