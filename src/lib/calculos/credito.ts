/**
 * Recalcula cuotas de credito manteniendo mismos plazos (solo ajusta montos).
 * Regla PRD: los plazos/periodos NUNCA se modifican, solo los montos por periodo.
 */
export function recalcularCuotasCredito({
  saldoTotal,
  saldoPagado,
  montoDevolucion,
  mesesCredito,
  periodicidad,
}: {
  saldoTotal: number
  saldoPagado: number
  montoDevolucion: number
  mesesCredito: number
  periodicidad: "semanal" | "quincenal" | "mensual"
}): { nuevoSaldo: number; nuevaCuota: number; periodos: number } {
  const factor = periodicidad === "semanal" ? 4 : periodicidad === "quincenal" ? 2 : 1
  const periodos = mesesCredito * factor

  const nuevoSaldoTotal = saldoTotal - montoDevolucion
  const nuevoSaldo = nuevoSaldoTotal - saldoPagado

  if (nuevoSaldo <= 0) {
    return { nuevoSaldo: 0, nuevaCuota: 0, periodos }
  }

  const nuevaCuota = Math.ceil((nuevoSaldo / periodos) * 100) / 100

  return { nuevoSaldo, nuevaCuota, periodos }
}
