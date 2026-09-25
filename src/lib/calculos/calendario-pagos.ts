/**
 * Calendario de pagos de una línea de crédito.
 *
 * Vive aquí, aparte del hook que lo usa, porque es aritmética pura y se puede
 * comprobar sin levantar la aplicación. La regla que implementa es delicada:
 * avanzar de más saca clientes de la ruta de cobro antes de tiempo, avanzar de
 * menos les cobra dos veces el mismo periodo.
 */
import { addDays, addMonths, format, lastDayOfMonth, parseISO, setDate } from "date-fns"

export type Periodicidad = string

/**
 * Siguiente vencimiento estrictamente posterior a `desde`.
 *
 * La convención quincenal —día 15 y último del mes— es la misma que usa
 * `calcularRangoPredefinido` para partir los periodos en Cobranza. Tienen que
 * coincidir: si el calendario cayera en fechas que no son frontera de
 * quincena, un cliente podría quedar sistemáticamente al otro lado del periodo
 * que se consulta.
 */
export function siguienteVencimiento(desde: Date, periodicidad: Periodicidad): Date {
  if (periodicidad === "semanal") return addDays(desde, 7)
  if (periodicidad === "mensual") return addMonths(desde, 1)

  const dia = desde.getDate()
  if (dia < 15) return setDate(desde, 15)
  const ultimo = lastDayOfMonth(desde)
  if (desde < ultimo) return ultimo
  return setDate(addMonths(desde, 1), 15)
}

/** La cuota del periodo, sobre el saldo ANTERIOR al abono. */
export function cuotaDelPeriodo(
  saldoAntes: number,
  mesesCredito: number,
  periodicidad: Periodicidad
): number {
  const factor = periodicidad === "semanal" ? 4 : periodicidad === "quincenal" ? 2 : 1
  const periodos = Math.max(1, mesesCredito * factor)
  return Math.ceil((saldoAntes / periodos) * 100) / 100
}

/**
 * Nueva fecha de próximo pago tras un abono, o `null` si no debe moverse.
 *
 * - Un abono que no cubre la cuota no mueve nada.
 * - Un abono que cubre varias cuotas adelanta tantos periodos como cubra.
 * - El avance se cuenta desde la fecha PROGRAMADA, no desde la del abono:
 *   pagar tarde no regala plazo ni desplaza el calendario.
 * - Sin fecha programada no hay desde dónde contar, así que el abono es la
 *   ocasión de darle calendario a la línea: se fija en el primer vencimiento
 *   posterior al propio abono.
 * - Si la línea queda liquidada la fecha deja de significar nada.
 */
export function avanzarCalendarioPagos({
  saldoAntes,
  montoAbono,
  mesesCredito,
  periodicidad,
  fechaProgramada,
  fechaAbono,
  quedaLiquidada,
}: {
  saldoAntes: number
  montoAbono: number
  mesesCredito: number
  periodicidad: Periodicidad
  fechaProgramada: string | null
  fechaAbono: string
  quedaLiquidada: boolean
}): string | null {
  if (quedaLiquidada) return null

  const cuota = cuotaDelPeriodo(saldoAntes, mesesCredito, periodicidad)
  const periodosCubiertos = cuota > 0 ? Math.floor(montoAbono / cuota) : 0
  if (periodosCubiertos < 1) return null

  let fecha = parseISO(fechaProgramada ?? fechaAbono)
  const avances = fechaProgramada ? periodosCubiertos : 1
  for (let i = 0; i < avances; i++) {
    fecha = siguienteVencimiento(fecha, periodicidad)
  }
  return format(fecha, "yyyy-MM-dd")
}

export type ClasificacionCobranza = "fuera" | "cobro" | "no_vence"

/**
 * Dónde va una línea de crédito en la pantalla de Cobranza de un periodo.
 *
 * - `fuera`: no se adeuda nada, no se cobra.
 * - `cobro`: vence dentro del periodo, ya venció, o no tiene fecha. Va a la
 *   ruta de cobro.
 * - `no_vence`: se adeuda pero el próximo pago cae después del periodo.
 *
 * Antes esto eran tres `return null` seguidos dentro del hook y los dos
 * últimos borraban la línea de la pantalla sin dejar rastro. `fuera` es la
 * única exclusión legítima.
 */
export function clasificarCreditoEnPeriodo({
  saldoPendiente,
  fechaSiguientePago,
  finPeriodo,
}: {
  saldoPendiente: number
  fechaSiguientePago: string | null
  finPeriodo: string
}): ClasificacionCobranza {
  if (saldoPendiente <= 0) return "fuera"
  // Sin fecha no hay vencimiento que comparar. No se puede decir que "aún no
  // vence", así que va donde se ve y se puede actuar.
  if (!fechaSiguientePago) return "cobro"

  const vence = parseISO(fechaSiguientePago)
  // parseISO NO lanza con una fecha inválida: devuelve Invalid Date, y
  // cualquier comparación con él da false. Un try/catch aquí no sirve de nada
  // y la línea acabaría en el bloque informativo en vez de a la vista.
  if (Number.isNaN(vence.getTime())) return "cobro"

  return vence <= parseISO(finPeriodo) ? "cobro" : "no_vence"
}
