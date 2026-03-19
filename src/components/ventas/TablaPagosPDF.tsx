"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import {
  addWeeks,
  addMonths,
  lastDayOfMonth,
  setDate,
  format,
} from "date-fns"
import { es } from "date-fns/locale"

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
  header: { textAlign: "center", marginBottom: 20 },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 8, letterSpacing: 2, color: "#666" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#666" },
  bold: { fontWeight: "bold" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", marginBottom: 3, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  colNum: { width: 25 },
  colFecha: { flex: 2 },
  colMonto: { flex: 1, textAlign: "right" },
  colAbonado: { flex: 1, textAlign: "right" },
  colEstado: { flex: 1.2, textAlign: "right" },
  estadoPagado: { color: "#16a34a" },
  estadoParcial: { color: "#d97706" },
  estadoPendiente: { color: "#9ca3af" },
  summaryRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#333", paddingTop: 6, marginTop: 6 },
})

interface Props {
  folio: string
  clienteNombre: string
  total: number
  primerAbono: number
  meses: number
  periodicidad: string
  fechaPrimerPago: string
  pagosRealizados?: { monto: number; fecha: string }[]
}

interface CuotaProgramada {
  numero: number
  fecha: Date
  monto: number
  acumulado: number
}

interface CuotaConEstado extends CuotaProgramada {
  abonado: number
  estado: "pagado" | "parcial" | "pendiente"
}

function calcularFechasPago(
  fechaPrimerPago: string,
  periodicidad: string,
  saldoPendiente: number,
  montoCuota: number
): CuotaProgramada[] {
  const pagos: CuotaProgramada[] = []
  let fechaActual = new Date(fechaPrimerPago)
  let acumulado = 0
  let numero = 1

  while (acumulado < saldoPendiente) {
    const montoRestante = saldoPendiente - acumulado
    const montoPago = Math.min(montoCuota, montoRestante)
    acumulado += montoPago

    pagos.push({
      numero,
      fecha: new Date(fechaActual),
      monto: montoPago,
      acumulado,
    })

    numero++

    if (periodicidad === "semanal") {
      fechaActual = addWeeks(fechaActual, 1)
    } else if (periodicidad === "quincenal") {
      const day = fechaActual.getDate()
      if (day <= 15) {
        fechaActual = lastDayOfMonth(fechaActual)
      } else {
        fechaActual = setDate(addMonths(fechaActual, 1), 15)
      }
    } else {
      fechaActual = lastDayOfMonth(addMonths(fechaActual, 1))
    }

    // Seguridad: máximo 60 pagos
    if (numero > 60) break
  }

  return pagos
}

function aplicarCobertura(
  cuotas: CuotaProgramada[],
  pagosRealizados: { monto: number; fecha: string }[]
): CuotaConEstado[] {
  let saldoAbonos = pagosRealizados.reduce((sum, p) => sum + p.monto, 0)

  return cuotas.map((cuota) => {
    if (saldoAbonos >= cuota.monto) {
      saldoAbonos -= cuota.monto
      return { ...cuota, abonado: cuota.monto, estado: "pagado" as const }
    } else if (saldoAbonos > 0) {
      const abonado = saldoAbonos
      saldoAbonos = 0
      return { ...cuota, abonado, estado: "parcial" as const }
    } else {
      return { ...cuota, abonado: 0, estado: "pendiente" as const }
    }
  })
}

export function TablaPagosPDF({
  folio,
  clienteNombre,
  total,
  primerAbono,
  meses,
  periodicidad,
  fechaPrimerPago,
  pagosRealizados = [],
}: Props) {
  const saldoPendiente = total - primerAbono
  const factor =
    periodicidad === "semanal" ? 4 : periodicidad === "quincenal" ? 2 : 1
  const numCuotas = meses * factor
  const montoCuota = Math.ceil((saldoPendiente / numCuotas) * 100) / 100

  const cuotasBase = calcularFechasPago(
    fechaPrimerPago,
    periodicidad,
    saldoPendiente,
    montoCuota
  )

  const cuotas = aplicarCobertura(cuotasBase, pagosRealizados)

  const totalAbonado = cuotas.reduce((sum, c) => sum + c.abonado, 0)
  const saldoRestante = saldoPendiente - totalAbonado

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Tabla de Pagos</Text>
          <Text style={styles.subtitle}>NOTAS DE AREN — PERFUMERÍA</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Folio:</Text>
          <Text style={styles.bold}>{folio}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cliente:</Text>
          <Text>{clienteNombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total del crédito:</Text>
          <Text style={styles.bold}>${total.toFixed(2)}</Text>
        </View>
        {primerAbono > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Primer abono:</Text>
            <Text>${primerAbono.toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Saldo a pagar:</Text>
          <Text style={styles.bold}>${saldoPendiente.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Plazo:</Text>
          <Text>
            {meses} {meses === 1 ? "mes" : "meses"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Periodicidad:</Text>
          <Text>
            {periodicidad === "semanal"
              ? "Semanal"
              : periodicidad === "quincenal"
                ? "Quincenal"
                : "Mensual"}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.tableHeader}>
          <Text style={[styles.colNum, styles.bold]}>#</Text>
          <Text style={[styles.colFecha, styles.bold]}>Fecha</Text>
          <Text style={[styles.colMonto, styles.bold]}>Monto</Text>
          <Text style={[styles.colAbonado, styles.bold]}>Abonado</Text>
          <Text style={[styles.colEstado, styles.bold]}>Estado</Text>
        </View>

        {cuotas.map((c) => (
          <View key={c.numero} style={styles.tableRow}>
            <Text style={styles.colNum}>{c.numero}</Text>
            <Text style={styles.colFecha}>
              {format(c.fecha, "dd/MM/yyyy", { locale: es })}
            </Text>
            <Text style={styles.colMonto}>${c.monto.toFixed(2)}</Text>
            <Text style={styles.colAbonado}>
              {c.abonado > 0 ? `$${c.abonado.toFixed(2)}` : "—"}
            </Text>
            <Text
              style={[
                styles.colEstado,
                c.estado === "pagado"
                  ? styles.estadoPagado
                  : c.estado === "parcial"
                    ? styles.estadoParcial
                    : styles.estadoPendiente,
              ]}
            >
              {c.estado === "pagado"
                ? "Pagado"
                : c.estado === "parcial"
                  ? `Parcial ($${c.abonado.toFixed(2)}/$${c.monto.toFixed(2)})`
                  : "Pendiente"}
            </Text>
          </View>
        ))}

        <View style={styles.summaryRow}>
          <Text style={[styles.colNum, { color: "transparent" }]}>.</Text>
          <Text style={[styles.colFecha, styles.bold]}>Totales</Text>
          <Text style={[styles.colMonto, styles.bold]}>
            ${saldoPendiente.toFixed(2)}
          </Text>
          <Text style={[styles.colAbonado, styles.bold, styles.estadoPagado]}>
            ${totalAbonado.toFixed(2)}
          </Text>
          <Text style={[styles.colEstado, styles.bold, styles.estadoPendiente]}>
            Resta: ${saldoRestante.toFixed(2)}
          </Text>
        </View>

        <View style={{ marginTop: 20, textAlign: "center" }}>
          <Text style={{ color: "#999", fontSize: 8 }}>
            Este documento es informativo. Los montos pueden variar según
            abonos realizados.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
