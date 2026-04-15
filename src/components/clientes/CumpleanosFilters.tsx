"use client"

import { Button } from "@/components/ui/button"
import type { RangoCumple } from "@/lib/cumpleanos"

const OPCIONES: { value: RangoCumple; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "3meses", label: "Próximos 3 meses" },
  { value: "6meses", label: "Próximos 6 meses" },
]

type Props = {
  value: RangoCumple
  onChange: (r: RangoCumple) => void
}

export function CumpleanosFilters({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPCIONES.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          variant={value === o.value ? "default" : "outline"}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  )
}
