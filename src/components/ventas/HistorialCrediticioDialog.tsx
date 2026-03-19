"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useCreditosCliente } from "@/hooks/usePagos"

interface Props {
  clienteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HistorialCrediticioDialog({
  clienteId,
  open,
  onOpenChange,
}: Props) {
  const { data: creditos, isLoading } = useCreditosCliente(clienteId)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Historial crediticio</AlertDialogTitle>
          <AlertDialogDescription>
            Créditos del cliente seleccionado
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !creditos || creditos.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">
            Sin historial de créditos
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Abonado</TableHead>
                <TableHead className="text-right">Restante</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.folio}</TableCell>
                  <TableCell>
                    {new Date(c.fecha).toLocaleDateString("es-MX")}
                  </TableCell>
                  <TableCell className="text-right">
                    ${c.total.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${c.total_abonado.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${c.saldo_restante.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.estado_credito === "liquidado"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {c.estado_credito === "liquidado"
                        ? "Liquidado"
                        : "Activo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <AlertDialogFooter>
          <AlertDialogAction>Cerrar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
