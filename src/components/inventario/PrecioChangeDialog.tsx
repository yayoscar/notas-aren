"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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

interface Precios {
  precio_compra: number
  precio_venta_contado: number
  precio_venta_credito: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  precioActual: Precios
  precioNuevo: Precios
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

const LABELS: { key: keyof Precios; label: string }[] = [
  { key: "precio_compra", label: "Precio compra" },
  { key: "precio_venta_contado", label: "Venta contado" },
  { key: "precio_venta_credito", label: "Venta crédito" },
]

import { formatMoney } from "@/lib/utils"

function formatPrice(value: number) {
  return formatMoney(Number(value))
}

function formatDiff(actual: number, nuevo: number) {
  const diff = nuevo - actual
  const pct = actual > 0 ? ((diff / actual) * 100).toFixed(1) : "—"
  const sign = diff > 0 ? "+" : ""
  return { diff, text: `${sign}${formatPrice(diff)}`, pct: `${sign}${pct}%` }
}

export function PrecioChangeDialog({
  open,
  onOpenChange,
  precioActual,
  precioNuevo,
  onConfirm,
  onCancel,
  isPending,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Cambio de precios detectado</AlertDialogTitle>
          <AlertDialogDescription>
            Se encontraron diferencias en los precios. ¿Deseas actualizar?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Nuevo</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {LABELS.map(({ key, label }) => {
              const actual = precioActual[key]
              const nuevo = precioNuevo[key]
              const changed = actual !== nuevo

              if (!changed) {
                return (
                  <TableRow key={key}>
                    <TableCell className="text-muted-foreground">{label}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatPrice(actual)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatPrice(nuevo)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">Sin cambio</TableCell>
                  </TableRow>
                )
              }

              const { diff, text, pct } = formatDiff(actual, nuevo)
              const color = diff > 0 ? "text-green-600" : "text-destructive"

              return (
                <TableRow key={key}>
                  <TableCell className="font-semibold">{label}</TableCell>
                  <TableCell className="text-right">{formatPrice(actual)}</TableCell>
                  <TableCell className={`text-right font-semibold ${color}`}>{formatPrice(nuevo)}</TableCell>
                  <TableCell className={`text-right ${color}`}>
                    {text} ({pct})
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Mantener precios actuales
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? "Actualizando..." : "Actualizar precios"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
