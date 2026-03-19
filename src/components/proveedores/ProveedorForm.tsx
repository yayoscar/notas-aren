"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { proveedorSchema, type ProveedorFormValues } from "@/lib/validations/proveedor.schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Proveedor } from "@/lib/supabase/types"

interface Props {
  proveedor?: Proveedor | null
  onSubmit: (values: ProveedorFormValues) => void
  onCancel: () => void
  isPending: boolean
}

export function ProveedorForm({ proveedor, onSubmit, onCancel, isPending }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      nombre: proveedor?.nombre ?? "",
      nombre_contacto: proveedor?.nombre_contacto ?? "",
      telefono: proveedor?.telefono ?? "",
      email: proveedor?.email ?? "",
      notas: proveedor?.notas ?? "",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input id="nombre" {...register("nombre")} placeholder="Nombre del proveedor" />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nombre_contacto">Contacto</Label>
          <Input id="nombre_contacto" {...register("nombre_contacto")} placeholder="Nombre de contacto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" {...register("telefono")} placeholder="Teléfono" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} placeholder="correo@ejemplo.com" />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" {...register("notas")} placeholder="Notas adicionales" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : proveedor ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
