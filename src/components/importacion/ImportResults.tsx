"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react"

interface ImportResultsProps {
  inserted: number
  rejected: { row: number; reason: string }[]
  onReset: () => void
}

export function ImportResults({ inserted, rejected, onReset }: ImportResultsProps) {
  const total = inserted + rejected.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado de Importación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm">
              Importados: <Badge variant="default" className="bg-green-600">{inserted}</Badge>
            </span>
          </div>
          {rejected.length > 0 && (
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm">
                Rechazados: <Badge variant="destructive">{rejected.length}</Badge>
              </span>
            </div>
          )}
          <span className="text-sm text-muted-foreground">Total procesados: {total}</span>
        </div>

        {rejected.length > 0 && (
          <div className="max-h-[300px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Fila</TableHead>
                  <TableHead>Razón</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejected.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{r.row}</TableCell>
                    <TableCell className="text-red-600">{r.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Nueva Importación
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
