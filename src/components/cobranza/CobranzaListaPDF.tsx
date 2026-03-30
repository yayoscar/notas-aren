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
    fontSize: 8,
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
  colNum: { width: "4%" },
  colNombre: { width: "20%" },
  colTelefono: { width: "13%" },
  colCuota: { width: "11%", textAlign: "right" },
  colPendiente: { width: "12%", textAlign: "right" },
  colSigPago: { width: "10%" },
  colUltAbono: { width: "18%" },
  colEstado: { width: "12%", textAlign: "center" },
  headerText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  green: { color: "#16a34a" },
  orange: { color: "#ea580c" },
  gray: { color: "#9ca3af" },
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

const rangoLabels: Record<string, string> = {
  semana: "Semanal",
  quincena: "Quincenal",
  mes: "Mensual",
  personalizado: "Personalizado",
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—"
  try {
    return new Date(fecha + "T12:00:00").toLocaleDateString("es-MX")
  } catch {
    return "—"
  }
}

export function CobranzaListaPDF({
  creditos,
  frecuencia,
  periodoInicio,
  periodoFin,
  fechaGeneracion,
}: Props) {
  const totalPendiente = creditos.reduce((s, c) => s + c.saldo_pendiente, 0)
  const alDia = creditos.filter((c) => c.estado_periodo === "al_dia").length
  const atrasados = creditos.filter((c) => c.estado_periodo === "atrasado").length
  const sinAbonos = creditos.filter((c) => c.estado_periodo === "sin_abonos").length

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Lista de Cobranza — {rangoLabels[frecuencia] ?? frecuencia}
          </Text>
          <Text style={styles.subtitle}>
            Periodo: {periodoInicio} — {periodoFin}
          </Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colNum]}>#</Text>
            <Text style={[styles.headerText, styles.colNombre]}>Cliente</Text>
            <Text style={[styles.headerText, styles.colTelefono]}>Teléfono</Text>
            <Text style={[styles.headerText, styles.colCuota]}>Cuota</Text>
            <Text style={[styles.headerText, styles.colPendiente]}>Pendiente</Text>
            <Text style={[styles.headerText, styles.colSigPago]}>Sig. pago</Text>
            <Text style={[styles.headerText, styles.colUltAbono]}>Último abono</Text>
            <Text style={[styles.headerText, styles.colEstado]}>Estado</Text>
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
              <Text style={[styles.colCuota, styles.bold]}>
                {formatMoney(c.cuota_programada)}
              </Text>
              <Text style={[styles.colPendiente, styles.orange]}>
                {formatMoney(c.saldo_pendiente)}
              </Text>
              <Text style={styles.colSigPago}>
                {formatFecha(c.fecha_siguiente_pago)}
              </Text>
              <Text style={styles.colUltAbono}>
                {c.ultimo_pago_fecha
                  ? `${formatFecha(c.ultimo_pago_fecha)} (${formatMoney(c.ultimo_pago_monto ?? 0)})`
                  : "—"}
              </Text>
              <Text
                style={[
                  styles.colEstado,
                  c.estado_periodo === "al_dia"
                    ? styles.green
                    : c.estado_periodo === "atrasado"
                      ? styles.orange
                      : styles.gray,
                ]}
              >
                {c.estado_periodo === "al_dia"
                  ? "Al día"
                  : c.estado_periodo === "atrasado"
                    ? "Atrasado"
                    : "Sin abonos"}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Total: {creditos.length} clientes | Pendiente: {formatMoney(totalPendiente)} | Al día: {alDia} | Atrasados: {atrasados} | Sin abonos: {sinAbonos}
          </Text>
          <Text style={styles.footerText}>
            Generado: {fechaGeneracion} — Notas de Aren
          </Text>
        </View>
      </Page>
    </Document>
  )
}
