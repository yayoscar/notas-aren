"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatMoney } from "@/lib/utils"
import { Wallet, CalendarClock } from "lucide-react"
import type { CreditoCobranza } from "@/hooks/useCobranza"

interface Props {
  creditos: CreditoCobranza[]
  onMarcarAtendido: (
    ventaId: string,
    periodoInicio: string,
    periodoFin: string,
    frecuencia: string,
    atendido: boolean
  ) => void
  onRegistrarAbono: (credito: CreditoCobranza) => void
  onAsignarFecha: (credito: CreditoCobranza) => void
  isUpdating?: boolean
}

export function CobranzaTable({
  creditos,
  onMarcarAtendido,
  onRegistrarAbono,
  onAsignarFecha,
  isUpdating,
}: Props) {
  if (creditos.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No hay créditos pendientes para este periodo
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
          <TableHead className="hidden lg:table-cell">Ciudad</TableHead>
          <TableHead className="text-right">Pendiente</TableHead>
          <TableHead className="hidden sm:table-cell">Fecha cobro</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {creditos.map((c) => (
          <TableRow
            key={c.id}
            className={c.atendido ? "opacity-50" : undefined}
          >
            <TableCell>
              <Checkbox
                checked={c.atendido}
                disabled={isUpdating}
                onCheckedChange={(checked) =>
                  onMarcarAtendido(
                    c.id,
                    c.periodo_inicio,
                    c.periodo_fin,
                    c.periodicidad ?? "quincenal",
                    !!checked
                  )
                }
              />
            </TableCell>
            <TableCell>
              <div className={c.atendido ? "line-through" : ""}>
                <span className="font-medium">
                  {c.clientes?.nombre ?? "—"}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.folio}
                </span>
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              {c.clientes?.telefono ?? "—"}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              {c.clientes?.ciudad ?? "—"}
            </TableCell>
            <TableCell className="text-right font-medium text-orange-600">
              {formatMoney(c.saldo_restante)}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              {c.fecha_cobro_especifica ? (
                <Badge variant="outline">{c.fecha_cobro_especifica}</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onRegistrarAbono(c)}
                  className="h-8"
                >
                  <Wallet className="mr-1 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Abonar</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAsignarFecha(c)}
                  className="h-8 w-8 p-0"
                  title="Asignar fecha de cobro"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
