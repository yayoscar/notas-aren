import { parseLocalDate } from "@/lib/utils"

export type RangoCumple = "hoy" | "semana" | "mes" | "3meses" | "6meses"

export function diasHastaCumple(fechaNacimiento: string, hoy: Date = new Date()): number {
  const nac = parseLocalDate(fechaNacimiento)
  const mes = nac.getMonth()
  const dia = nac.getDate()

  const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  let proximo = new Date(hoyMidnight.getFullYear(), mes, dia)

  if (proximo < hoyMidnight) {
    proximo = new Date(hoyMidnight.getFullYear() + 1, mes, dia)
  }

  const diffMs = proximo.getTime() - hoyMidnight.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export function edadProxima(fechaNacimiento: string, hoy: Date = new Date()): number {
  const nac = parseLocalDate(fechaNacimiento)
  const yaCumplio =
    hoy.getMonth() > nac.getMonth() ||
    (hoy.getMonth() === nac.getMonth() && hoy.getDate() >= nac.getDate())
  const edadActual = hoy.getFullYear() - nac.getFullYear() - (yaCumplio ? 0 : 1)
  return edadActual + 1
}

export function estaEnRango(
  diasRestantes: number,
  rango: RangoCumple,
  hoy: Date = new Date()
): boolean {
  if (diasRestantes < 0) return false

  switch (rango) {
    case "hoy":
      return diasRestantes === 0
    case "semana":
      return diasRestantes <= 6
    case "mes": {
      const objetivo = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
      objetivo.setDate(objetivo.getDate() + diasRestantes)
      return (
        objetivo.getFullYear() === hoy.getFullYear() &&
        objetivo.getMonth() === hoy.getMonth()
      )
    }
    case "3meses":
      return diasRestantes <= 90
    case "6meses":
      return diasRestantes <= 180
  }
}
