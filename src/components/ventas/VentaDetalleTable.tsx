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
import { Badge } from "@/components/ui/badge"
import { Trash2 } from "lucide-react"
import { formatMoney } from "@/lib/utils"
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
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-0">
        {detalles.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Agrega productos a la venta
          </p>
        )}
        {detalles.map((d, i) => {
          const subtotal = d.cantidad * d.precio_unitario
          const precioMinimo = d._precio_minimo ?? 0
          const precioInvalido = d.precio_unitario < precioMinimo

          return (
            <div key={`${d.producto_id}-${i}`} className="py-3 border-b last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-medium truncate">{d._nombre}</p>
                  {d._estado_producto && d._estado_producto !== "nuevo" && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                      {d._estado_producto === "parcial" ? `Parcial${d._porcentaje_parcial ? ` ${d._porcentaje_parcial}%` : ""}` : `Segunda${d._porcentaje_parcial ? ` ${d._porcentaje_parcial}%` : ""}`}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => onRemove(i)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Stock: {d._stock_actual}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Precio</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={precioMinimo}
                    value={d.precio_unitario}
                    onChange={(e) =>
                      onUpdate(i, "precio_unitario", Number(e.target.value))
                    }
                    className={precioInvalido ? "border-destructive h-9" : "h-9"}
                  />
                  {precioInvalido && (
                    <p className="text-xs text-destructive mt-1">
                      Mín: {formatMoney(precioMinimo)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cant.</label>
                  {d._estado_producto === "parcial" || d._estado_producto === "segunda" ? (
                    <p className="text-sm font-mono h-9 flex items-center">1</p>
                  ) : (
                    <Input
                      type="number"
                      min={1}
                      max={d._stock_actual}
                      value={d.cantidad}
                      onChange={(e) =>
                        onUpdate(i, "cantidad", Number(e.target.value))
                      }
                      className="h-9"
                    />
                  )}
                </div>
              </div>
              <p className="text-xs tabular-nums text-muted-foreground mt-1.5">
                {d.cantidad} &times; {formatMoney(d.precio_unitario)} ={" "}
                <span className="font-medium text-foreground">
                  {formatMoney(subtotal)}
                </span>
              </p>
            </div>
          )
        })}
        {detalles.length > 0 && (
          <div className="flex justify-end pt-3">
            <p className="text-lg font-bold">Total: {formatMoney(total)}</p>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
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
                <TableRow key={`${d.producto_id}-${i}`}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{d._nombre}</p>
                      {d._estado_producto && d._estado_producto !== "nuevo" && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {d._estado_producto === "parcial" ? `Parcial${d._porcentaje_parcial ? ` ${d._porcentaje_parcial}%` : ""}` : `Segunda${d._porcentaje_parcial ? ` ${d._porcentaje_parcial}%` : ""}`}
                        </Badge>
                      )}
                    </div>
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
                        Mín: {formatMoney(precioMinimo)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {d._estado_producto === "parcial" || d._estado_producto === "segunda" ? (
                      <p className="text-sm font-mono text-center">1</p>
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        max={d._stock_actual}
                        value={d.cantidad}
                        onChange={(e) =>
                          onUpdate(i, "cantidad", Number(e.target.value))
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(subtotal)}
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
                  {formatMoney(total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </>
  )
}
