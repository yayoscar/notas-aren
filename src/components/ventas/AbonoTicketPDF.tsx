"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import { formatMoney } from "@/lib/utils"

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
  header: { textAlign: "center", marginBottom: 20 },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 8, letterSpacing: 2, color: "#666" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#666" },
  bold: { fontWeight: "bold" },
  highlight: { fontSize: 16, fontWeight: "bold", textAlign: "center", marginVertical: 10 },
  footer: { textAlign: "center", marginTop: 30, color: "#999", fontSize: 8 },
})

interface Props {
  folio: string
  clienteNombre: string
  fecha: string
  monto: number
  tipoPago: string
  totalCredito: number
  totalAbonado: number
  saldoRestante: number
  saldoAnterior?: number
  vendedorNombre?: string
  fechaVenta?: string
}

export function AbonoTicketPDF({
  folio,
  clienteNombre,
  fecha,
  monto,
  tipoPago,
  totalCredito,
  totalAbonado,
  saldoRestante,
  saldoAnterior,
  vendedorNombre,
  fechaVenta,
}: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Comprobante de Abono</Text>
          <Text style={styles.subtitle}>NOTAS DE AREN — PERFUMERÍA</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Folio venta:</Text>
          <Text style={styles.bold}>{folio}</Text>
        </View>
        {fechaVenta && (
          <View style={styles.row}>
            <Text style={styles.label}>Fecha de venta:</Text>
            <Text>{new Date(fechaVenta).toLocaleDateString("es-MX")}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Cliente:</Text>
          <Text>{clienteNombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha del abono:</Text>
          <Text>{new Date(fecha).toLocaleDateString("es-MX")}</Text>
        </View>
        {vendedorNombre && (
          <View style={styles.row}>
            <Text style={styles.label}>Atendió:</Text>
            <Text>{vendedorNombre}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.highlight}>{formatMoney(monto)}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Forma de pago:</Text>
          <Text>
            {tipoPago === "efectivo"
              ? "Efectivo"
              : tipoPago === "transferencia"
                ? "Transferencia"
                : "Retiro sin tarjeta"}
          </Text>
        </View>

        <View style={styles.divider} />

        {saldoAnterior !== undefined && (
          <View style={styles.row}>
            <Text style={styles.label}>Saldo anterior:</Text>
            <Text>{formatMoney(saldoAnterior)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Total del crédito:</Text>
          <Text>{formatMoney(totalCredito)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total abonado:</Text>
          <Text>{formatMoney(totalAbonado)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Saldo restante:</Text>
          <Text style={styles.bold}>{formatMoney(saldoRestante)}</Text>
        </View>

        <View style={styles.footer}>
          <Text>Gracias por su pago</Text>
          <Text>Notas de Aren — Perfumería</Text>
        </View>
      </Page>
    </Document>
  )
}
