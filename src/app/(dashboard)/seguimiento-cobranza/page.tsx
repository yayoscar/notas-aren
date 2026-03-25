"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { CobranzaTable } from "@/components/cobranza/CobranzaTable"
import { AbonoCobranzaDialog } from "@/components/cobranza/AbonoCobranzaDialog"
import { FechaCobroDialog } from "@/components/cobranza/FechaCobroDialog"
import { CobranzaListaPDF } from "@/components/cobranza/CobranzaListaPDF"
import {
  useCreditosCobranza,
  useAgendaDiaria,
  useMarcarAtendido,
  formatPeriodo,
} from "@/hooks/useCobranza"
import type { Frecuencia, CreditoCobranza } from "@/hooks/useCobranza"
import { formatMoney } from "@/lib/utils"
import { pdf } from "@react-pdf/renderer"
import { downloadPDF } from "@/lib/pdf-utils"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  CalendarDays,
} from "lucide-react"

type Vista = "lista" | "agenda"

export default function SeguimientoCobranzaPage() {
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("quincenal")
  const [vista, setVista] = useState<Vista>("lista")
  const [periodoOffset, setPeriodoOffset] = useState(0)
  const [agendaFecha, setAgendaFecha] = useState(
    new Date().toISOString().split("T")[0]
  )

  // Dialog state
  const [abonoCredito, setAbonoCredito] = useState<CreditoCobranza | null>(
    null
  )
  const [fechaCredito, setFechaCredito] = useState<CreditoCobranza | null>(
    null
  )

  // Queries
  const {
    data: creditosLista,
    isLoading: isLoadingLista,
    periodo,
    periodoInicioStr,
    periodoFinStr,
  } = useCreditosCobranza(frecuencia, periodoOffset)

  const { data: creditosAgenda, isLoading: isLoadingAgenda } =
    useAgendaDiaria(vista === "agenda" ? agendaFecha : "")

  const marcarAtendido = useMarcarAtendido()

  // Derived
  const creditos = vista === "lista" ? creditosLista : creditosAgenda
  const isLoading = vista === "lista" ? isLoadingLista : isLoadingAgenda
  const totalPendiente = (creditos ?? []).reduce(
    (s, c) => s + c.saldo_restante,
    0
  )

  async function handleDescargarPDF() {
    if (!creditos || creditos.length === 0) return
    try {
      const blob = await pdf(
        <CobranzaListaPDF
          creditos={creditos}
          frecuencia={frecuencia}
          periodoInicio={periodoInicioStr}
          periodoFin={periodoFinStr}
          fechaGeneracion={new Date().toLocaleDateString("es-MX")}
        />
      ).toBlob()
      await downloadPDF(
        blob,
        `cobranza-${frecuencia}-${periodoInicioStr}.pdf`
      )
    } catch {
      // PDF generation failed silently
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Seguimiento de Cobranza</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Seguimiento de Cobranza</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDescargarPDF}
          disabled={!creditos || creditos.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Descargar lista
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Vista toggle */}
            <div className="flex rounded-lg border">
              <Button
                variant={vista === "lista" ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setVista("lista")}
              >
                <List className="mr-1 h-4 w-4" />
                Lista
              </Button>
              <Button
                variant={vista === "agenda" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setVista("agenda")}
              >
                <CalendarDays className="mr-1 h-4 w-4" />
                Agenda
              </Button>
            </div>

            {vista === "lista" ? (
              <>
                {/* Frequency selector */}
                <Select
                  value={frecuencia}
                  onValueChange={(v) => {
                    setFrecuencia(v as Frecuencia)
                    setPeriodoOffset(0)
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quincenal">Quincenal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                  </SelectContent>
                </Select>

                {/* Period navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPeriodoOffset((o) => o - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {formatPeriodo(periodo)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPeriodoOffset((o) => o + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {periodoOffset !== 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setPeriodoOffset(0)}
                    >
                      Hoy
                    </Button>
                  )}
                </div>
              </>
            ) : (
              /* Agenda date picker */
              <Input
                type="date"
                value={agendaFecha}
                onChange={(e) => setAgendaFecha(e.target.value)}
                className="w-44"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{creditos?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total por cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {formatMoney(totalPendiente)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <CobranzaTable
            creditos={creditos ?? []}
            onMarcarAtendido={(ventaId, periodoInicio, periodoFin, freq, atendido) =>
              marcarAtendido.mutate({
                venta_id: ventaId,
                periodo_inicio: periodoInicio,
                periodo_fin: periodoFin,
                frecuencia: freq,
                atendido,
              })
            }
            onRegistrarAbono={setAbonoCredito}
            onAsignarFecha={setFechaCredito}
            isUpdating={marcarAtendido.isPending}
          />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AbonoCobranzaDialog
        credito={abonoCredito}
        open={!!abonoCredito}
        onOpenChange={(open) => {
          if (!open) setAbonoCredito(null)
        }}
      />
      <FechaCobroDialog
        credito={fechaCredito}
        open={!!fechaCredito}
        onOpenChange={(open) => {
          if (!open) setFechaCredito(null)
        }}
      />
    </div>
  )
}
