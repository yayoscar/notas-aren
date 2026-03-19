"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCuentasBancarias } from "@/hooks/useCuentasBancarias"

interface Props {
  monto: number
  tipoPago: string
  cuentaBancariaId: string | null
  montoReadOnly?: boolean
  onMontoChange: (monto: number) => void
  onTipoPagoChange: (tipo: string) => void
  onCuentaChange: (id: string | null) => void
  onCuentaAliasChange?: (alias: string) => void
  errors?: {
    monto?: string
    tipo_pago?: string
    cuenta_bancaria_id?: string
  }
}

export function PagoForm({
  monto,
  tipoPago,
  cuentaBancariaId,
  montoReadOnly,
  onMontoChange,
  onTipoPagoChange,
  onCuentaChange,
  onCuentaAliasChange,
  errors,
}: Props) {
  const { activas: cuentas } = useCuentasBancarias()

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label>Monto *</Label>
        <Input
          type="number"
          step="0.01"
          min={0.01}
          value={monto || ""}
          onChange={(e) => onMontoChange(Number(e.target.value))}
          readOnly={montoReadOnly}
          className={montoReadOnly ? "bg-muted" : ""}
        />
        {errors?.monto && (
          <p className="text-sm text-destructive">{errors.monto}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tipo de pago *</Label>
        <Select value={tipoPago} onValueChange={onTipoPagoChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="transferencia">Transferencia</SelectItem>
            <SelectItem value="retiro_sin_tarjeta">
              Retiro sin tarjeta
            </SelectItem>
          </SelectContent>
        </Select>
        {errors?.tipo_pago && (
          <p className="text-sm text-destructive">{errors.tipo_pago}</p>
        )}
      </div>

      {tipoPago === "transferencia" && (
        <div className="space-y-2">
          <Label>Cuenta destino *</Label>
          <Select
            value={cuentaBancariaId ?? ""}
            onValueChange={(v) => {
              onCuentaChange(v || null)
              const cuenta = cuentas.find((c) => c.id === v)
              onCuentaAliasChange?.(cuenta ? `${cuenta.alias} — ${cuenta.clabe}` : "")
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cuenta..." />
            </SelectTrigger>
            <SelectContent>
              {cuentas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.alias} — {c.clabe}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.cuenta_bancaria_id && (
            <p className="text-sm text-destructive">
              {errors.cuenta_bancaria_id}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
