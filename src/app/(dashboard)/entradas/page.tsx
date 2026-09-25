"use client"

import { useState } from "react"
import Link from "next/link"
import { useEntradas } from "@/hooks/useEntradas"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { formatMoney, formatDate } from "@/lib/utils"

export default function EntradasPage() {
  const { query, remove } = useEntradas()
  const [porEliminar, setPorEliminar] = useState<{ id: string; folio: string } | null>(null)

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
            <>
              {/* Mobile card view */}
              <div className="space-y-2 md:hidden">
                {query.data?.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No hay entradas registradas
                  </p>
                )}
                {query.data?.map((e) => (
                  <div key={e.id} className="rounded-lg border p-3">
                    <Link href={`/entradas/${e.id}`} className="block hover:opacity-80 transition-opacity">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-medium">{e.folio}</span>
                        <span className="font-mono tabular-nums font-medium">{formatMoney(Number(e.total))}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{e.proveedores?.nombre ?? "—"}</span>
                        <span>{formatDate(e.fecha)}</span>
                      </div>
                      {e.numero_factura && (
                        <p className="text-xs text-muted-foreground">Factura: {e.numero_factura}</p>
                      )}
                    </Link>
                    <div className="mt-2 flex justify-end gap-1 border-t pt-2">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/entradas/${e.id}/editar`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPorEliminar({ id: e.id, folio: e.folio })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>N° Factura</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No hay entradas registradas
                        </TableCell>
                      </TableRow>
                    )}
                    {query.data?.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Link href={`/entradas/${e.id}`} className="font-mono font-medium hover:underline">
                            {e.folio}
                          </Link>
                        </TableCell>
                        <TableCell>{e.proveedores?.nombre ?? "—"}</TableCell>
                        <TableCell>{formatDate(e.fecha)}</TableCell>
                        <TableCell>{e.numero_factura ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(Number(e.total))}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" asChild>
                              <Link href={`/entradas/${e.id}/editar`} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              title="Eliminar"
                              onClick={() => setPorEliminar({ id: e.id, folio: e.folio })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      <ConfirmDeleteDialog
        open={porEliminar !== null}
        onOpenChange={(open) => !open && setPorEliminar(null)}
        onConfirm={() => {
          if (!porEliminar) return
          remove.mutate(porEliminar.id, {
            onSettled: () => setPorEliminar(null),
          })
        }}
        isPending={remove.isPending}
        title={`¿Eliminar la entrada ${porEliminar?.folio ?? ""}?`}
        description="Se descontará del inventario todo lo que esta entrada sumó. Si alguna de esas piezas ya se vendió o se derivó, la eliminación se bloqueará. Los precios de venta del producto no se revierten. Esta acción no se puede deshacer."
      />
    </div>
  )
}
