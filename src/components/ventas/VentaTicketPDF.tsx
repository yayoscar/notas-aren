"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
  header: { textAlign: "center", marginBottom: 20 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 8, letterSpacing: 2, color: "#666" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#666" },
  bold: { fontWeight: "bold" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", marginBottom: 2 },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: "right" },
  col3: { flex: 1, textAlign: "right" },
  col4: { flex: 1.5, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, borderTopWidth: 1, borderTopColor: "#333", paddingTop: 4 },
  footer: { textAlign: "center", marginTop: 20, color: "#999", fontSize: 8 },
})

interface DetalleItem {
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
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
          <Text>{new Date(fecha).toLocaleDateString("es-MX")}</Text>
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

        <View style={styles.tableHeader}>
          <Text style={[styles.col1, styles.bold]}>Producto</Text>
          <Text style={[styles.col2, styles.bold]}>Cant.</Text>
          <Text style={[styles.col3, styles.bold]}>Precio</Text>
          <Text style={[styles.col4, styles.bold]}>Subtotal</Text>
        </View>
        {detalles.map((d, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col1}>{d.nombre}</Text>
            <Text style={styles.col2}>{d.cantidad}</Text>
            <Text style={styles.col3}>${d.precio_unitario.toFixed(2)}</Text>
            <Text style={styles.col4}>${d.subtotal.toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={{ fontSize: 14, fontWeight: "bold" }}>
            Total: ${total.toFixed(2)}
          </Text>
        </View>

        {tipoVenta === "contado" && tipoPago && (
          <>
            <View style={styles.divider} />
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
          </>
        )}

        {tipoVenta === "credito" && (
          <>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Periodicidad:</Text>
              <Text>{periodicidad}</Text>
            </View>
            {fechaPrimerPago && (
              <View style={styles.row}>
                <Text style={styles.label}>Primer pago:</Text>
                <Text>
                  {new Date(fechaPrimerPago).toLocaleDateString("es-MX")}
                </Text>
              </View>
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
