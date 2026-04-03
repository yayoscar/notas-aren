"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCliente } from "@/hooks/useClientes"
import { useVentasDeLinea, usePagosByLinea } from "@/hooks/useLineaCredito"
// useVendedorActual not needed - AbonoCobranzaDialog handles vendedor internally
import { AjustePlanDialog } from "@/components/credito/AjustePlanDialog"
import { AbonoCobranzaDialog } from "@/components/cobranza/AbonoCobranzaDialog"
import { TablaPagosPDF } from "@/components/ventas/TablaPagosPDF"
import { AbonoTicketPDF } from "@/components/ventas/AbonoTicketPDF"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings2, Share2, Download, Printer } from "lucide-react"
import { pdf } from "@react-pdf/renderer"
import { sharePDF, downloadPDF } from "@/lib/pdf-utils"
import { formatMoney, formatDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import type { LineaCredito } from "@/lib/supabase/types"

function useLineaCredito(lineaId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ["linea_credito", lineaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lineas_credito")
        .select("*, vendedores(nombre), clientes(nombre, telefono)")
        .eq("id", lineaId)
        .single()
      if (error) throw error
      return data as LineaCredito & { vendedores: { nombre: string } | null; clientes: { nombre: string; telefono: string } | null }
    },
    enabled: !!lineaId,
  })
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  )
}

