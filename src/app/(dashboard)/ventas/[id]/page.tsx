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
import { pdf } from "@react-pdf/renderer"
import { sharePDF, downloadPDF } from "@/lib/pdf-utils"
import { Share2, Download } from "lucide-react"

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/ventas">← Ventas</Link>
          </Button>
          <h1 className="text-2xl font-bold">{venta.folio}</h1>
        </div>
        <div className="flex gap-2">
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
              {venta.estado_credito === "liquidado" ? "Liquidado" : "Activo"}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
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
                <DetailRow label="Total" value={`$${venta.total.toFixed(2)}`} />
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
                        <p className="font-medium">
                          {d.productos?.nombre ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.productos?.sku}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        ${d.precio_unitario.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.cantidad}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${d.subtotal.toFixed(2)}
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
                      ${venta.total.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Abonado</p>
                    <p className="text-xl font-bold text-green-600">
                      ${totalAbonado.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Restante</p>
                    <p className="text-xl font-bold text-orange-600">
                      ${saldoRestante.toFixed(2)}
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
                    <TableHead>Cuenta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(venta.pagos ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        Sin pagos registrados
                      </TableCell>
                    </TableRow>
                  )}
                  {(venta.pagos ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {new Date(p.fecha).toLocaleDateString("es-MX")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${p.monto.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.tipo_pago === "efectivo"
                            ? "Efectivo"
                            : p.tipo_pago === "transferencia"
                              ? "Transferencia"
                              : "Retiro s/tarjeta"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.tipo_pago === "transferencia" && p.cat_cuenta_bancaria
                          ? `${p.cat_cuenta_bancaria.alias} — ${p.cat_cuenta_bancaria.clabe}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
