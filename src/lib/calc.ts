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
  /** Coste anual medio (%) de lo invertido, ponderado por saldo. */
  costeMedio: number
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
  const costeMedio = invertido > 0 ? e.activos.filter((a) => a.tipo !== 'efectivo').reduce((s, a) => s + a.valor * (a.coste ?? 0), 0) / invertido : 0
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
    costeMedio,
  }
}

export interface MesFlujo {
  ym: string
  ano: number
  edad: number
  ingresos: number
  nomina: number
  ingresosAnuales: number
  ingresosExtra: number
  gastos: number
  alquiler: number
  familia: number
  otrosGastos: number
  extraordinarios: number
  aportaciones: number
  neto: number
  efectivo: number
  invertido: number
  patrimonio: number
  notas: string[]
}

/** Factor de crecimiento de un gasto en un mes dado de la previsión. */
function factorGasto(g: Gasto, e: Estado, ym: string, k: number): number {
  const a = e.ajustes
  const y = Number(ym.slice(0, 4))
  const y0 = Number(a.inicio.slice(0, 4))
  const modo = g.indexa ?? (g.categoria === 'Vivienda' ? 'alquiler' : 'ipc')
  if (modo === 'ninguna') return 1
  if (modo === 'alquiler') {
    // Sube en cada aniversario del contrato posterior al inicio de la previsión.
    let n = 0
    for (let j = 1; j <= k; j++) if (Number(sumarMeses(a.inicio, j).slice(5)) === a.mesSubidaAlquiler) n++
    return (1 + a.subidaAlquiler / 100) ** n
  }
  const pctAnual = modo === 'propia' ? g.subida ?? a.inflacionGastos : a.inflacionGastos
  const base = g.anoBase ?? y0
  return (1 + pctAnual / 100) ** Math.max(0, y - base)
}

/** Flujo de caja mes a mes con subidas salariales, actualización de gastos e inversión. */
export function flujo(e: Estado, meses = 24): MesFlujo[] {
  const r = resumir(e)
  const a = e.ajustes
  const y0 = Number(a.inicio.slice(0, 4))
  // Rentabilidad nominal mensual: base real + 2,5 % de inflación de referencia (fija, para que los escenarios de gastos no inflen la inversión).
  const rm = (1 + (a.rentBase - r.costeMedio + 2.5) / 100) ** (1 / 12) - 1
  let caja = r.efectivo
  let invertido = r.invertido
  const out: MesFlujo[] = []
  for (let k = 0; k < meses; k++) {
    const ym = sumarMeses(a.inicio, k)
    const y = Number(ym.slice(0, 4))
    const m = Number(ym.slice(5))
    const notas: string[] = []
    let nomina = 0
    let ingresosAnuales = 0
    let ingresosExtra = 0
    for (const i of e.ingresos) {
      const f = i.crece ? (1 + a.subidaSalario / 100) ** Math.max(0, y - y0) : 1
      if (i.frecuencia === 'mensual') nomina += i.importe * f
      else if ((i.mes ?? 1) === m) {
        ingresosAnuales += i.importe * f
        notas.push(`+ ${i.nombre}`)
      }
    }
    let alquiler = 0
    let familia = 0
    let otrosGastos = 0
    for (const g of e.gastos) {
      let imp = 0
      if (g.frecuencia === 'mensual') imp = g.importe
      else if (g.frecuencia === 'trimestral' && (m - 1) % 3 === ((g.mes ?? 1) - 1) % 3) imp = g.importe
      else if (g.frecuencia === 'anual' && (g.mes ?? 1) === m) {
        imp = g.importe
        if (g.importe) notas.push(`− ${g.nombre}`)
      }
      if (!imp) continue
      imp *= factorGasto(g, e, ym, k)
      if (g.categoria === 'Vivienda') alquiler += imp
      else if (g.categoria === 'Familia') familia += imp
      else otrosGastos += imp
    }
    let extraordinarios = 0
    for (const ev of e.eventos) if (ev.fecha === ym) {
      if (ev.tipo === 'gasto') extraordinarios += ev.importe
      else {
        ingresosExtra += ev.importe
        if (ev.activoId) {
          const act = e.activos.find((x) => x.id === ev.activoId)
          if (act) invertido = Math.max(0, invertido - act.valor)
        }
      }
      notas.push(`${ev.tipo === 'gasto' ? '−' : '+'} ${ev.nombre}`)
    }
    // Las aportaciones a colchón/piso se quedan en liquidez; las de fondos y pensión salen hacia la inversión.
    const aportaciones = e.aportaciones.filter((x) => x.destino === 'fondos' || x.destino === 'pension').reduce((s, x) => s + x.importe, 0)
    const ingresos = nomina + ingresosAnuales + ingresosExtra
    const gastos = alquiler + familia + otrosGastos
    const neto = ingresos - gastos - extraordinarios - aportaciones
    caja += neto
    invertido = invertido * (1 + rm) + aportaciones
    out.push({
      ym, ano: y, edad: a.edad + (y - y0), ingresos, nomina, ingresosAnuales, ingresosExtra, gastos, alquiler, familia, otrosGastos,
      extraordinarios, aportaciones, neto, efectivo: caja, invertido, patrimonio: caja + invertido, notas,
    })
  }
  return out
}

