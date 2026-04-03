"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useVenta } from "@/hooks/useVentas"
import { useDevoluciones } from "@/hooks/useDevoluciones"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { useCrearAbono } from "@/hooks/usePagos"
import { usePagosByLinea } from "@/hooks/useLineaCredito"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PagoForm } from "@/components/ventas/PagoForm"
import { TablaPagosPDF } from "@/components/ventas/TablaPagosPDF"
import { DevolucionUnificadaDialog } from "@/components/ventas/DevolucionUnificadaDialog"
import { VentaHistorialTab } from "@/components/ventas/VentaHistorialTab"
import { pdf } from "@react-pdf/renderer"
import { sharePDF, downloadPDF } from "@/lib/pdf-utils"
import { Share2, Download, Printer, RotateCcw } from "lucide-react"
import { AbonoTicketPDF } from "@/components/ventas/AbonoTicketPDF"
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

export default function VentaDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: venta, isLoading } = useVenta(id)
  const { vendedor } = useVendedorActual()
  const crearAbono = useCrearAbono()

  const { data: devoluciones } = useDevoluciones(id)

  const devueltoPorProducto = useMemo(() => {
    const map: Record<string, number> = {}
    if (!devoluciones) return map
    for (const dev of devoluciones) {
      for (const det of dev.devoluciones_detalle) {
        map[det.producto_id] = (map[det.producto_id] ?? 0) + det.cantidad
      }
    }
    return map
  }, [devoluciones])

  const [showAbonoForm, setShowAbonoForm] = useState(false)
  const [abonoMonto, setAbonoMonto] = useState(0)
  const [abonoTipo, setAbonoTipo] = useState("efectivo")
  const [abonoCuenta, setAbonoCuenta] = useState<string | null>(null)
  const [devolucionDialogOpen, setDevolucionDialogOpen] = useState(false)

  const tieneLinea = !!venta?.linea_credito_id
  const { data: pagosLinea } = usePagosByLinea(venta?.linea_credito_id ?? "")

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!venta) {
    return <p className="text-muted-foreground">Venta no encontrada</p>
  }

  // Use linea pagos when available, otherwise fall back to venta pagos
  const pagosActivos = tieneLinea && pagosLinea ? pagosLinea : (venta.pagos ?? [])

  const totalAbonado = pagosActivos.reduce(
    (sum, p) => sum + p.monto,
    0
  )
  const saldoRestante = venta.total - (tieneLinea ? 0 : totalAbonado)
  // For linea-based ventas, saldo is tracked at the linea level
  const lineaSaldoPendiente = tieneLinea && venta.lineas_credito
    ? Math.max(0, venta.lineas_credito.saldo_total - venta.lineas_credito.saldo_pagado)
    : saldoRestante
  const esCreditoActivo =
    venta.tipo_venta === "credito" && venta.estado_credito === "activo"
  const esActiva = venta.estado_venta !== "cancelada"
  const diffDias =
    (new Date().getTime() - new Date(venta.fecha).getTime()) /
    (1000 * 60 * 60 * 24)

  function handleRegistrarAbono() {
    if (!vendedor || abonoMonto <= 0) return
    crearAbono.mutate(
      {
        linea_credito_id: venta!.linea_credito_id ?? venta!.id,
        venta_id: venta!.id,
        monto: abonoMonto,
        tipo_pago: abonoTipo,
        cuenta_bancaria_id: abonoCuenta,
        vendedor_id: vendedor.id,
        cliente_id: venta!.cliente_id,
      },
      {
        onSuccess: () => {
          setShowAbonoForm(false)
          setAbonoMonto(0)
          setAbonoTipo("efectivo")
          setAbonoCuenta(null)
        },
      }
    )
  }

  function buildTablaPagosElement() {
    const linea = venta!.lineas_credito
    if (linea) {
      const saldoPendiente = linea.saldo_total - linea.saldo_pagado
      return (
        <TablaPagosPDF
          folio={venta!.folio}
          clienteNombre={venta!.clientes?.nombre ?? ""}
          total={venta!.total}
          primerAbono={0}
          saldoProyectado={saldoPendiente}
          meses={linea.meses_credito}
          periodicidad={linea.periodicidad}
          fechaPrimerPago={linea.fecha_siguiente_pago ?? venta!.fecha_primer_pago ?? ""}
          pagosRealizados={(pagosLinea ?? []).map((p) => ({
            monto: p.monto,
            fecha: p.fecha,
          }))}
        />
      )
    }
    return (
      <TablaPagosPDF
        folio={venta!.folio}
        clienteNombre={venta!.clientes?.nombre ?? ""}
        total={venta!.total}
        primerAbono={0}
        meses={venta!.meses_credito ?? 2}
        periodicidad={venta!.periodicidad ?? "quincenal"}
        fechaPrimerPago={venta!.fecha_primer_pago ?? ""}
        pagosRealizados={(venta!.pagos ?? []).map((p) => ({
          monto: p.monto,
          fecha: p.fecha,
        }))}
      />
    )
  }

  async function handleShareTablaPagos() {
    const blob = await pdf(buildTablaPagosElement()).toBlob()
    await sharePDF(
      blob,
      `tabla-pagos-${venta!.folio}.pdf`,
      `Tabla de pagos ${venta!.folio}`
    )
  }

  async function handleDownloadTablaPagos() {
    const blob = await pdf(buildTablaPagosElement()).toBlob()
    await downloadPDF(blob, `tabla-pagos-${venta!.folio}.pdf`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/ventas">← Ventas</Link>
          </Button>
          <h1 className="text-2xl font-bold">{venta.folio}</h1>
          <Badge
            variant={venta.tipo_venta === "contado" ? "default" : "secondary"}
          >
            {venta.tipo_venta === "contado" ? "Contado" : "Crédito"}
          </Badge>
          {venta.tipo_venta === "credito" && (
            <Badge
              variant={
                venta.estado_credito === "liquidado" ? "default" : "outline"
              }
            >
              {venta.estado_credito === "liquidado" ? "Pagado" : "Activo"}
            </Badge>
          )}
          {!esActiva && (
            <Badge variant="destructive">Cancelada</Badge>
          )}
        </div>
        {esActiva && vendedor && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDevolucionDialogOpen(true)}
              disabled={diffDias > 7}
              title={diffDias > 7 ? "Fuera del plazo de 7 días" : undefined}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Devolución / Cambio
            </Button>
          </div>
        )}
      </div>

      {!esActiva && venta.motivo_cancelacion && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          <strong>Motivo de cancelación:</strong> {venta.motivo_cancelacion}
        </div>
      )}

      {tieneLinea && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 p-3 text-sm text-blue-800 dark:text-blue-300 flex items-center justify-between gap-3 flex-wrap">
          <span>
            Esta venta pertenece a la línea de crédito del cliente. Saldo pendiente:{" "}
            <span className="font-bold font-mono">{formatMoney(lineaSaldoPendiente)}</span>
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clientes/${venta.cliente_id}/credito/${venta.linea_credito_id}`}>
              Ver crédito
            </Link>
          </Button>
        </div>
      )}

      {esActiva && vendedor && devolucionDialogOpen && (
        <DevolucionUnificadaDialog
          venta={venta}
          vendedorId={vendedor.id}
          open={devolucionDialogOpen}
          onOpenChange={setDevolucionDialogOpen}
          cantidadesDevueltas={devueltoPorProducto}
        />
      )}

      <Tabs defaultValue="detalle">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="detalle" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información de la venta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <DetailRow label="Cliente" value={venta.clientes?.nombre} />
                <DetailRow label="Vendedor" value={venta.vendedores?.nombre} />
                <DetailRow
                  label="Fecha"
                  value={formatDate(venta.fecha)}
                />
                <DetailRow label="Total" value={formatMoney(venta.total)} />
                {venta.tipo_venta === "credito" && (
                  <>
                    <DetailRow
                      label="Plazo"
                      value={`${venta.meses_credito ?? 2} ${(venta.meses_credito ?? 2) === 1 ? "mes" : "meses"}`}
                    />
                    <DetailRow
                      label="Periodicidad"
                      value={
                        venta.periodicidad === "semanal"
                          ? "Semanal"
                          : venta.periodicidad === "quincenal"
                            ? "Quincenal"
                            : "Mensual"
                      }
                    />
                    <DetailRow
                      label="Primer pago"
                      value={
                        venta.fecha_primer_pago
                          ? formatDate(venta.fecha_primer_pago)
                          : null
                      }
                    />
                    <DetailRow
                      label="Entrega"
                      value={
                        venta.entrega_despues_pago
                          ? "Al liquidar"
                          : "Inmediata"
                      }
                    />
                  </>
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
                {(venta.ventas_detalle ?? []).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">Sin productos</p>
                )}
                {(venta.ventas_detalle ?? []).map((d) => {
                  const cantDevuelta = devueltoPorProducto[d.producto_id] ?? 0
                  const totalmenteDevuelto = cantDevuelta >= d.cantidad
                  return (
                  <div key={d.id} className={`rounded-lg border p-3${totalmenteDevuelto ? " opacity-50" : ""}`}>
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm font-medium${totalmenteDevuelto ? " line-through" : ""}`}>{d.productos?.nombre ?? "—"}</p>
                      <div className="flex items-center gap-1">
                        {cantDevuelta > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-300 text-orange-600 bg-orange-50">
                            Devuelto{cantDevuelta < d.cantidad ? ` (${cantDevuelta})` : ""}
                          </Badge>
                        )}
                        {d.productos?.estado_producto && d.productos.estado_producto !== "nuevo" && (() => {
                          const precioRef = venta.tipo_venta === "contado" ? d.productos.precio_venta_contado : d.productos.precio_venta_credito
                          const pct = precioRef && precioRef > 0 ? Math.round((d.precio_unitario / precioRef) * 100) : null
                          const label = d.productos.estado_producto === "parcial" ? "Parcial" : "Segunda"
                          return (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              {label}{pct !== null && pct < 100 ? ` ${pct}%` : ""}
                            </Badge>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span>Cant: {d.cantidad}</span>
                      <span>{formatMoney(d.precio_unitario)}</span>
                      <span className="font-bold font-mono tabular-nums">{formatMoney(d.subtotal)}</span>
                    </div>
                  </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(venta.ventas_detalle ?? []).map((d) => {
                      const cantDevuelta = devueltoPorProducto[d.producto_id] ?? 0
                      const totalmenteDevuelto = cantDevuelta >= d.cantidad
                      return (
                      <TableRow key={d.id} className={totalmenteDevuelto ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <p className={`font-medium${totalmenteDevuelto ? " line-through" : ""}`}>
                              {d.productos?.nombre ?? "—"}
                            </p>
                            {cantDevuelta > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-300 text-orange-600 bg-orange-50">
                                Devuelto{cantDevuelta < d.cantidad ? ` (${cantDevuelta})` : ""}
                              </Badge>
                            )}
                            {d.productos?.estado_producto && d.productos.estado_producto !== "nuevo" && (() => {
                              const precioRef = venta.tipo_venta === "contado" ? d.productos.precio_venta_contado : d.productos.precio_venta_credito
                              const pct = precioRef && precioRef > 0 ? Math.round((d.precio_unitario / precioRef) * 100) : null
                              const label = d.productos.estado_producto === "parcial" ? "Parcial" : "Segunda"
                              return (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  {label}{pct !== null && pct < 100 ? ` ${pct}%` : ""}
                                </Badge>
                              )
                            })()}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {d.productos?.sku}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(d.precio_unitario)}
                        </TableCell>
                        <TableCell className="text-right">
                          {d.cantidad}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(d.subtotal)}
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos" className="mt-4 space-y-4">
          {tieneLinea ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <p className="text-muted-foreground">
                  Los pagos de esta venta se gestionan desde la línea de crédito del cliente.
                </p>
                <Button asChild>
                  <Link href={`/clientes/${venta.cliente_id}/credito/${venta.linea_credito_id}`}>
                    Ver crédito del cliente
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
          {venta.tipo_venta === "credito" && (
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">
                      {formatMoney(venta.total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Abonado</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatMoney(totalAbonado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pendiente</p>
                    <p className="text-xl font-bold text-orange-600">
                      {formatMoney(lineaSaldoPendiente)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {venta.tipo_venta === "credito" && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleShareTablaPagos}
              >
                <Share2 className="h-4 w-4" />
                Compartir tabla de pagos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDownloadTablaPagos}
              >
                <Download className="h-4 w-4" />
                Descargar tabla de pagos
              </Button>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historial de pagos</CardTitle>
              {esCreditoActivo && (
                <Button
                  size="sm"
                  onClick={() => setShowAbonoForm(!showAbonoForm)}
                >
                  Registrar abono
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {showAbonoForm && (
                <div className="space-y-4 rounded-lg border p-4">
                  <PagoForm
                    monto={abonoMonto}
                    tipoPago={abonoTipo}
                    cuentaBancariaId={abonoCuenta}
                    onMontoChange={setAbonoMonto}
                    onTipoPagoChange={setAbonoTipo}
                    onCuentaChange={setAbonoCuenta}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAbonoForm(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleRegistrarAbono}
                      disabled={crearAbono.isPending || abonoMonto <= 0}
                    >
                      {crearAbono.isPending ? "Registrando..." : "Registrar"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {pagosActivos.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">Sin pagos registrados</p>
                )}
                {(() => {
                  let saldoAcumulado = venta.total
                  return pagosActivos.map((p) => {
                    saldoAcumulado -= p.monto
                    const saldoAnterior = saldoAcumulado + p.monto
                    return (
                      <div key={p.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <Badge variant={p.tipo_pago === "devolucion" ? "secondary" : "outline"}>
                            {p.tipo_pago === "efectivo"
                              ? "Efectivo"
                              : p.tipo_pago === "transferencia"
                                ? "Transferencia"
                                : p.tipo_pago === "devolucion"
                                  ? "Devolución"
                                  : "Retiro s/tarjeta"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(p.fecha)}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-3 mt-1">
                          <span className="text-lg font-bold font-mono">{formatMoney(p.monto)}</span>
                          <span className="text-xs text-muted-foreground">Saldo: {formatMoney(saldoAcumulado)}</span>
                        </div>
                        {(p.vendedores?.nombre || (p.tipo_pago === "transferencia" && p.cat_cuenta_bancaria)) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {p.vendedores?.nombre}
                            {p.vendedores?.nombre && p.tipo_pago === "transferencia" && p.cat_cuenta_bancaria ? " · " : ""}
                            {p.tipo_pago === "transferencia" && p.cat_cuenta_bancaria
                              ? `${p.cat_cuenta_bancaria.alias} — ${p.cat_cuenta_bancaria.clabe}`
                              : ""}
                          </p>
                        )}
                        <div className="flex justify-end mt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              try {
                                const blob = await pdf(
                                  <AbonoTicketPDF
                                    folio={venta.folio}
                                    clienteNombre={venta.clientes?.nombre ?? ""}
                                    fecha={p.fecha}
                                    monto={p.monto}
                                    tipoPago={p.tipo_pago}
                                    totalCredito={venta.total}
                                    totalAbonado={venta.total - saldoAcumulado}
                                    saldoRestante={saldoAcumulado}
                                    saldoAnterior={saldoAnterior}
                                    vendedorNombre={p.vendedores?.nombre ?? ""}
                                    fechaVenta={venta.fecha}
                                  />
                                ).toBlob()
                                await downloadPDF(blob, `abono-${venta.folio}-${p.fecha.split("T")[0]}.pdf`)
                              } catch {
                                // PDF generation failed silently
                              }
                            }}
                            title="Imprimir comprobante"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Tipo de pago</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead className="text-right">Saldo restante</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosActivos.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground"
                        >
                          Sin pagos registrados
                        </TableCell>
                      </TableRow>
                    )}
                    {(() => {
                      let saldoAcumulado = venta.total
                      return pagosActivos.map((p) => {
                        saldoAcumulado -= p.monto
                        const saldoAnterior = saldoAcumulado + p.monto
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              {formatDate(p.fecha)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatMoney(p.monto)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={p.tipo_pago === "devolucion" ? "secondary" : "outline"}>
                                {p.tipo_pago === "efectivo"
                                  ? "Efectivo"
                                  : p.tipo_pago === "transferencia"
                                    ? "Transferencia"
                                    : p.tipo_pago === "devolucion"
                                      ? "Devolución"
                                      : "Retiro s/tarjeta"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {p.vendedores?.nombre ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {p.tipo_pago === "transferencia" && p.cat_cuenta_bancaria
                                ? `${p.cat_cuenta_bancaria.alias} — ${p.cat_cuenta_bancaria.clabe}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatMoney(saldoAcumulado)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  try {
                                    const blob = await pdf(
                                      <AbonoTicketPDF
                                        folio={venta.folio}
                                        clienteNombre={venta.clientes?.nombre ?? ""}
                                        fecha={p.fecha}
                                        monto={p.monto}
                                        tipoPago={p.tipo_pago}
                                        totalCredito={venta.total}
                                        totalAbonado={venta.total - saldoAcumulado}
                                        saldoRestante={saldoAcumulado}
                                        saldoAnterior={saldoAnterior}
                                        vendedorNombre={p.vendedores?.nombre ?? ""}
                                        fechaVenta={venta.fecha}
                                      />
                                    ).toBlob()
                                    await downloadPDF(blob, `abono-${venta.folio}-${p.fecha.split("T")[0]}.pdf`)
                                  } catch {
                                    // PDF generation failed silently
                                  }
                                }}
                                title="Imprimir comprobante"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
            </>
          )}
        </TabsContent>
        <TabsContent value="historial" className="mt-4">
          <VentaHistorialTab ventaId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
