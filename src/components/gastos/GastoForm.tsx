"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { gastoBaseSchema, type GastoFormValues } from "@/lib/validations/gasto.schema"
import { useCategoriasGasto } from "@/hooks/useCategoriasGasto"
import { useCuentasBancarias } from "@/hooks/useCuentasBancarias"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  onSubmit: (values: GastoFormValues) => void
  isPending: boolean
}

export function GastoForm({ onSubmit, isPending }: Props) {
  const { activas: categorias } = useCategoriasGasto()
  const { activas: cuentas } = useCuentasBancarias()

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(gastoBaseSchema),
    defaultValues: {
      concepto: "",
      monto: 0,
      categoria_id: "",
      fecha: today,
      tipo_pago: "efectivo",
      cuenta_bancaria_id: null,
    },
  })

  const tipoPago = watch("tipo_pago")

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del gasto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="concepto">Concepto *</Label>
              <Input
                id="concepto"
                {...register("concepto")}
                placeholder="Descripción del gasto"
              />
              {errors.concepto && (
                <p className="text-sm text-destructive">
                  {errors.concepto.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto">Monto *</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                {...register("monto")}
              />
              {errors.monto && (
                <p className="text-sm text-destructive">
                  {errors.monto.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select
                value={watch("categoria_id")}
                onValueChange={(v) => setValue("categoria_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoria_id && (
                <p className="text-sm text-destructive">
                  {errors.categoria_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha *</Label>
              <Input id="fecha" type="date" {...register("fecha")} />
              {errors.fecha && (
                <p className="text-sm text-destructive">
                  {errors.fecha.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de pago *</Label>
              <Select
                value={tipoPago}
                onValueChange={(v) =>
                  setValue(
                    "tipo_pago",
                    v as "efectivo" | "transferencia" | "retiro_sin_tarjeta"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="retiro_sin_tarjeta">
                    Retiro sin tarjeta
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoPago === "transferencia" && (
              <div className="space-y-2">
                <Label>Cuenta destino *</Label>
                <Select
                  value={watch("cuenta_bancaria_id") ?? ""}
                  onValueChange={(v) =>
                    setValue("cuenta_bancaria_id", v || null)
                  }
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
                {errors.cuenta_bancaria_id && (
                  <p className="text-sm text-destructive">
                    {errors.cuenta_bancaria_id.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Registrar gasto"}
        </Button>
      </div>
    </form>
  )
}
