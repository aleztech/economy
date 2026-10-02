import type { Estado, Gasto, Categoria } from './types'
import { sumarMeses } from './format'

/** Importe mensual equivalente de un gasto. */
export const mensual = (g: Pick<Gasto, 'importe' | 'frecuencia'>) =>
  g.frecuencia === 'mensual' ? g.importe : g.frecuencia === 'trimestral' ? g.importe / 3 : g.importe / 12

export interface Resumen {
  ingresoRecurrente: number
  ingresoAnual: number
  ingresoMedioMes: number
  gastoMes: number
  gastoFijoMes: number
  gastoVariableMes: number
  aportMes: number
  aportFondos: number
  aportPension: number
  resultadoMes: number
  excedenteMes: number
  tasaAhorro: number
  porCategoria: { categoria: Categoria; importe: number }[]
  vivienda: number
  efectivo: number
  invertido: number
  liquidoInvertido: number
  patrimonio: number
  mesesColchon: number
  gastosSinRellenar: number
}

export function resumir(e: Estado): Resumen {
  const ingresoRecurrente = e.ingresos.filter((i) => i.frecuencia === 'mensual').reduce((s, i) => s + i.importe, 0)
  const ingresoAnual = ingresoRecurrente * 12 + e.ingresos.filter((i) => i.frecuencia === 'anual').reduce((s, i) => s + i.importe, 0)
  const ingresoMedioMes = ingresoAnual / 12
  const gastoMes = e.gastos.reduce((s, g) => s + mensual(g), 0)
  const gastoFijoMes = e.gastos.filter((g) => g.fijo).reduce((s, g) => s + mensual(g), 0)
  const aportFondos = e.aportaciones.filter((a) => a.destino === 'fondos').reduce((s, a) => s + a.importe, 0)
  const aportPension = e.aportaciones.filter((a) => a.destino === 'pension').reduce((s, a) => s + a.importe, 0)
  const aportMes = e.aportaciones.reduce((s, a) => s + a.importe, 0)
  const resultadoMes = ingresoMedioMes - gastoMes
  const mapa = new Map<Categoria, number>()
  for (const g of e.gastos) mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + mensual(g))
  const porCategoria = [...mapa.entries()]
    .map(([categoria, importe]) => ({ categoria, importe }))
    .filter((c) => c.importe > 0)
    .sort((a, b) => b.importe - a.importe)
  const efectivo = e.activos.filter((a) => a.tipo === 'efectivo').reduce((s, a) => s + a.valor, 0)
  const invertido = e.activos.filter((a) => a.tipo !== 'efectivo').reduce((s, a) => s + a.valor, 0)
  const liquidoInvertido = e.activos.filter((a) => a.tipo !== 'efectivo' && a.liquido).reduce((s, a) => s + a.valor, 0)
  return {
    ingresoRecurrente,
    ingresoAnual,
    ingresoMedioMes,
    gastoMes,
    gastoFijoMes,
    gastoVariableMes: gastoMes - gastoFijoMes,
    aportMes,
    aportFondos,
    aportPension,
    resultadoMes,
    excedenteMes: resultadoMes - aportMes,
    tasaAhorro: ingresoMedioMes > 0 ? resultadoMes / ingresoMedioMes : 0,
    porCategoria,
    vivienda: mapa.get('Vivienda') ?? 0,
    efectivo,
    invertido,
    liquidoInvertido,
    patrimonio: efectivo + invertido,
    mesesColchon: gastoMes > 0 ? efectivo / gastoMes : Infinity,
    gastosSinRellenar: e.gastos.filter((g) => !g.importe).length,
  }
}

export interface MesFlujo {
  ym: string
  ingresos: number
  gastos: number
  extraordinarios: number
  aportaciones: number
  neto: number
  efectivo: number
  notas: string[]
}

/** Flujo de caja mes a mes: lo que entra y sale de tu cuenta y cómo evoluciona la liquidez. */
export function flujo(e: Estado, meses = 24): MesFlujo[] {
  const r = resumir(e)
  let caja = r.efectivo
  const out: MesFlujo[] = []
  for (let k = 0; k < meses; k++) {
    const ym = sumarMeses(e.ajustes.inicio, k)
    const m = Number(ym.slice(5))
    const notas: string[] = []
    let ingresos = r.ingresoRecurrente
    for (const i of e.ingresos) if (i.frecuencia === 'anual' && (i.mes ?? 1) === m) {
      ingresos += i.importe
      notas.push(`+ ${i.nombre}`)
    }
    let gastos = 0
    for (const g of e.gastos) {
      if (g.frecuencia === 'mensual') gastos += g.importe
      else if (g.frecuencia === 'trimestral' && (m - 1) % 3 === ((g.mes ?? 1) - 1) % 3) gastos += g.importe
      else if (g.frecuencia === 'anual' && (g.mes ?? 1) === m) {
        gastos += g.importe
        if (g.importe) notas.push(`− ${g.nombre}`)
      }
    }
    let extraordinarios = 0
    for (const ev of e.eventos) if (ev.fecha === ym) {
      if (ev.tipo === 'gasto') extraordinarios += ev.importe
      else ingresos += ev.importe
      notas.push(`${ev.tipo === 'gasto' ? '−' : '+'} ${ev.nombre}`)
    }
    // Las aportaciones a colchón/piso se quedan en liquidez; las de fondos y pensión salen.
    const aportaciones = e.aportaciones.filter((a) => a.destino === 'fondos' || a.destino === 'pension').reduce((s, a) => s + a.importe, 0)
    const neto = ingresos - gastos - extraordinarios - aportaciones
    caja += neto
    out.push({ ym, ingresos, gastos, extraordinarios, aportaciones, neto, efectivo: caja, notas })
  }
  return out
}

