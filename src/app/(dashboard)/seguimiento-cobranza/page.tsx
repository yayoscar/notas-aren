"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AbonoCobranzaDialog } from "@/components/cobranza/AbonoCobranzaDialog"
import { CobranzaListaPDF } from "@/components/cobranza/CobranzaListaPDF"
import {
  useCreditosCobranzaV2,
  calcularRangoPredefinido,
  formatRango,
} from "@/hooks/useCobranza"
import type { CreditoCobranza, RangoTipo } from "@/hooks/useCobranza"
import { useVendedores } from "@/hooks/useVendedores"
import { useConfigValue } from "@/hooks/useConfiguracion"
import { formatMoney, cn, limpiarTelefono } from "@/lib/utils"
import { pdf } from "@react-pdf/renderer"
import { downloadPDF, sharePDF } from "@/lib/pdf-utils"
import { Download, Share2, Wallet, MessageCircle } from "lucide-react"

function fmtFecha(f: string | null): string {
  if (!f) return "—"
  try {
    const d = new Date(f.length === 10 ? f + "T12:00:00" : f)
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX")
  } catch { return "—" }
}

function estadoBadge(estado: "al_dia" | "atrasado" | "sin_abonos") {
  if (estado === "al_dia") return <Badge variant="default" className="bg-green-600">Al día</Badge>
  if (estado === "atrasado") return <Badge variant="destructive">Atrasado</Badge>
  return <Badge variant="secondary">Sin abonos</Badge>
}

