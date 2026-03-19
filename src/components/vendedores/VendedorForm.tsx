"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { vendedorSchema, vendedorEditSchema, type VendedorFormValues, type VendedorEditFormValues } from "@/lib/validations/vendedor.schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Vendedor } from "@/lib/supabase/types"

interface CreateProps {
  onSubmit: (values: VendedorFormValues) => void
  isPending: boolean
}

interface EditProps {
  vendedor: Vendedor
  onSubmit: (values: VendedorEditFormValues) => void
  isPending: boolean
}

export function VendedorCreateForm({ onSubmit, isPending }: CreateProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendedorFormValues>({
    resolver: zodResolver(vendedorSchema),
    defaultValues: {
      nombre: "",
      telefono: "",
      usuario: "",
      rol: "vendedor",
      password: "",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" {...register("nombre")} placeholder="Nombre completo" />
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input id="telefono" {...register("telefono")} placeholder="10 dígitos" />
              {errors.telefono && <p className="text-sm text-destructive">{errors.telefono.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuario">Usuario *</Label>
              <Input id="usuario" {...register("usuario")} placeholder="nombre_usuario" />
              {errors.usuario && <p className="text-sm text-destructive">{errors.usuario.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol *</Label>
              <select
                id="rol"
                {...register("rol")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="password">Contraseña inicial *</Label>
              <Input id="password" type="password" {...register("password")} placeholder="Mínimo 6 caracteres" />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando..." : "Crear vendedor"}
        </Button>
      </div>
    </form>
  )
}

export function VendedorEditForm({ vendedor, onSubmit, isPending }: EditProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendedorEditFormValues>({
    resolver: zodResolver(vendedorEditSchema),
    defaultValues: {
      nombre: vendedor.nombre,
      telefono: vendedor.telefono,
      rol: vendedor.rol as "admin" | "vendedor",
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input id="telefono" {...register("telefono")} />
              {errors.telefono && <p className="text-sm text-destructive">{errors.telefono.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input value={vendedor.usuario} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol *</Label>
              <select
                id="rol"
                {...register("rol")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Actualizar"}
        </Button>
      </div>
    </form>
  )
}
