"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import { formatMoney, formatDate } from "@/lib/utils"

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
  header: { textAlign: "center", marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 8, letterSpacing: 2, color: "#666" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#666" },
  bold: { fontWeight: "bold", fontFamily: "Helvetica-Bold" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", marginBottom: 3 },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: "right" },
  col3: { flex: 1, textAlign: "right" },
  col4: { flex: 1.5, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, borderTopWidth: 1, borderTopColor: "#333", paddingTop: 4 },
  footer: { textAlign: "center", marginTop: 20, color: "#999", fontSize: 8 },
  productMeta: { fontSize: 8, color: "#666", marginTop: 1 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", fontFamily: "Helvetica-Bold", marginBottom: 6 },
  abonoRow: { flexDirection: "row", marginBottom: 2 },
  abonoCol1: { flex: 2 },
  abonoCol2: { flex: 1.5, textAlign: "right" },
  abonoCol3: { flex: 1.5 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
})

interface DetalleItem {
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  estado_producto?: string
  marca?: string
  genero?: string
  sku?: string | null
  descuento?: {
    tipo: string
    porcentaje: number
    precio_original: number
  } | null
}

interface PagoItem {
  fecha: string
  monto: number
  tipo_pago: string
}

interface Props {
  folio: string
  fecha: string
  clienteNombre: string
  clienteTelefono: string
  vendedorNombre: string
  tipoVenta: string
  total: number
  detalles: DetalleItem[]
  tipoPago?: string
  periodicidad?: string | null
  fechaPrimerPago?: string | null
  mesesCredito?: number | null
  pagos?: PagoItem[]
  totalAbonado?: number
  saldoRestante?: number
}

const TIPO_PAGO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  retiro_sin_tarjeta: "Retiro s/tarjeta",
  devolucion: "Devolución",
}

export function VentaTicketPDF({
  folio,
  fecha,
  clienteNombre,
  clienteTelefono,
  vendedorNombre,
  tipoVenta,
  total,
  detalles,
  tipoPago,
  periodicidad,
  fechaPrimerPago,
  mesesCredito,
  pagos,
  totalAbonado,
  saldoRestante,
}: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Notas de Aren</Text>
          <Text style={styles.subtitle}>PERFUMERÍA</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Folio:</Text>
          <Text style={styles.bold}>{folio}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha:</Text>
          <Text>{formatDate(fecha)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cliente:</Text>
          <Text>{clienteNombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Teléfono:</Text>
          <Text>{clienteTelefono}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Vendedor:</Text>
          <Text>{vendedorNombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tipo:</Text>
          <Text style={styles.bold}>
            {tipoVenta === "contado" ? "Contado" : "Crédito"}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Product table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.col1, styles.bold]}>Producto</Text>
          <Text style={[styles.col2, styles.bold]}>Cant.</Text>
          <Text style={[styles.col3, styles.bold]}>Precio</Text>
          <Text style={[styles.col4, styles.bold]}>Subtotal</Text>
        </View>
        {detalles.map((d, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={styles.col1}>
              <Text>
                {d.nombre}
                {d.estado_producto && d.estado_producto !== "nuevo"
                  ? ` (${d.estado_producto === "parcial" ? "Parcial" : "Tester"})`
                  : ""}
              </Text>
              {(d.marca || d.genero || d.sku) && (
                <Text style={styles.productMeta}>
                  {[
                    d.marca,
                    d.genero,
                    d.sku ? `SKU: ${d.sku}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}
              {d.descuento && (
                <Text style={styles.productMeta}>
                  Descuento {d.descuento.tipo} -{d.descuento.porcentaje}% (-
                  {formatMoney(d.descuento.precio_original - d.precio_unitario)})
                </Text>
              )}
            </View>
            <Text style={styles.col2}>{d.cantidad}</Text>
            <Text style={styles.col3}>{formatMoney(d.precio_unitario)}</Text>
            <Text style={styles.col4}>{formatMoney(d.subtotal)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={{ fontSize: 14, fontWeight: "bold", fontFamily: "Helvetica-Bold" }}>
            Total: {formatMoney(total)}
          </Text>
        </View>

        {/* Contado payment info */}
        {tipoVenta === "contado" && tipoPago && (
          <>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Forma de pago:</Text>
              <Text>{TIPO_PAGO_LABELS[tipoPago] ?? tipoPago}</Text>
            </View>
          </>
        )}

        {/* Credit info */}
        {tipoVenta === "credito" && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Datos del crédito</Text>
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
            {fechaPrimerPago && (
              <View style={styles.row}>
                <Text style={styles.label}>Primer pago:</Text>
                <Text>
                  {formatDate(fechaPrimerPago)}
                </Text>
              </View>
            )}
            {mesesCredito && (
              <View style={styles.row}>
                <Text style={styles.label}>Plazo:</Text>
                <Text>
                  {mesesCredito} {mesesCredito === 1 ? "mes" : "meses"}
                </Text>
              </View>
            )}

            {/* Abonos section */}
            {pagos && pagos.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Abonos realizados</Text>
                <View style={[styles.abonoRow, { borderBottomWidth: 0.5, borderBottomColor: "#999", paddingBottom: 2, marginBottom: 4 }]}>
                  <Text style={[styles.abonoCol1, { fontSize: 8, fontFamily: "Helvetica-Bold" }]}>Fecha</Text>
                  <Text style={[styles.abonoCol2, { fontSize: 8, fontFamily: "Helvetica-Bold" }]}>Monto</Text>
                  <Text style={[styles.abonoCol3, { fontSize: 8, fontFamily: "Helvetica-Bold" }]}>Tipo</Text>
                </View>
                {pagos.map((p, i) => (
                  <View key={i} style={styles.abonoRow}>
                    <Text style={[styles.abonoCol1, { fontSize: 9 }]}>
                      {formatDate(p.fecha)}
                    </Text>
                    <Text style={[styles.abonoCol2, { fontSize: 9 }]}>
                      {formatMoney(p.monto)}
                    </Text>
                    <Text style={[styles.abonoCol3, { fontSize: 9 }]}>
                      {TIPO_PAGO_LABELS[p.tipo_pago] ?? p.tipo_pago}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Saldo summary */}
            {typeof totalAbonado === "number" && typeof saldoRestante === "number" && (
              <>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Total abonado:</Text>
                  <Text style={{ color: "#16a34a" }}>{formatMoney(totalAbonado)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.bold, { fontSize: 11 }]}>Saldo pendiente:</Text>
                  <Text style={[styles.bold, { fontSize: 11, color: "#ea580c" }]}>
                    {formatMoney(saldoRestante)}
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        <View style={styles.footer}>
          <Text>Gracias por su compra</Text>
          <Text>Notas de Aren — Perfumería</Text>
        </View>
      </Page>
    </Document>
  )
}
