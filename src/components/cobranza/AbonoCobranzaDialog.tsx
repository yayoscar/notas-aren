"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PagoForm } from "@/components/ventas/PagoForm"
import { AbonoTicketPDF } from "@/components/ventas/AbonoTicketPDF"
import { useCrearAbono } from "@/hooks/usePagos"
import { useAjustarPlanPagos } from "@/hooks/useLineaCredito"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { formatMoney, localToday, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { pdf } from "@react-pdf/renderer"
import { downloadPDF } from "@/lib/pdf-utils"
import { ArrowLeft } from "lucide-react"
import type { CreditoCobranza } from "@/hooks/useCobranza"

interface Props {
  credito: CreditoCobranza | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Paso = "form" | "ajuste"
type OpcionAjuste = "reducir_periodos" | "reducir_cuotas" | "adelanto"

export function AbonoCobranzaDialog({ credito, open, onOpenChange }: Props) {
  const { vendedor } = useVendedorActual()
  const crearAbono = useCrearAbono()
  const ajustarPlan = useAjustarPlanPagos()

  const [monto, setMonto] = useState(0)
  const [tipoPago, setTipoPago] = useState("efectivo")
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(localToday())
  const [paso, setPaso] = useState<Paso>("form")
  const [opcionAjuste, setOpcionAjuste] = useState<OpcionAjuste>("reducir_periodos")

  // Calculate cuota
  const cuota = useMemo(() => {
    if (!credito) return 0
    if (credito.cuota_programada > 0) return credito.cuota_programada
    const factor = credito.periodicidad === "semanal" ? 4 : credito.periodicidad === "quincenal" ? 2 : 1
    const periodos = Math.max(1, credito.meses_credito * factor)
    return Math.ceil((credito.saldo_restante / periodos) * 100) / 100
  }, [credito])

  // Initialize monto with cuota when credito changes
  useEffect(() => {
    if (credito && open) {
      setMonto(cuota)
      setPaso("form")
      setOpcionAjuste("reducir_periodos")
      setTipoPago("efectivo")
      setCuentaId(null)
      setFecha(localToday())
    }
  }, [credito, open, cuota])

  // Calculate adjustment previews
  const ajustePreview = useMemo(() => {
    if (!credito || monto <= cuota) return null
    const nuevoSaldo = credito.saldo_restante - monto
    if (nuevoSaldo <= 0) return null

    const factor = credito.periodicidad === "semanal" ? 4 : credito.periodicidad === "quincenal" ? 2 : 1
    const periodosActuales = credito.meses_credito * factor

    // Option A: Reduce periods
    const nuevosPeriodosA = Math.max(1, Math.ceil(nuevoSaldo / cuota))
    const nuevaCuotaA = Math.ceil((nuevoSaldo / nuevosPeriodosA) * 100) / 100
    const nuevosMesesA = Math.max(1, Math.ceil(nuevosPeriodosA / factor))

    // Option B: Maintain periods, reduce cuota
    const nuevaCuotaB = Math.ceil((nuevoSaldo / periodosActuales) * 100) / 100

    return {
      nuevoSaldo,
      opcionA: { periodos: nuevosPeriodosA, cuota: nuevaCuotaA, meses: nuevosMesesA },
      opcionB: { periodos: periodosActuales, cuota: nuevaCuotaB, meses: credito.meses_credito },
    }
  }, [credito, monto, cuota])

  function resetForm() {
    setMonto(0)
    setTipoPago("efectivo")
    setCuentaId(null)
    setFecha(localToday())
    setPaso("form")
    setOpcionAjuste("reducir_periodos")
  }

  // Detect if the current period is already paid
  const periodoYaCubierto = credito?.estado_periodo === "al_dia"

  function handleClickRegistrar() {
    if (!credito || !vendedor || monto <= 0) return

    if (monto > credito.saldo_restante) {
      toast.error("El monto no puede ser mayor al saldo restante")
      return
    }

    // If period already covered, this is an advance payment — always show options
    if (periodoYaCubierto && monto < credito.saldo_restante) {
      setOpcionAjuste("adelanto")
      setPaso("ajuste")
      return
    }

    // Period not covered: check if monto exceeds cuota
    if (monto > cuota && monto < credito.saldo_restante) {
      setPaso("ajuste")
      return
    }

    // Normal flow: monto <= cuota OR covers full balance
    ejecutarAbono()
  }

  function ejecutarAbono() {
    if (!credito || !vendedor) return

    crearAbono.mutate(
      {
        linea_credito_id: credito.id,
        monto,
        tipo_pago: tipoPago,
        cuenta_bancaria_id: cuentaId,
        vendedor_id: vendedor.id,
        cliente_id: credito.cliente_id,
        fecha,
      },
      {
        onSuccess: async () => {
          // Apply plan adjustment if needed (not for "adelanto")
          // Este paso ajusta plazo o cuota, nunca la fecha: aquí no hay ningún
          // selector de fecha de próximo pago. Se omite a propósito, porque
          // corre DESPUÉS del abono y reenviar la fecha vieja —como se hacía—
          // revertiría el avance del calendario que el abono acaba de aplicar.
          if (paso === "ajuste" && opcionAjuste !== "adelanto" && ajustePreview) {
            const opcion = opcionAjuste === "reducir_periodos" ? ajustePreview.opcionA : ajustePreview.opcionB
            ajustarPlan.mutate({
              linea_credito_id: credito.id,
              meses_credito: opcion.meses,
              periodicidad: credito.periodicidad,
            })
          }

          // Generate PDF
          try {
            const shortId = credito.id.slice(0, 8)
            const blob = await pdf(
              <AbonoTicketPDF
                folio={shortId}
                clienteNombre={credito.clientes?.nombre ?? ""}
                fecha={fecha}
                monto={monto}
                tipoPago={tipoPago}
                totalCredito={credito.saldo_total}
                totalAbonado={credito.saldo_pagado + monto}
                saldoRestante={credito.saldo_restante - monto}
                saldoAnterior={credito.saldo_pagado}
                vendedorNombre={vendedor?.nombre ?? ""}
                fechaVenta={credito.fecha_inicio}
              />
            ).toBlob()
            await downloadPDF(blob, `abono-${shortId}.pdf`)
          } catch {
            // PDF failed silently
          }
          resetForm()
          onOpenChange(false)
        },
      }
    )
  }

  if (!credito) return null

  const periodicidadLabel = credito.periodicidad === "semanal" ? "Semanal" : credito.periodicidad === "quincenal" ? "Quincenal" : "Mensual"

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {paso === "ajuste" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPaso("form")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {paso === "form" ? "Registrar Abono" : "Ajustar Plan de Pagos"}
            <Badge variant="outline">{credito.id.slice(0, 8)}</Badge>
          </DialogTitle>
        </DialogHeader>

        {paso === "form" ? (
          <div className="space-y-4">
            {/* Credit summary */}
            <div className="rounded-lg border p-3">
              <p className="mb-2 font-medium">{credito.clientes?.nombre}</p>
              <div className="grid grid-cols-3 gap-2 text-sm text-center">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{formatMoney(credito.saldo_total)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Abonado</p>
                  <p className="font-medium text-green-600">{formatMoney(credito.saldo_pagado)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Restante</p>
                  <p className="font-bold text-orange-600">{formatMoney(credito.saldo_restante)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mt-2 text-center border-t pt-2">
                <div>
                  <p className="text-muted-foreground">Cuota</p>
                  <p className="font-mono font-bold">{formatMoney(cuota)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sig. pago</p>
                  <p>{credito.fecha_siguiente_pago ? formatDate(credito.fecha_siguiente_pago) : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plazo</p>
                  <p>{credito.meses_credito} {credito.meses_credito === 1 ? "mes" : "meses"} · {periodicidadLabel}</p>
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2 max-w-xs">
              <Label>Fecha del abono</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            {/* Payment form */}
            <PagoForm
              monto={monto}
              tipoPago={tipoPago}
              cuentaBancariaId={cuentaId}
              onMontoChange={setMonto}
              onTipoPagoChange={setTipoPago}
              onCuentaChange={setCuentaId}
            />

            {/* Status indicators */}
            {periodoYaCubierto && monto > 0 && monto < credito.saldo_restante && (
              <p className="text-xs text-green-700 bg-green-50 dark:bg-green-950/30 rounded p-2">
                El periodo actual ya está cubierto. Este abono se considera un adelanto.
              </p>
            )}
            {!periodoYaCubierto && monto > cuota && monto < credito.saldo_restante && (
              <p className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 rounded p-2">
                El monto excede la cuota de {formatMoney(cuota)}. Al confirmar se te pedirá elegir cómo ajustar el plan.
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }}>
                Cancelar
              </Button>
              <Button onClick={handleClickRegistrar} disabled={crearAbono.isPending || monto <= 0}>
                {crearAbono.isPending ? "Registrando..." : "Registrar abono"}
              </Button>
            </div>
          </div>
        ) : (
          /* Adjustment step */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {periodoYaCubierto ? (
                <>El periodo actual ya fue cubierto. El abono de <strong>{formatMoney(monto)}</strong> es un adelanto. Nuevo saldo: <strong>{formatMoney(ajustePreview?.nuevoSaldo ?? (credito.saldo_restante - monto))}</strong>. ¿Cómo deseas proceder?</>
              ) : (
                <>El abono de <strong>{formatMoney(monto)}</strong> excede la cuota de <strong>{formatMoney(cuota)}</strong>. Nuevo saldo: <strong>{formatMoney(ajustePreview?.nuevoSaldo ?? 0)}</strong>. ¿Cómo deseas ajustar el plan?</>
              )}
            </p>

            <div className="space-y-2">
              {/* Option A */}
              {ajustePreview && (
                <Card
                  className={`cursor-pointer transition-colors ${opcionAjuste === "reducir_periodos" ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/30"}`}
                  onClick={() => setOpcionAjuste("reducir_periodos")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Reducir periodos</p>
                      {opcionAjuste === "reducir_periodos" && <Badge variant="default">Seleccionado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quedan <strong>{ajustePreview.opcionA.periodos} pagos</strong> de <strong>{formatMoney(ajustePreview.opcionA.cuota)}</strong> ({ajustePreview.opcionA.meses} {ajustePreview.opcionA.meses === 1 ? "mes" : "meses"})
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Option B */}
              {ajustePreview && (
                <Card
                  className={`cursor-pointer transition-colors ${opcionAjuste === "reducir_cuotas" ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/30"}`}
                  onClick={() => setOpcionAjuste("reducir_cuotas")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Mantener periodos, reducir cuotas</p>
                      {opcionAjuste === "reducir_cuotas" && <Badge variant="default">Seleccionado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quedan <strong>{ajustePreview.opcionB.periodos} pagos</strong> de <strong>{formatMoney(ajustePreview.opcionB.cuota)}</strong> ({ajustePreview.opcionB.meses} {ajustePreview.opcionB.meses === 1 ? "mes" : "meses"})
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Option C: Adelanto */}
              <Card
                className={`cursor-pointer transition-colors ${opcionAjuste === "adelanto" ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/30"}`}
                onClick={() => setOpcionAjuste("adelanto")}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Tomar como adelanto</p>
                    {opcionAjuste === "adelanto" && <Badge variant="default">Seleccionado</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se registra el abono sin modificar el plan. La próxima cuota se calculará sobre el nuevo saldo de <strong>{formatMoney(credito.saldo_restante - monto)}</strong>.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPaso("form")}>
                Volver
              </Button>
              <Button onClick={ejecutarAbono} disabled={crearAbono.isPending || ajustarPlan.isPending}>
                {crearAbono.isPending || ajustarPlan.isPending ? "Procesando..." : "Confirmar y registrar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
