"use client"

import { useState } from "react"
import { useCreditosCliente, useCrearAbono } from "@/hooks/usePagos"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ClienteAutocomplete } from "@/components/ventas/ClienteAutocomplete"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PagoForm } from "@/components/ventas/PagoForm"
import { toast } from "sonner"
import { formatMoney } from "@/lib/utils"
import { AbonoTicketPDF } from "@/components/ventas/AbonoTicketPDF"
import { pdf } from "@react-pdf/renderer"
import { downloadPDF } from "@/lib/pdf-utils"

export default function AbonosPage() {
  const { vendedor } = useVendedorActual()
  const crearAbono = useCrearAbono()

  const [step, setStep] = useState(1)
  const [clienteId, setClienteId] = useState("")
  const [ventaId, setVentaId] = useState("")

  const [abonoMonto, setAbonoMonto] = useState(0)
  const [abonoTipo, setAbonoTipo] = useState("efectivo")
  const [abonoCuenta, setAbonoCuenta] = useState<string | null>(null)
  const [abonoFecha, setAbonoFecha] = useState(
    new Date().toISOString().split("T")[0]
  )

  const { data: creditos } = useCreditosCliente(clienteId)

  const creditoSeleccionado = creditos?.find((c) => c.id === ventaId)

  function handleSelectCliente(id: string) {
    setClienteId(id)
    setVentaId("")
    if (id) {
      setStep(2)
    } else {
      setStep(1)
    }
  }

  function handleSelectCredito(id: string) {
    setVentaId(id)
    setStep(3)
  }

  function handleRegistrar() {
    if (!vendedor || !creditoSeleccionado || abonoMonto <= 0) return

    if (abonoMonto > creditoSeleccionado.saldo_restante) {
      toast.error("El monto no puede ser mayor al saldo restante")
      return
    }

    crearAbono.mutate(
      {
        venta_id: ventaId,
        monto: abonoMonto,
        tipo_pago: abonoTipo,
        cuenta_bancaria_id: abonoCuenta,
        vendedor_id: vendedor.id,
        cliente_id: clienteId,
        fecha: abonoFecha,
      },
      {
        onSuccess: async () => {
          try {
            const blob = await pdf(
              <AbonoTicketPDF
                folio={creditoSeleccionado!.folio}
                clienteNombre={creditoSeleccionado!.clientes?.nombre ?? ""}
                fecha={abonoFecha}
                monto={abonoMonto}
                tipoPago={abonoTipo}
                totalCredito={creditoSeleccionado!.total}
                totalAbonado={creditoSeleccionado!.total_abonado + abonoMonto}
                saldoRestante={creditoSeleccionado!.saldo_restante - abonoMonto}
                saldoAnterior={creditoSeleccionado!.total_abonado}
                vendedorNombre={vendedor?.nombre ?? ""}
                fechaVenta={creditoSeleccionado!.fecha}
              />
            ).toBlob()
            await downloadPDF(blob, `abono-${creditoSeleccionado!.folio}.pdf`)
          } catch {
            // PDF generation failed silently, abono was still recorded
          }
          setStep(1)
          setClienteId("")
          setVentaId("")
          setAbonoMonto(0)
          setAbonoTipo("efectivo")
          setAbonoCuenta(null)
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Registrar Abono</h1>

      {/* Step 1: Seleccionar cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant={step >= 1 ? "default" : "secondary"}>1</Badge>
            Seleccionar cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <ClienteAutocomplete
              value={clienteId}
              onSelect={handleSelectCliente}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Seleccionar crédito */}
      {step >= 2 && clienteId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant={step >= 2 ? "default" : "secondary"}>2</Badge>
              Créditos pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!creditos || creditos.length === 0 ? (
              <p className="text-muted-foreground">
                Este cliente no tiene créditos activos
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {creditos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCredito(c.id)}
                    className={`rounded-lg border p-4 text-left transition-colors hover:bg-secondary ${
                      ventaId === c.id ? "border-primary bg-secondary" : ""
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{c.folio}</span>
                      <Badge variant="outline">{c.periodicidad}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">{formatMoney(c.total)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Abonado</p>
                        <p className="font-medium text-green-600">
                          {formatMoney(c.total_abonado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Restante</p>
                        <p className="font-bold text-orange-600">
                          {formatMoney(c.saldo_restante)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Registrar abono */}
      {step >= 3 && creditoSeleccionado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">3</Badge>
              Datos del abono
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-xs">
              <Label>Fecha del abono</Label>
              <Input
                type="date"
                value={abonoFecha}
                onChange={(e) => setAbonoFecha(e.target.value)}
              />
            </div>
            <PagoForm
              monto={abonoMonto}
              tipoPago={abonoTipo}
              cuentaBancariaId={abonoCuenta}
              onMontoChange={setAbonoMonto}
              onTipoPagoChange={setAbonoTipo}
              onCuentaChange={setAbonoCuenta}
            />
            <p className="text-sm text-muted-foreground">
              Saldo restante: {formatMoney(creditoSeleccionado.saldo_restante)}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1)
                  setClienteId("")
                  setVentaId("")
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRegistrar}
                disabled={crearAbono.isPending || abonoMonto <= 0}
              >
                {crearAbono.isPending ? "Registrando..." : "Registrar abono"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
