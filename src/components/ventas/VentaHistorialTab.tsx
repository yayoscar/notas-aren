"use client"

import { useVentasHistorial } from "@/hooks/useVentasHistorial"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const TIPO_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  edicion: { label: "Edición", variant: "secondary" },
  anulacion: { label: "Anulación", variant: "destructive" },
  devolucion: { label: "Devolución", variant: "outline" },
  cambio: { label: "Cambio", variant: "default" },
}

interface Props {
  ventaId: string
}

export function VentaHistorialTab({ ventaId }: Props) {
  const { data: historial, isLoading } = useVentasHistorial(ventaId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (!historial || historial.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Sin cambios registrados
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de cambios</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {historial.map((h) => {
            const badge = TIPO_BADGE[h.tipo] ?? {
              label: h.tipo,
              variant: "outline" as const,
            }
            return (
              <div
                key={h.id}
                className="flex flex-col gap-1 rounded-md border p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {h.vendedores?.nombre ?? "—"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("es-MX")}
                  </span>
                </div>
                {h.motivo && (
                  <p className="text-sm text-muted-foreground">{h.motivo}</p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
