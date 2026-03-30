"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useVendedor, useVendedores } from "@/hooks/useVendedores"
import { VendedorEditForm } from "@/components/vendedores/VendedorForm"
import type { VendedorEditFormValues } from "@/lib/validations/vendedor.schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  )
}

export default function VendedorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const vendedorQuery = useVendedor(id)
  const { update, resetPassword } = useVendedores()
  const [newPassword, setNewPassword] = useState("")

  function handleSubmit(values: VendedorEditFormValues) {
    update.mutate({ id, ...values }, {
      onSuccess: () => router.push("/vendedores"),
    })
  }

  function handleResetPassword() {
    if (newPassword.length < 6) return
    resetPassword.mutate(
      { vendedorId: id, password: newPassword },
      { onSuccess: () => setNewPassword("") }
    )
  }

  if (vendedorQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!vendedorQuery.data) {
    return <p className="text-muted-foreground">Vendedor no encontrado</p>
  }

  const v = vendedorQuery.data

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <h1 className="text-xl font-bold sm:text-2xl">{v.nombre}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant={v.rol === "admin" ? "default" : "secondary"}>
            {v.rol === "admin" ? "Administrador" : "Vendedor"}
          </Badge>
          <Badge variant={v.activo ? "default" : "secondary"}>
            {v.activo ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="detalle">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="editar">Editar</TabsTrigger>
            <TabsTrigger value="password">Contraseña</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="detalle" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <DetailRow label="Nombre" value={v.nombre} />
                <DetailRow label="Usuario" value={v.usuario} />
                <DetailRow label="Teléfono" value={v.telefono} />
                <DetailRow label="Rol" value={v.rol === "admin" ? "Administrador" : "Vendedor"} />
                <DetailRow label="Debe cambiar contraseña" value={v.debe_cambiar_password ? "Sí" : "No"} />
                <DetailRow label="Fecha de alta" value={new Date(v.created_at).toLocaleDateString("es-MX")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editar" className="mt-4">
          <VendedorEditForm
            vendedor={v}
            onSubmit={handleSubmit}
            isPending={update.isPending}
          />
        </TabsContent>

        <TabsContent value="password" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Resetear contraseña</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Al asignar una nueva contraseña, el vendedor deberá cambiarla en su próximo inicio de sesión.
              </p>
              <Separator />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end max-w-md">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="newPassword">Nueva contraseña</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleResetPassword}
                  disabled={resetPassword.isPending || newPassword.length < 6}
                >
                  {resetPassword.isPending ? "Reseteando..." : "Resetear"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