/** Valor futuro de una aportación anual constante a tipo r durante n años (fin de año). */
export const fvAnualidad = (pago: number, r: number, n: number) => (r === 0 ? pago * n : (pago * ((1 + r) ** n - 1)) / r)

export interface PuntoProyeccion {
  edad: number
  pes: number
  base: number
  opt: number
  objetivo: number
  aportado: number
}

/** Proyección en euros de hoy (rentabilidad real) de todo lo invertido a largo plazo. */
export function proyeccion(e: Estado, extraMensual = 0): PuntoProyeccion[] {
  const r = resumir(e)
  const a = e.ajustes
  const inicial = r.invertido
  const anual = (r.aportFondos + r.aportPension + extraMensual) * 12
  const objetivo = objetivoJubilacion(e)
  const out: PuntoProyeccion[] = []
  for (let n = 0; n <= Math.max(0, a.edadJubilacion - a.edad); n++) {
    const v = (rp: number) => inicial * (1 + rp / 100) ** n + fvAnualidad(anual, rp / 100, n)
    out.push({ edad: a.edad + n, pes: v(a.rentPes), base: v(a.rentBase), opt: v(a.rentOpt), objetivo, aportado: inicial + anual * n })
  }
  return out
}

/** Capital necesario (euros de hoy) para pagar la vivienda actual con la tasa de retirada. */
export const objetivoJubilacion = (e: Estado) => (resumir(e).vivienda * 12) / (e.ajustes.tasaRetiro / 100)

/** Aportación mensual extra necesaria para llegar al objetivo en el escenario base. */
export function aportacionNecesaria(e: Estado): number {
  const p = proyeccion(e)
  const fin = p[p.length - 1]
  const falta = fin.objetivo - fin.base
  if (falta <= 0) return 0
  const n = e.ajustes.edadJubilacion - e.ajustes.edad
  const factor = fvAnualidad(1, e.ajustes.rentBase / 100, n)
  return factor > 0 ? falta / factor / 12 : Infinity
}

export const cuotaHipoteca = (capital: number, tipoAnual: number, anos: number) => {
  const i = tipoAnual / 100 / 12
  const n = anos * 12
  return i === 0 ? capital / n : (capital * i) / (1 - (1 + i) ** -n)
}

export interface PlanPiso {
  necesario: number
  entrada: number
  gastosCompra: number
  colchon: number
  disponibleHoy: number
  fecha: string | null
  mesesHasta: number | null
  capital: number
  cuota: number
  costeMensualPropietario: number
  serie: { ym: string; disponible: number; necesario: number }[]
}

export function planPiso(e: Estado): PlanPiso {
  const a = e.ajustes
  const r = resumir(e)
  const entrada = (a.precioPiso * a.entradaPct) / 100
  const gastosCompra = (a.precioPiso * a.gastosCompraPct) / 100
  const colchon = r.gastoMes * a.colchonMeses
  const necesario = entrada + gastosCompra + colchon
  const extra = a.usarFondosParaPiso ? r.liquidoInvertido : 0
  const f = flujo(e, 12 * 12)
  const serie = f.filter((_, k) => k % 3 === 0).map((m) => ({ ym: m.ym, disponible: m.efectivo + extra, necesario }))
  const hit = f.find((m) => m.efectivo + extra >= necesario)
  const capital = a.precioPiso - entrada
  const cuota = cuotaHipoteca(capital, a.tipoHipoteca, a.plazoHipoteca)
  return {
    necesario,
    entrada,
    gastosCompra,
    colchon,
    disponibleHoy: r.efectivo + extra,
    fecha: r.efectivo + extra >= necesario ? a.inicio : hit?.ym ?? null,
    mesesHasta: r.efectivo + extra >= necesario ? 0 : hit ? f.indexOf(hit) + 1 : null,
    capital,
    cuota,
    costeMensualPropietario: cuota + a.gastosPropietarioMes + (a.precioPiso * a.mantenimientoPct) / 100 / 12,
    serie,
  }
}

/** Alquiler frente a hipoteca, en euros nominales, a lo largo del plazo. */
export function alquilerVsCompra(e: Estado) {
  const a = e.ajustes
  const r = resumir(e)
  const p = planPiso(e)
  const out: { ano: number; edad: number; alquiler: number; propiedad: number; acumAlquiler: number; acumPropiedad: number }[] = []
  let acA = 0
  let acP = 0
  for (let n = 0; n <= a.plazoHipoteca + 5; n++) {
    const alquiler = r.vivienda * (1 + a.subidaAlquiler / 100) ** n
    const mant = (a.precioPiso * a.mantenimientoPct) / 100 / 12
    const gastosProp = (a.gastosPropietarioMes + mant) * (1.025 ** n)
    const propiedad = (n < a.plazoHipoteca ? p.cuota : 0) + gastosProp
    acA += alquiler * 12
    acP += propiedad * 12
    out.push({ ano: n, edad: a.edad + n, alquiler, propiedad, acumAlquiler: acA, acumPropiedad: acP })
  }
  return out
}
