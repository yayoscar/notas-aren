"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useVenta } from "@/hooks/useVentas"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { useCrearAbono } from "@/hooks/usePagos"
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
import { formatMoney } from "@/lib/utils"

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

  const [showAbonoForm, setShowAbonoForm] = useState(false)
  const [abonoMonto, setAbonoMonto] = useState(0)
  const [abonoTipo, setAbonoTipo] = useState("efectivo")
  const [abonoCuenta, setAbonoCuenta] = useState<string | null>(null)
  const [devolucionDialogOpen, setDevolucionDialogOpen] = useState(false)

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

  const totalAbonado = (venta.pagos ?? []).reduce(
    (sum, p) => sum + p.monto,
    0
  )
  const saldoRestante = venta.total - totalAbonado
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
          <div className="flex gap-2">
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

      {esActiva && vendedor && (
        <DevolucionUnificadaDialog
          venta={venta}
          vendedorId={vendedor.id}
          open={devolucionDialogOpen}
          onOpenChange={setDevolucionDialogOpen}
        />
      )}

      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

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
                  value={new Date(venta.fecha).toLocaleDateString("es-MX")}
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
                          ? new Date(
                              venta.fecha_primer_pago
                            ).toLocaleDateString("es-MX")
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
                  {(venta.ventas_detalle ?? []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium">
                            {d.productos?.nombre ?? "—"}
                          </p>
                          {d.productos?.estado_producto && d.productos.estado_producto !== "nuevo" && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              {d.productos.estado_producto === "tester" ? "Tester" : "Parcial"}
                            </Badge>
                          )}
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos" className="mt-4 space-y-4">
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
                    <p className="text-sm text-muted-foreground">Restante</p>
                    <p className="text-xl font-bold text-orange-600">
                      {formatMoney(saldoRestante)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {venta.tipo_venta === "credito" && (
            <div className="flex gap-2">
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
                  {(venta.pagos ?? []).length === 0 && (
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
                    return (venta.pagos ?? []).map((p) => {
                      saldoAcumulado -= p.monto
                      const saldoAnterior = saldoAcumulado + p.monto
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            {new Date(p.fecha).toLocaleDateString("es-MX")}
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
                                  await downloadPDF(blob, `abono-${venta.folio}-${new Date(p.fecha).toISOString().split("T")[0]}.pdf`)
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
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="historial" className="mt-4">
          <VentaHistorialTab ventaId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
