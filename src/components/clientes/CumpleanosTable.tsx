"use client"

import { Cake, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { limpiarTelefono, parseLocalDate } from "@/lib/utils"
import type { ClienteCumpleanero } from "@/hooks/useCumpleaneros"

type Props = {
  clientes: ClienteCumpleanero[]
  onSendWhatsApp: (cliente: ClienteCumpleanero) => void
  isLoading: boolean
}

function fmtDiaMes(fecha: string): string {
  return parseLocalDate(fecha).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
  })
}

function diasLabel(dias: number) {
  if (dias === 0) {
    return (
      <Badge variant="default" className="bg-brand-terracotta hover:bg-brand-terracotta">
        <Cake className="mr-1 h-3 w-3" /> ¡Hoy!
      </Badge>
    )
  }
  if (dias <= 7) {
    return <Badge variant="secondary">{dias} {dias === 1 ? "día" : "días"}</Badge>
  }
  return <span className="text-sm">{dias} días</span>
}

export function CumpleanosTable({ clientes, onSendWhatsApp, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (clientes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin cumpleañeros en este rango
      </p>
    )
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {clientes.map((c) => {
          const telValido = limpiarTelefono(c.telefono).length > 0
          return (
            <div key={c.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground">{c.telefono}</p>
                </div>
                {diasLabel(c.diasRestantes)}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Cumple {fmtDiaMes(c.fecha_nacimiento)} · {c.edadProxima} años</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!telValido}
                onClick={() => onSendWhatsApp(c)}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {telValido ? "WhatsApp" : "Sin teléfono válido"}
              </Button>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Cumpleaños</TableHead>
              <TableHead>Días restantes</TableHead>
              <TableHead>Edad</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => {
              const telValido = limpiarTelefono(c.telefono).length > 0
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell>{c.telefono}</TableCell>
                  <TableCell>{fmtDiaMes(c.fecha_nacimiento)}</TableCell>
                  <TableCell>{diasLabel(c.diasRestantes)}</TableCell>
                  <TableCell>{c.edadProxima}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!telValido}
                      onClick={() => onSendWhatsApp(c)}
                      title={telValido ? "Enviar por WhatsApp" : "Teléfono no válido"}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
