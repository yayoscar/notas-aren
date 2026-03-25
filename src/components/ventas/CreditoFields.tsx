"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PagoForm } from "./PagoForm"
import { HistorialCrediticioDialog } from "./HistorialCrediticioDialog"
import { History, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { formatMoney } from "@/lib/utils"

interface Props {
  clienteId: string | null
  mesesCredito: number
  periodicidad: string
  fechaPrimerPago: string
  entregaDespuesPago: boolean
  primerAbono: {
    monto: number
    tipo_pago: string
    cuenta_bancaria_id: string | null
  } | null
  deudaAcumulada: number
  onMesesCreditoChange: (v: number) => void
  onPeriodicidadChange: (v: string) => void
  onFechaPrimerPagoChange: (v: string) => void
  onEntregaDespuesPagoChange: (v: boolean) => void
  onPrimerAbonoChange: (
    abono: {
      monto: number
      tipo_pago: string
      cuenta_bancaria_id: string | null
    } | null
  ) => void
  errors?: Record<string, string | undefined>
}

export function CreditoFields({
  clienteId,
  mesesCredito,
  periodicidad,
  fechaPrimerPago,
  entregaDespuesPago,
  primerAbono,
  deudaAcumulada,
  onMesesCreditoChange,
  onPeriodicidadChange,
  onFechaPrimerPagoChange,
  onEntregaDespuesPagoChange,
  onPrimerAbonoChange,
  errors,
}: Props) {
  const [showHistorial, setShowHistorial] = useState(false)
  const [showPrimerAbono, setShowPrimerAbono] = useState(!!primerAbono)

  return (
    <div className="space-y-4">
      {deudaAcumulada >= 10000 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            El cliente ha rebasado su límite de crédito ({formatMoney(deudaAcumulada)} de $10,000.00)
          </span>
        </div>
      )}
      {deudaAcumulada >= 8000 && deudaAcumulada < 10000 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            El cliente está cerca del límite de crédito ({formatMoney(deudaAcumulada)} de $10,000.00)
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Plazo del crédito *</Label>
          <Select
            value={String(mesesCredito)}
            onValueChange={(v) => onMesesCreditoChange(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 mes</SelectItem>
              <SelectItem value="2">2 meses</SelectItem>
              <SelectItem value="3">3 meses</SelectItem>
            </SelectContent>
          </Select>
          {errors?.meses_credito && (
            <p className="text-sm text-destructive">{errors.meses_credito}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Periodicidad de pagos *</Label>
          <Select value={periodicidad} onValueChange={onPeriodicidadChange}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="quincenal">Quincenal</SelectItem>
              <SelectItem value="mensual">Mensual</SelectItem>
            </SelectContent>
          </Select>
          {errors?.periodicidad && (
            <p className="text-sm text-destructive">{errors.periodicidad}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Fecha del primer pago *</Label>
          <Input
            type="date"
            value={fechaPrimerPago}
            onChange={(e) => onFechaPrimerPagoChange(e.target.value)}
          />
          {errors?.fecha_primer_pago && (
            <p className="text-sm text-destructive">
              {errors.fecha_primer_pago}
            </p>
          )}
        </div>

        <div className="space-y-2 flex flex-col justify-end">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="entrega_despues"
              checked={entregaDespuesPago}
              onCheckedChange={(checked) =>
                onEntregaDespuesPagoChange(checked === true)
              }
            />
            <Label htmlFor="entrega_despues" className="text-sm">
              Entrega después del pago
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {entregaDespuesPago
              ? "El producto se entregará al liquidar el crédito"
              : "El producto se entrega al momento de la venta"}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {clienteId && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHistorial(true)}
            >
              <History className="mr-2 h-4 w-4" />
              Historial crediticio
            </Button>
            <HistorialCrediticioDialog
              clienteId={clienteId}
              open={showHistorial}
              onOpenChange={setShowHistorial}
            />
          </>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (showPrimerAbono) {
              onPrimerAbonoChange(null)
              setShowPrimerAbono(false)
            } else {
              onPrimerAbonoChange({
                monto: 0,
                tipo_pago: "efectivo",
                cuenta_bancaria_id: null,
              })
              setShowPrimerAbono(true)
            }
          }}
        >
          {showPrimerAbono ? (
            <ChevronUp className="mr-2 h-4 w-4" />
          ) : (
            <ChevronDown className="mr-2 h-4 w-4" />
          )}
          Primer abono
        </Button>
      </div>

      {showPrimerAbono && primerAbono && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Primer abono (opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <PagoForm
              monto={primerAbono.monto}
              tipoPago={primerAbono.tipo_pago}
              cuentaBancariaId={primerAbono.cuenta_bancaria_id}
              onMontoChange={(monto) =>
                onPrimerAbonoChange({ ...primerAbono, monto })
              }
              onTipoPagoChange={(tipo_pago) =>
                onPrimerAbonoChange({ ...primerAbono, tipo_pago })
              }
              onCuentaChange={(cuenta_bancaria_id) =>
                onPrimerAbonoChange({ ...primerAbono, cuenta_bancaria_id })
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
