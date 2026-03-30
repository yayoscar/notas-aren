"use client"

import { useState } from "react"
import { useProveedores } from "@/hooks/useProveedores"
import { ProveedorForm } from "@/components/proveedores/ProveedorForm"
import type { ProveedorFormValues } from "@/lib/validations/proveedor.schema"
import type { Proveedor } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Pencil } from "lucide-react"

export default function ProveedoresPage() {
  const { query, create, update } = useProveedores()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)

  function handleNew() {
    setEditing(null)
    setOpen(true)
  }

  function handleEdit(p: Proveedor) {
    setEditing(p)
    setOpen(true)
  }

  function handleSubmit(values: ProveedorFormValues) {
    if (editing) {
      update.mutate({ id: editing.id, ...values }, { onSuccess: () => setOpen(false) })
    } else {
      create.mutate(values, { onSuccess: () => setOpen(false) })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Proveedores</h1>
        <Button onClick={handleNew} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {query.data?.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No hay proveedores registrados
                </p>
              )}
              {query.data?.map((p) => (
                <div key={p.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.nombre}</span>
                      <Badge variant={p.activo ? "default" : "secondary"}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{p.telefono ?? "—"}</span>
                    <span>{p.email ?? "—"}</span>
                  </div>
                  {p.nombre_contacto && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Contacto: {p.nombre_contacto}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Contacto</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay proveedores registrados
                    </TableCell>
                  </TableRow>
                )}
                {query.data?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell className="hidden sm:table-cell">{p.nombre_contacto ?? "—"}</TableCell>
                    <TableCell>{p.telefono ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{p.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={p.activo ? "default" : "secondary"}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          </DialogHeader>
          <ProveedorForm
            proveedor={editing}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            isPending={create.isPending || update.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
