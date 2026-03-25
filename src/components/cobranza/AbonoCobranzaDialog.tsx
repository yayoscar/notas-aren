"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PagoForm } from "@/components/ventas/PagoForm"
import { AbonoTicketPDF } from "@/components/ventas/AbonoTicketPDF"
import { useCrearAbono } from "@/hooks/usePagos"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { formatMoney } from "@/lib/utils"
import { toast } from "sonner"
import { pdf } from "@react-pdf/renderer"
import { downloadPDF } from "@/lib/pdf-utils"
import type { CreditoCobranza } from "@/hooks/useCobranza"

interface Props {
  credito: CreditoCobranza | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AbonoCobranzaDialog({ credito, open, onOpenChange }: Props) {
  const { vendedor } = useVendedorActual()
  const crearAbono = useCrearAbono()

  const [monto, setMonto] = useState(0)
  const [tipoPago, setTipoPago] = useState("efectivo")
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])

  function resetForm() {
    setMonto(0)
    setTipoPago("efectivo")
    setCuentaId(null)
    setFecha(new Date().toISOString().split("T")[0])
  }

  function handleRegistrar() {
    if (!credito || !vendedor || monto <= 0) return

    if (monto > credito.saldo_restante) {
      toast.error("El monto no puede ser mayor al saldo restante")
      return
    }

    crearAbono.mutate(
      {
        venta_id: credito.id,
        monto,
        tipo_pago: tipoPago,
        cuenta_bancaria_id: cuentaId,
        vendedor_id: vendedor.id,
        cliente_id: credito.cliente_id,
        fecha,
      },
      {
        onSuccess: async () => {
          try {
            const blob = await pdf(
              <AbonoTicketPDF
                folio={credito.folio}
                clienteNombre={credito.clientes?.nombre ?? ""}
                fecha={fecha}
                monto={monto}
                tipoPago={tipoPago}
                totalCredito={credito.total}
                totalAbonado={credito.total_abonado + monto}
                saldoRestante={credito.saldo_restante - monto}
                saldoAnterior={credito.total_abonado}
                vendedorNombre={vendedor?.nombre ?? ""}
                fechaVenta={credito.fecha}
              />
            ).toBlob()
            await downloadPDF(blob, `abono-${credito.folio}.pdf`)
          } catch {
            // PDF generation failed silently, abono was still recorded
          }
          resetForm()
          onOpenChange(false)
        },
      }
    )
  }

  if (!credito) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Registrar Abono
            <Badge variant="outline">{credito.folio}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Credit summary */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 font-medium">{credito.clientes?.nombre}</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">{formatMoney(credito.total)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Abonado</p>
                <p className="font-medium text-green-600">
                  {formatMoney(credito.total_abonado)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Restante</p>
                <p className="font-bold text-orange-600">
                  {formatMoney(credito.saldo_restante)}
                </p>
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2 max-w-xs">
            <Label>Fecha del abono</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Payment form */}
          <PagoForm
            monto={monto}
            tipoPago={tipoPago}
            cuentaBancariaId={cuentaId}
            onMontoChange={setMonto}
            onTipoPagoChange={setTipoPago}
            onCuentaChange={setCuentaId}
          />

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrar}
              disabled={crearAbono.isPending || monto <= 0}
            >
              {crearAbono.isPending ? "Registrando..." : "Registrar abono"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
