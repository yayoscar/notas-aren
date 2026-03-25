"use client"

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import { formatMoney } from "@/lib/utils"
import type { CreditoCobranza } from "@/hooks/useCobranza"

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 15,
    borderBottom: "1 solid #333",
    paddingBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Helvetica-Bold",
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1 solid #d1d5db",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5 solid #e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  colNum: { width: "5%" },
  colNombre: { width: "28%" },
  colTelefono: { width: "17%" },
  colCiudad: { width: "17%" },
  colPendiente: { width: "16.5%", textAlign: "right" },
  colSaldo: { width: "16.5%", textAlign: "right" },
  headerText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  footer: {
    marginTop: 15,
    borderTop: "1 solid #d1d5db",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#666",
  },
})

interface Props {
  creditos: CreditoCobranza[]
  frecuencia: string
  periodoInicio: string
  periodoFin: string
  fechaGeneracion: string
}

const freqLabels: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
}

export function CobranzaListaPDF({
  creditos,
  frecuencia,
  periodoInicio,
  periodoFin,
  fechaGeneracion,
}: Props) {
  const totalPendiente = creditos.reduce((s, c) => s + c.saldo_restante, 0)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Lista de Cobranza — {freqLabels[frecuencia] ?? frecuencia}
          </Text>
          <Text style={styles.subtitle}>
            Periodo: {periodoInicio} — {periodoFin}
          </Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colNum]}>#</Text>
            <Text style={[styles.headerText, styles.colNombre]}>Nombre</Text>
            <Text style={[styles.headerText, styles.colTelefono]}>
              Teléfono
            </Text>
            <Text style={[styles.headerText, styles.colCiudad]}>Ciudad</Text>
            <Text style={[styles.headerText, styles.colPendiente]}>
              Total crédito
            </Text>
            <Text style={[styles.headerText, styles.colSaldo]}>
              Saldo pendiente
            </Text>
          </View>

          {creditos.map((c, i) => (
            <View key={c.id} style={styles.tableRow}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <Text style={styles.colNombre}>
                {c.clientes?.nombre ?? "—"}
              </Text>
              <Text style={styles.colTelefono}>
                {c.clientes?.telefono ?? "—"}
              </Text>
              <Text style={styles.colCiudad}>
                {c.clientes?.ciudad ?? "—"}
              </Text>
              <Text style={styles.colPendiente}>{formatMoney(c.total)}</Text>
              <Text style={styles.colSaldo}>
                {formatMoney(c.saldo_restante)}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Total clientes: {creditos.length} | Total pendiente:{" "}
            {formatMoney(totalPendiente)}
          </Text>
          <Text style={styles.footerText}>
            Generado: {fechaGeneracion} — Notas de Aren
          </Text>
        </View>
      </Page>
    </Document>
  )
}
