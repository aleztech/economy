const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

export const eur = (n: number, dec = false) => (dec ? eur2 : eur0).format(Number.isFinite(n) ? n : 0)

/** 12.345 € → "12,3 mil €" para ejes. */
export const eurCorto = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${num.format(n / 1_000_000)} M€`
  if (a >= 1000) return `${num.format(n / 1000)} k€`
  return `${Math.round(n)} €`
}

export const pct = (n: number, dec = 0) =>
  `${(Number.isFinite(n) ? n * 100 : 0).toLocaleString('es-ES', { maximumFractionDigits: dec, minimumFractionDigits: dec })} %`

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export const etiquetaMes = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${MESES[m - 1]} ${String(y).slice(2)}`
}
export const etiquetaMesLarga = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${MESES_LARGOS[m - 1]} de ${y}`
}

export const sumarMeses = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