/** Meses de previsión hasta el final del último año del horizonte. */
export const mesesHorizonte = (e: Estado, anos = e.ajustes.anosPrevision) => {
  const m0 = Number(e.ajustes.inicio.slice(5))
  return 12 - m0 + 1 + anos * 12
}

export interface AnoFlujo {
  ano: number
  edad: number
  meses: number
  ingresos: number
  nomina: number
  ingresosAnuales: number
  ingresosExtra: number
  gastos: number
  alquiler: number
  familia: number
  otrosGastos: number
  extraordinarios: number
  aportaciones: number
  neto: number
  efectivo: number
  invertido: number
  patrimonio: number
  tasaAhorro: number
}

export function porAnos(f: MesFlujo[]): AnoFlujo[] {
  const m = new Map<number, MesFlujo[]>()
  for (const x of f) m.set(x.ano, [...(m.get(x.ano) ?? []), x])
  return [...m.entries()].map(([ano, l]) => {
    const sum = (k: keyof MesFlujo) => l.reduce((s, x) => s + (x[k] as number), 0)
    const last = l[l.length - 1]
    const ingresos = sum('ingresos')
    const gastos = sum('gastos')
    return {
      ano, edad: last.edad, meses: l.length, ingresos, nomina: sum('nomina'), ingresosAnuales: sum('ingresosAnuales'), ingresosExtra: sum('ingresosExtra'),
      gastos, alquiler: sum('alquiler'), familia: sum('familia'), otrosGastos: sum('otrosGastos'), extraordinarios: sum('extraordinarios'),
      aportaciones: sum('aportaciones'), neto: sum('neto'), efectivo: last.efectivo, invertido: last.invertido, patrimonio: last.patrimonio,
      tasaAhorro: ingresos > 0 ? (ingresos - gastos - sum('extraordinarios')) / ingresos : 0,
    }
  })
}

/** Copia del estado con los gastos llevados a su objetivo de recorte. */
export function conObjetivos(e: Estado): Estado {
  return {
    ...e,
    gastos: e.gastos.map((g) => {
      if (g.objetivo == null) return g
      const f = g.frecuencia === 'mensual' ? 1 : g.frecuencia === 'trimestral' ? 3 : 12
      return { ...g, importe: g.objetivo * f }
    }),
  }
}

export interface Estres {
  id: string
  nombre: string
  descripcion: string
  efectivoFinal: number
  patrimonioFinal: number
  minimoEfectivo: number
  mesMinimo: string
  diferencia: number
}

/** Escenarios de riesgo: misma previsión con un golpe aplicado. */
export function pruebasEstres(e: Estado): Estres[] {
  const n = mesesHorizonte(e)
  const base = flujo(e, n)
  const fin = base[base.length - 1]
  const r = resumir(e)
  const casos: { id: string; nombre: string; descripcion: string; est: Estado; ajusteInv?: number }[] = [
    { id: 'base', nombre: 'Previsión base', descripcion: 'Lo que tienes configurado.', est: e },
    {
      id: 'sin-variable',
      nombre: 'Sin variable',
      descripcion: 'El variable no se cobra ningún año.',
      est: { ...e, ingresos: e.ingresos.filter((i) => !(i.frecuencia === 'anual' && /variable/i.test(i.nombre))) },
    },
    {
      id: 'paro',
      nombre: '6 meses sin nómina',
      descripcion: 'Pierdes el empleo el próximo año durante 6 meses (sin contar el paro).',
      est: {
        ...e,
        eventos: [...e.eventos, { id: 'paro', nombre: 'Sin nómina 6 meses', importe: r.ingresoRecurrente * 6, fecha: sumarMeses(e.ajustes.inicio, 12), tipo: 'gasto' }],
      },
    },
    { id: 'alquiler', nombre: 'Alquiler +5 % al año', descripcion: 'El alquiler sube el doble de lo previsto (cambio de piso o fin del contrato).', est: { ...e, ajustes: { ...e.ajustes, subidaAlquiler: 5 } } },
    { id: 'inflacion', nombre: 'Inflación del 4 %', descripcion: 'Los gastos corrientes suben un 4 % al año y el sueldo solo un 1 %.', est: { ...e, ajustes: { ...e.ajustes, inflacionGastos: 4 } } },
    { id: 'bolsa', nombre: 'Caída de bolsa del 30 %', descripcion: 'Tus fondos y el plan de pensiones caen un 30 % el primer año y no recuperan en el periodo.', est: e, ajusteInv: 0.7 },
  ]
  return casos.map((c) => {
    const f = flujo(c.est, n)
    const ult = f[f.length - 1]
    const inv = c.ajusteInv != null ? ult.invertido * c.ajusteInv : ult.invertido
    const min = f.reduce((m, x) => (x.efectivo < m.efectivo ? x : m), f[0])
    const patrimonioFinal = ult.efectivo + inv
    return { id: c.id, nombre: c.nombre, descripcion: c.descripcion, efectivoFinal: ult.efectivo, patrimonioFinal, minimoEfectivo: min.efectivo, mesMinimo: min.ym, diferencia: patrimonioFinal - fin.patrimonio }
  })
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
    // Rentabilidad del mercado menos lo que te cobran los fondos.
    const v = (rp: number) => inicial * (1 + (rp - r.costeMedio) / 100) ** n + fvAnualidad(anual, (rp - r.costeMedio) / 100, n)
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
  const factor = fvAnualidad(1, (e.ajustes.rentBase - resumir(e).costeMedio) / 100, n)
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
