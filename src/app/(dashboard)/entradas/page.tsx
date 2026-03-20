"use client"

import Link from "next/link"
import { useEntradas } from "@/hooks/useEntradas"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus } from "lucide-react"

export default function EntradasPage() {
  const { query } = useEntradas()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Entradas de inventario</h1>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/entradas/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva entrada
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                  <TableHead className="hidden sm:table-cell">N° Factura</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay entradas registradas
                    </TableCell>
                  </TableRow>
                )}
                {query.data?.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono font-medium">{e.folio}</TableCell>
                    <TableCell>{e.proveedores?.nombre ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{new Date(e.fecha).toLocaleDateString("es-MX")}</TableCell>
                    <TableCell className="hidden sm:table-cell">{e.numero_factura ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">${Number(e.total).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
