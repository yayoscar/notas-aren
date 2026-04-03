"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEntrada } from "@/hooks/useEntradas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatDate } from "@/lib/utils"

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  )
}

export default function EntradaDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: entrada, isLoading } = useEntrada(id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!entrada) {
    return <p className="text-muted-foreground">Entrada no encontrada</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/entradas">← Entradas</Link>
        </Button>
        <h1 className="text-2xl font-bold">{entrada.folio}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la entrada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Proveedor" value={entrada.proveedores?.nombre} />
            <DetailRow label="Fecha" value={formatDate(entrada.fecha)} />
            <DetailRow
              label="Fecha factura"
              value={entrada.fecha_factura ? formatDate(entrada.fecha_factura) : null}
            />
            <DetailRow label="N° Factura" value={entrada.numero_factura} />
            <DetailRow label="Total" value={formatMoney(entrada.total)} />
            {entrada.notas && (
              <div className="md:col-span-2 lg:col-span-3 space-y-1">
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm font-medium">{entrada.notas}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {(entrada.entradas_detalle ?? []).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">Sin productos</p>
            )}
            {(entrada.entradas_detalle ?? []).map((d) => (
              <div key={d.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{d.productos?.nombre ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{d.productos?.sku}</p>
                <div className="flex justify-between text-xs mt-1">
                  <span>Cant: {d.cantidad}</span>
                  <span>Costo: {formatMoney(d.precio_unitario)}</span>
                  <span className="font-bold font-mono tabular-nums">{formatMoney(d.subtotal)}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>Contado: {d.productos?.precio_venta_contado != null ? formatMoney(d.productos.precio_venta_contado) : "—"}</span>
                  <span>Crédito: {d.productos?.precio_venta_credito != null ? formatMoney(d.productos.precio_venta_credito) : "—"}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Costo unitario</TableHead>
                  <TableHead className="text-right">P. Contado</TableHead>
                  <TableHead className="text-right">P. Crédito</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(entrada.entradas_detalle ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Sin productos
                    </TableCell>
                  </TableRow>
                )}
                {(entrada.entradas_detalle ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <p className="font-medium">{d.productos?.nombre ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{d.productos?.sku}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(d.precio_unitario)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {d.productos?.precio_venta_contado != null ? formatMoney(d.productos.precio_venta_contado) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {d.productos?.precio_venta_credito != null ? formatMoney(d.productos.precio_venta_credito) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.cantidad}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(d.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
