"use client"

import { useTiposDescuentoActivos } from "@/hooks/useTiposDescuento"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney } from "@/lib/utils"

export interface DescuentoValue {
  tipo_descuento_id: string
  porcentaje: number
  precio_original: number
}

interface Props {
  precioOriginal: number
  descuento: DescuentoValue | null
  onChange: (d: DescuentoValue | null) => void
}

function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function DescuentoFields({ precioOriginal, descuento, onChange }: Props) {
  const { data: tipos = [], isLoading } = useTiposDescuentoActivos()
  const activo = !!descuento

  function toggle(checked: boolean) {
    if (checked) {
      onChange({
        tipo_descuento_id: tipos[0]?.id ?? "",
        porcentaje: 0,
        precio_original: precioOriginal,
      })
    } else {
      onChange(null)
    }
  }

  const precioFinal = descuento
    ? Math.round(descuento.precio_original * (1 - descuento.porcentaje / 100) * 100) / 100
    : precioOriginal

  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`descuento-${precioOriginal}`}
          checked={activo}
          onCheckedChange={(v) => toggle(v === true)}
        />
        <label
          htmlFor={`descuento-${precioOriginal}`}
          className="text-xs font-medium cursor-pointer"
        >
          Aplicar descuento
        </label>
      </div>

      {activo && descuento && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={descuento.tipo_descuento_id}
            onValueChange={(v) => onChange({ ...descuento, tipo_descuento_id: v })}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder={isLoading ? "Cargando..." : "Tipo"} />
            </SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={descuento.porcentaje}
              onChange={(e) =>
                onChange({ ...descuento, porcentaje: clampPct(Number(e.target.value)) })
              }
              className="h-8 w-16 text-xs"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>

          <div className="ml-auto text-xs tabular-nums">
            <span className="line-through text-muted-foreground mr-1.5">
              {formatMoney(descuento.precio_original)}
            </span>
            <span className="font-semibold text-foreground">{formatMoney(precioFinal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
