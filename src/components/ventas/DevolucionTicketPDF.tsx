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
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 8, letterSpacing: 2, color: "#666" },
  docType: { fontSize: 12, fontWeight: "bold", marginTop: 8, color: "#333" },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: { color: "#666" },
  bold: { fontWeight: "bold" },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: { flexDirection: "row", marginBottom: 2 },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: "right" },
  col3: { flex: 1, textAlign: "right" },
  col4: { flex: 1.5, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingTop: 4,
  },
  resolucionBox: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
  },
  footer: {
    textAlign: "center",
    marginTop: 20,
    color: "#999",
    fontSize: 8,
  },
})

interface ProductoDevueltoItem {
  nombre: string
  cantidad: number
  estado: string
  precioUnitario: number
  subtotal: number
}

interface ProductoNuevoItem {
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

interface Props {
  folio: string
  fecha: string
  clienteNombre: string
  clienteTelefono?: string
  vendedorNombre: string
  tipo: "devolucion" | "cambio" | "anulacion"
  productosDevueltos: ProductoDevueltoItem[]
  productosNuevos?: ProductoNuevoItem[]
  montoDevuelto: number
  montoNuevo?: number
  diferencia: number
  resolucion: {
    abonoCredito?: { monto: number; creditoRef: string }
    reembolsoEfectivo?: number
  }
  motivo?: string
}

const TIPO_LABELS: Record<string, string> = {
  devolucion: "DEVOLUCIÓN",
  cambio: "CAMBIO",
  anulacion: "ANULACIÓN",
}

export function DevolucionTicketPDF({
  folio,
  fecha,
  clienteNombre,
  clienteTelefono,
  vendedorNombre,
  tipo,
  productosDevueltos,
  productosNuevos,
  montoDevuelto,
  montoNuevo,
  diferencia,
  resolucion,
  motivo,
}: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Notas de Aren</Text>
          <Text style={styles.subtitle}>PERFUMERÍA</Text>
          <Text style={styles.docType}>
            Comprobante de {TIPO_LABELS[tipo] ?? tipo}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Datos generales */}
        <View style={styles.row}>
          <Text style={styles.label}>Venta original:</Text>
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
        {clienteTelefono && (
          <View style={styles.row}>
            <Text style={styles.label}>Teléfono:</Text>
            <Text>{clienteTelefono}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Vendedor:</Text>
          <Text>{vendedorNombre}</Text>
        </View>

        <View style={styles.divider} />

        {/* Productos devueltos */}
        <Text style={styles.sectionTitle}>Productos devueltos</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.col1, styles.bold]}>Producto</Text>
          <Text style={[styles.col2, styles.bold]}>Cant.</Text>
          <Text style={[styles.col3, styles.bold]}>Precio</Text>
          <Text style={[styles.col4, styles.bold]}>Subtotal</Text>
        </View>
        {productosDevueltos.map((d, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col1}>
              {d.nombre}
              {d.estado !== "nuevo" ? ` (${d.estado})` : ""}
            </Text>
            <Text style={styles.col2}>{d.cantidad}</Text>
            <Text style={styles.col3}>{formatMoney(d.precioUnitario)}</Text>
            <Text style={styles.col4}>{formatMoney(d.subtotal)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={{ fontWeight: "bold" }}>
            Subtotal devuelto: {formatMoney(montoDevuelto)}
          </Text>
        </View>

        {/* Productos nuevos (cambio) */}
        {productosNuevos && productosNuevos.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Productos nuevos (cambio)</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.col1, styles.bold]}>Producto</Text>
              <Text style={[styles.col2, styles.bold]}>Cant.</Text>
              <Text style={[styles.col3, styles.bold]}>Precio</Text>
              <Text style={[styles.col4, styles.bold]}>Subtotal</Text>
            </View>
            {productosNuevos.map((d, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{d.nombre}</Text>
                <Text style={styles.col2}>{d.cantidad}</Text>
                <Text style={styles.col3}>
                  {formatMoney(d.precioUnitario)}
                </Text>
                <Text style={styles.col4}>{formatMoney(d.subtotal)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={{ fontWeight: "bold" }}>
                Subtotal nuevo: {formatMoney(montoNuevo ?? 0)}
              </Text>
            </View>
          </>
        )}

        {/* Resumen */}
        <View style={styles.divider} />
        <View style={styles.resolucionBox}>
          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
            Resumen
          </Text>
          <View style={styles.row}>
            <Text>Monto devuelto:</Text>
            <Text style={styles.bold}>{formatMoney(montoDevuelto)}</Text>
          </View>
          {montoNuevo !== undefined && montoNuevo > 0 && (
            <View style={styles.row}>
              <Text>Monto productos nuevos:</Text>
              <Text style={styles.bold}>{formatMoney(montoNuevo)}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.bold}>Diferencia:</Text>
            <Text style={{ fontWeight: "bold", fontSize: 12 }}>
              {formatMoney(diferencia)}
            </Text>
          </View>

          {resolucion.abonoCredito && (
            <View style={[styles.row, { marginTop: 4 }]}>
              <Text>Abono a crédito ({resolucion.abonoCredito.creditoRef}):</Text>
              <Text style={styles.bold}>
                {formatMoney(resolucion.abonoCredito.monto)}
              </Text>
            </View>
          )}
          {resolucion.reembolsoEfectivo !== undefined && resolucion.reembolsoEfectivo > 0 && (
            <View style={styles.row}>
              <Text>Devolución en efectivo:</Text>
              <Text style={styles.bold}>
                {formatMoney(resolucion.reembolsoEfectivo)}
              </Text>
            </View>
          )}
        </View>

        {/* Motivo */}
        {motivo && (
          <>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Motivo:</Text>
              <Text>{motivo}</Text>
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            {new Date(fecha).toLocaleString("es-MX")}
          </Text>
          <Text>Notas de Aren — Perfumería</Text>
        </View>
      </Page>
    </Document>
  )
}
