"use client"

import { useVendedorActual } from "@/hooks/useVendedorActual"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ImportProductos } from "@/components/importacion/ImportProductos"
import { ImportClientes } from "@/components/importacion/ImportClientes"
import { ImportCreditos } from "@/components/importacion/ImportCreditos"
import { Package, Users, CreditCard } from "lucide-react"

export default function ImportacionPage() {
  const { isAdmin, isLoading } = useVendedorActual()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Importación Masiva</h1>
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Importación Masiva</h1>
        <p className="text-muted-foreground">
          Carga inicial de productos, clientes y créditos desde archivos Excel
        </p>
      </div>

      <Tabs defaultValue="productos">
        <TabsList>
          <TabsTrigger value="productos" className="gap-2">
            <Package className="h-4 w-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="creditos" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Créditos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productos">
          <ImportProductos />
        </TabsContent>

        <TabsContent value="clientes">
          <ImportClientes />
        </TabsContent>

        <TabsContent value="creditos">
          <ImportCreditos />
        </TabsContent>
      </Tabs>
    </div>
  )
}