export default function SeguimientoCobranzaPage() {
  const [rangoTipo, setRangoTipo] = useState<RangoTipo>("quincena")
  const [customInicio, setCustomInicio] = useState("")
  const [customFin, setCustomFin] = useState("")
  const [vendedorFilter, setVendedorFilter] = useState("todos")
  const [abonoCredito, setAbonoCredito] = useState<CreditoCobranza | null>(null)
  const [estadoFilter, setEstadoFilter] = useState<"al_dia" | "pendientes" | null>(null)

  const rangoPredefinido = calcularRangoPredefinido(rangoTipo)
  const fechaInicio = rangoTipo === "personalizado" ? customInicio : rangoPredefinido.inicio
  const fechaFin = rangoTipo === "personalizado" ? customFin : rangoPredefinido.fin

  const { data: creditos, isLoading } = useCreditosCobranzaV2(fechaInicio, fechaFin)
  const { query: vendedoresQuery } = useVendedores()
  const { data: mensajeTemplate } = useConfigValue("recordatorio_whatsapp")

  const vendedores = vendedoresQuery.data?.filter((v) => v.activo) ?? []

  const filtered = useMemo(() => {
    if (!creditos) return []
    let list = creditos
    if (vendedorFilter !== "todos") {
      list = list.filter((c) => c.vendedor_id === vendedorFilter)
    }
    if (estadoFilter === "al_dia") {
      list = list.filter((c) => c.estado_periodo === "al_dia")
    } else if (estadoFilter === "pendientes") {
      list = list.filter((c) => c.estado_periodo !== "al_dia")
    }
    return list
  }, [creditos, vendedorFilter, estadoFilter])

  // Counts use vendedor-filtered data (before estado filter) so cards always show totals
  const vendedorFiltered = useMemo(() => {
    if (!creditos) return []
    if (vendedorFilter === "todos") return creditos
    return creditos.filter((c) => c.vendedor_id === vendedorFilter)
  }, [creditos, vendedorFilter])

  const totalPendiente = vendedorFiltered.reduce((s, c) => s + c.saldo_pendiente, 0)
  const alDiaCount = vendedorFiltered.filter((c) => c.estado_periodo === "al_dia").length
  const pendienteCount = vendedorFiltered.filter((c) => c.estado_periodo !== "al_dia").length

  function buildWhatsAppUrl(c: CreditoCobranza): string {
    const tel = limpiarTelefono(c.clientes?.telefono ?? null)
    if (!tel) return "#"
    let msg = mensajeTemplate ?? "Hola {nombre}, te recordamos que tienes un pago pendiente de {monto}. Tu saldo actual es de {saldo}."
    msg = msg
      .replace(/\{nombre\}/g, c.clientes?.nombre ?? "")
      .replace(/\{monto\}/g, formatMoney(c.cuota_programada))
      .replace(/\{fecha_pago\}/g, fmtFecha(c.fecha_siguiente_pago))
      .replace(/\{saldo\}/g, formatMoney(c.saldo_pendiente))
    return `https://wa.me/52${tel}?text=${encodeURIComponent(msg)}`
  }

  async function handleDescargarPDF() {
    if (filtered.length === 0) return
    try {
      const blob = await pdf(
        <CobranzaListaPDF
          creditos={filtered}
          frecuencia={rangoTipo}
          periodoInicio={fechaInicio}
          periodoFin={fechaFin}
          fechaGeneracion={new Date().toLocaleDateString("es-MX")}
        />
      ).toBlob()
      await downloadPDF(blob, `cobranza-${fechaInicio}-${fechaFin}.pdf`)
    } catch { /* silent */ }
  }

  async function handleCompartirPDF() {
    if (filtered.length === 0) return
    try {
      const blob = await pdf(
        <CobranzaListaPDF
          creditos={filtered}
          frecuencia={rangoTipo}
          periodoInicio={fechaInicio}
          periodoFin={fechaFin}
          fechaGeneracion={new Date().toLocaleDateString("es-MX")}
        />
      ).toBlob()
      await sharePDF(blob, `cobranza-${fechaInicio}-${fechaFin}.pdf`, "Lista de cobranza")
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cobranza</h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Periodo</label>
              <Select value={rangoTipo} onValueChange={(v) => setRangoTipo(v as RangoTipo)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana actual</SelectItem>
                  <SelectItem value="quincena">Quincena actual</SelectItem>
                  <SelectItem value="mes">Mes actual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rangoTipo === "personalizado" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Desde</label>
                  <Input type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)} className="w-[160px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hasta</label>
                  <Input type="date" value={customFin} onChange={(e) => setCustomFin(e.target.value)} className="w-[160px]" />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vendedor</label>
              <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" size="sm" onClick={handleCompartirPDF} disabled={filtered.length === 0}>
                <Share2 className="mr-2 h-4 w-4" />
                Compartir
              </Button>
              <Button variant="outline" size="sm" onClick={handleDescargarPDF} disabled={filtered.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
          </div>

          {rangoTipo !== "personalizado" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {formatRango(fechaInicio, fechaFin)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary — Al día / Pendientes cards are clickable filters */}
      <div className="grid grid-cols-3 gap-3">
        <Card onClick={() => setEstadoFilter(null)} className={cn("cursor-pointer transition-all", estadoFilter === null && "ring-2 ring-orange-600 bg-orange-50")}>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">Total pendiente</p>
            <p className="text-lg font-bold text-orange-600">{formatMoney(totalPendiente)}</p>
          </CardContent>
        </Card>
        <Card onClick={() => setEstadoFilter((prev) => prev === "al_dia" ? null : "al_dia")} className={cn("cursor-pointer transition-all", estadoFilter === "al_dia" && "ring-2 ring-green-600 bg-green-50")}>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">Al día</p>
            <p className="text-lg font-bold text-green-600">{alDiaCount}</p>
          </CardContent>
        </Card>
        <Card onClick={() => setEstadoFilter((prev) => prev === "pendientes" ? null : "pendientes")} className={cn("cursor-pointer transition-all", estadoFilter === "pendientes" && "ring-2 ring-red-600 bg-red-50")}>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="text-lg font-bold text-red-600">{pendienteCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay créditos pendientes para este periodo
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/clientes/${c.cliente_id}/credito/${c.id}`} className="text-sm font-medium truncate hover:underline">
                    {c.clientes?.nombre ?? "—"}
                  </Link>
                  {estadoBadge(c.estado_periodo)}
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Pendiente: </span>
                    <span className="font-mono font-bold text-orange-600">{formatMoney(c.saldo_pendiente)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cuota: </span>
                    <span className="font-mono font-medium">{formatMoney(c.cuota_programada)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sig. pago: </span>
                    <span>{fmtFecha(c.fecha_siguiente_pago)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Último: </span>
                    <span>{c.ultimo_pago_fecha ? `${fmtFecha(c.ultimo_pago_fecha)} (${formatMoney(c.ultimo_pago_monto ?? 0)})` : "—"}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{c.clientes?.telefono ?? "—"}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" className="h-8" onClick={() => setAbonoCredito(c)}>
                      <Wallet className="mr-1 h-3.5 w-3.5" />
                      Abonar
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" asChild>
                      <a href={buildWhatsAppUrl(c)} target="_blank" rel="noopener noreferrer" title="Enviar recordatorio por WhatsApp">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead className="text-right">Cuota</TableHead>
                      <TableHead>Sig. pago</TableHead>
                      <TableHead>Último abono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link href={`/clientes/${c.cliente_id}/credito/${c.id}`} className="font-medium hover:underline">
                            {c.clientes?.nombre ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.clientes?.telefono ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-orange-600">{formatMoney(c.saldo_pendiente)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(c.cuota_programada)}</TableCell>
                        <TableCell>{fmtFecha(c.fecha_siguiente_pago)}</TableCell>
                        <TableCell>
                          {c.ultimo_pago_fecha ? (
                            <span className="text-xs">
                              {fmtFecha(c.ultimo_pago_fecha)}{" "}
                              <span className="font-mono text-green-600">({formatMoney(c.ultimo_pago_monto ?? 0)})</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{estadoBadge(c.estado_periodo)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="default" className="h-8" onClick={() => setAbonoCredito(c)}>
                              <Wallet className="mr-1 h-3.5 w-3.5" />
                              Abonar
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" asChild>
                              <a href={buildWhatsAppUrl(c)} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Abono dialog */}
      <AbonoCobranzaDialog
        credito={abonoCredito}
        open={!!abonoCredito}
        onOpenChange={(open) => { if (!open) setAbonoCredito(null) }}
      />
    </div>
  )
}