export default function CreditoDetallePage() {
  const params = useParams()
  const clienteId = params.id as string
  const lineaId = params.lineaId as string

  const { data: linea, isLoading } = useLineaCredito(lineaId)
  const clienteQuery = useCliente(clienteId)
  const { data: ventas } = useVentasDeLinea(lineaId)
  const { data: pagos } = usePagosByLinea(lineaId)
  const [showAjuste, setShowAjuste] = useState(false)
  const [showAbono, setShowAbono] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!linea) {
    return <p className="text-muted-foreground">Línea de crédito no encontrada</p>
  }

  const saldoPendiente = linea.saldo_total - linea.saldo_pagado
  const totalAbonado = pagos?.reduce((sum, p) => sum + p.monto, 0) ?? 0
  const esActiva = linea.estado === "activa"
  const clienteNombre = clienteQuery.data?.nombre ?? linea.clientes?.nombre ?? ""

  // Build CreditoCobranza for dialog
  const factor = linea.periodicidad === "semanal" ? 4 : linea.periodicidad === "quincenal" ? 2 : 1
  const periodosRestantes = Math.max(1, linea.meses_credito * factor)
  const cuotaCalc = Math.ceil((saldoPendiente / periodosRestantes) * 100) / 100

  const creditoParaDialog = esActiva ? {
    id: linea.id,
    cliente_id: clienteId,
    saldo_total: linea.saldo_total,
    saldo_pagado: linea.saldo_pagado,
    saldo_pendiente: saldoPendiente,
    saldo_restante: saldoPendiente,
    meses_credito: linea.meses_credito,
    periodicidad: linea.periodicidad,
    fecha_inicio: linea.fecha_inicio,
    fecha_siguiente_pago: linea.fecha_siguiente_pago,
    fecha_cobro_especifica: null,
    estado: linea.estado,
    created_at: linea.created_at ?? "",
    clientes: { nombre: clienteNombre, telefono: null, ciudad: null },
    vendedores: null,
    vendedor_id: null,
    atendido: false,
    periodo_inicio: "",
    periodo_fin: "",
    abono_en_periodo: false,
    ultimo_pago_fecha: null,
    ultimo_pago_monto: null,
    cuota_programada: cuotaCalc,
    estado_periodo: "sin_abonos" as const,
  } : null

  function buildTablaPagosElement() {
    if (!linea) return null
    return (
      <TablaPagosPDF
        folio={`LC-${lineaId.slice(0, 8)}`}
        clienteNombre={clienteNombre}
        total={linea.saldo_total}
        primerAbono={0}
        saldoProyectado={saldoPendiente}
        meses={linea.meses_credito}
        periodicidad={linea.periodicidad}
        fechaPrimerPago={linea.fecha_siguiente_pago ?? linea.fecha_inicio}
        pagosRealizados={(pagos ?? []).map((p) => ({ monto: p.monto, fecha: p.fecha }))}
      />
    )
  }

  async function handleSharePDF() {
    const el = buildTablaPagosElement()
    if (!el) return
    const blob = await pdf(el).toBlob()
    await sharePDF(blob, `tabla-pagos-credito-${clienteNombre}.pdf`, `Tabla de pagos — ${clienteNombre}`)
  }

  async function handleDownloadPDF() {
    const el = buildTablaPagosElement()
    if (!el) return
    const blob = await pdf(el).toBlob()
    await downloadPDF(blob, `tabla-pagos-credito-${clienteNombre}.pdf`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/clientes/${clienteId}/creditos`}>&larr; Créditos</Link>
          </Button>
          <h1 className="text-2xl font-bold">Línea de Crédito</h1>
          <Badge variant={esActiva ? "default" : linea.estado === "liquidada" ? "secondary" : "destructive"}>
            {linea.estado === "activa" ? "Activa" : linea.estado === "liquidada" ? "Liquidada" : "Suspendida"}
          </Badge>
        </div>
        {esActiva && (
          <Button variant="outline" size="sm" onClick={() => setShowAjuste(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Ajustar plan
          </Button>
        )}
      </div>

      {/* Info card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{formatMoney(linea.saldo_total)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Abonado</p>
              <p className="text-xl font-bold text-green-600">{formatMoney(totalAbonado)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendiente</p>
              <p className="text-xl font-bold text-orange-600">{formatMoney(saldoPendiente)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <DetailRow label="Plazo" value={`${linea.meses_credito} ${linea.meses_credito === 1 ? "mes" : "meses"}`} />
            <DetailRow label="Periodicidad" value={linea.periodicidad === "semanal" ? "Semanal" : linea.periodicidad === "quincenal" ? "Quincenal" : "Mensual"} />
            <DetailRow label="Fecha inicio" value={formatDate(linea.fecha_inicio)} />
            <DetailRow label="Sig. pago" value={linea.fecha_siguiente_pago ? formatDate(linea.fecha_siguiente_pago) : null} />
          </div>
        </CardContent>
      </Card>

      {/* PDF buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSharePDF}>
          <Share2 className="h-4 w-4" />
          Compartir tabla de pagos
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPDF}>
          <Download className="h-4 w-4" />
          Descargar tabla de pagos
        </Button>
      </div>

      {/* Tabs: Ventas | Pagos */}
      <Tabs defaultValue="pagos">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="ventas">Ventas</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ventas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ventas asociadas</CardTitle>
            </CardHeader>
            <CardContent>
              {!ventas || ventas.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Sin ventas asociadas</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {ventas.map((v) => (
                      <Link key={v.id} href={`/ventas/${v.id}`} className="block">
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono font-medium">{v.folio}</span>
                            <span className="text-sm font-bold font-mono tabular-nums">{formatMoney(v.total)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(v.created_at).toLocaleDateString("es-MX")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Folio</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ventas.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <Link href={`/ventas/${v.id}`} className="font-medium hover:underline">{v.folio}</Link>
                            </TableCell>
                            <TableCell>{new Date(v.created_at).toLocaleDateString("es-MX")}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(v.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos" className="mt-4 space-y-4">
          {esActiva && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowAbono(true)}>
                Registrar abono
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Historial de pagos</CardTitle>
            </CardHeader>
            <CardContent>
              {!pagos || pagos.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Sin pagos registrados</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {(() => {
                      let saldoAcum = linea.saldo_total
                      return pagos.map((p) => {
                        saldoAcum -= p.monto
                        return (
                          <div key={p.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                              <Badge variant={p.tipo_pago === "devolucion" ? "secondary" : "outline"}>
                                {p.tipo_pago === "efectivo" ? "Efectivo" : p.tipo_pago === "transferencia" ? "Transferencia" : p.tipo_pago === "devolucion" ? "Devolución" : "Retiro s/tarjeta"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(p.fecha)}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-3 mt-1">
                              <span className="text-lg font-bold font-mono">{formatMoney(p.monto)}</span>
                              <span className="text-xs text-muted-foreground">Saldo: {formatMoney(saldoAcum)}</span>
                            </div>
                            {p.vendedores?.nombre && (
                              <p className="text-xs text-muted-foreground mt-1">{p.vendedores.nombre}</p>
                            )}
                            <div className="flex justify-end mt-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  try {
                                    const saldoAnterior = saldoAcum + p.monto
                                    const blob = await pdf(
                                      <AbonoTicketPDF
                                        folio={`LC-${lineaId.slice(0, 8)}`}
                                        clienteNombre={clienteNombre}
                                        fecha={p.fecha}
                                        monto={p.monto}
                                        tipoPago={p.tipo_pago}
                                        totalCredito={linea.saldo_total}
                                        totalAbonado={linea.saldo_total - saldoAcum}
                                        saldoRestante={saldoAcum}
                                        saldoAnterior={saldoAnterior}
                                        vendedorNombre={p.vendedores?.nombre ?? ""}
                                        fechaVenta={linea.fecha_inicio}
                                      />
                                    ).toBlob()
                                    await downloadPDF(blob, `abono-credito-${p.fecha.split("T")[0]}.pdf`)
                                  } catch { /* silent */ }
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
                        {(() => {
                          let saldoAcum = linea.saldo_total
                          return pagos.map((p) => {
                            saldoAcum -= p.monto
                            const saldoAnterior = saldoAcum + p.monto
                            return (
                              <TableRow key={p.id}>
                                <TableCell>{formatDate(p.fecha)}</TableCell>
                                <TableCell className="text-right font-medium">{formatMoney(p.monto)}</TableCell>
                                <TableCell>
                                  <Badge variant={p.tipo_pago === "devolucion" ? "secondary" : "outline"}>
                                    {p.tipo_pago === "efectivo" ? "Efectivo" : p.tipo_pago === "transferencia" ? "Transferencia" : p.tipo_pago === "devolucion" ? "Devolución" : "Retiro s/tarjeta"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{p.vendedores?.nombre ?? "—"}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {p.tipo_pago === "transferencia" && p.cat_cuenta_bancaria
                                    ? `${p.cat_cuenta_bancaria.alias} — ${p.cat_cuenta_bancaria.clabe}`
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-right font-medium">{formatMoney(saldoAcum)}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      try {
                                        const blob = await pdf(
                                          <AbonoTicketPDF
                                            folio={`LC-${lineaId.slice(0, 8)}`}
                                            clienteNombre={clienteNombre}
                                            fecha={p.fecha}
                                            monto={p.monto}
                                            tipoPago={p.tipo_pago}
                                            totalCredito={linea.saldo_total}
                                            totalAbonado={linea.saldo_total - saldoAcum}
                                            saldoRestante={saldoAcum}
                                            saldoAnterior={saldoAnterior}
                                            vendedorNombre={p.vendedores?.nombre ?? ""}
                                            fechaVenta={linea.fecha_inicio}
                                          />
                                        ).toBlob()
                                        await downloadPDF(blob, `abono-credito-${p.fecha.split("T")[0]}.pdf`)
                                      } catch { /* silent */ }
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
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {esActiva && (
        <>
          <AjustePlanDialog
            lineaCredito={linea}
            open={showAjuste}
            onOpenChange={setShowAjuste}
          />
          <AbonoCobranzaDialog
            credito={creditoParaDialog}
            open={showAbono}
            onOpenChange={setShowAbono}
          />
        </>
      )}
    </div>
  )
}
