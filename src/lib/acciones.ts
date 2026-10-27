/**
 * Plan de acción: pasos concretos, con importes, fechas y las cuentas que tienes, calculados con tus datos.
 */
import type { Estado, Ingreso } from './types'
import { conObjetivos, cuadroPrestamo, flujo, mensual, mesesHorizonte, porAnos, resumir } from './calc'
import { analizar } from './movimientos'
import { eur, etiquetaMesLarga, sumarMeses } from './format'

export type TipoAccion = 'recorte' | 'automatizar' | 'colchon' | 'deuda' | 'inversion' | 'suscripcion' | 'aviso'

export interface Accion {
  id: string
  tipo: TipoAccion
  titulo: string
  detalle: string
  /** Mes (AAAA-MM) en que toca, si es puntual. */
  cuando?: string
  /** Euros al mes que liberas o mueves. */
  mes?: number
  /** Euros al año. */
  ano?: number
}

export interface Plan {
  acciones: Accion[]
  ahorroHoy: number
  ahorroPlan: number
  patrimonioHoy: number
  patrimonioPlan: number
  edadFin: number
  liberasMes: number
}

const proximoMes = (inicio: string, mes: number) => {
  for (let k = 0; k < 12; k++) {
    const ym = sumarMeses(inicio, k)
    if (Number(ym.slice(5)) === mes) return ym
  }
  return inicio
}

const nombreCuenta = (e: Estado, re: RegExp, porDefecto: string) => e.activos.find((a) => re.test(a.nombre))?.nombre ?? porDefecto

export function planDeAccion(e: Estado): Plan {
  const a = e.ajustes
  const r = resumir(e)
  const plan = conObjetivos(e)
  const rp = resumir(plan)
  const n = mesesHorizonte(e)
  const aHoy = porAnos(flujo(e, n))
  const finHoy = aHoy[aHoy.length - 1]
  const aPlan = porAnos(flujo(plan, n))
  const finPlan = aPlan[aPlan.length - 1]
  const acciones: Accion[] = []
  const cuentaEfectivo = nombreCuenta(e, /revolut|remunerada|efectivo/i, 'tu cuenta remunerada')

  // 1. Recortes concretos por gasto, de mayor a menor.
  const recortes = e.gastos
    .map((g) => ({ g, actual: mensual(g), obj: g.objetivo }))
    .filter((x) => x.obj != null && x.obj < x.actual - 1)
    .map((x) => ({ ...x, libera: x.actual - x.obj! }))
    .sort((x, y) => y.libera - x.libera)
  for (const x of recortes.slice(0, 7))
    acciones.push({
      id: `recorte-${x.g.id}`,
      tipo: 'recorte',
      titulo: `${x.g.nombre}: de ${eur(x.actual)} a ${eur(x.obj!)} al mes`,
      detalle: x.g.nota ? x.g.nota : 'Fija un tope mensual y págalo desde un bolsillo con ese importe.',
      mes: x.libera,
      ano: x.libera * 12,
    })
  const resto = recortes.slice(7)
  if (resto.length)
    acciones.push({
      id: 'recorte-resto',
      tipo: 'recorte',
      titulo: `${resto.length} recortes pequeños más`,
      detalle: resto.map((x) => `${x.g.nombre} (−${eur(x.libera)})`).join(', '),
      mes: resto.reduce((s, x) => s + x.libera, 0),
      ano: resto.reduce((s, x) => s + x.libera, 0) * 12,
    })
  const liberasMes = recortes.reduce((s, x) => s + x.libera, 0)

  // 2. Automatizar el ahorro el día de cobro: lo que sobra con el plan después de las aportaciones.
  const automatico = Math.max(0, Math.floor(Math.min(liberasMes, rp.excedenteMes) / 10) * 10)
  if (automatico > 20)
    acciones.push({
      id: 'automatizar',
      tipo: 'automatizar',
      titulo: `Programa ${eur(automatico)} al mes a un bolsillo de ahorro el día que cobras`,
      detalle: `En ${cuentaEfectivo}: transferencia periódica el día de la nómina a un bolsillo aparte, además de tus ${eur(r.aportMes)} de aportaciones. Es lo que te sobra con los recortes. Si a final de mes tienes que sacar de ahí, es que no se están cumpliendo.`,
      ano: automatico * 12,
    })

  // 3. Aportaciones frente a lo que sobra.
  const fondos = [...e.aportaciones].filter((x) => x.destino === 'fondos').sort((x, y) => y.importe - x.importe)
  if (r.excedenteMes < 0 && fondos[0]) {
    const falta = -r.excedenteMes
    if (rp.excedenteMes >= 0)
      acciones.push({
        id: 'aportaciones',
        tipo: 'aviso',
        titulo: `Mantén tus ${eur(r.aportMes)} de aportaciones solo si cumples los recortes`,
        detalle: `Con tu gasto actual inviertes ${eur(falta)} al mes más de lo que te sobra y lo sacas de la liquidez. Con los recortes te sobran ${eur(rp.excedenteMes)} después de invertir. Si en dos meses no los cumples, baja ${fondos[0].nombre} de ${eur(fondos[0].importe)} a ${eur(Math.max(0, fondos[0].importe - falta))}.`,
        mes: falta,
      })
    else
      acciones.push({
        id: 'aportaciones',
        tipo: 'aviso',
        titulo: `Baja ${fondos[0].nombre} de ${eur(fondos[0].importe)} a ${eur(Math.max(0, fondos[0].importe - (-rp.excedenteMes)))} al mes`,
        detalle: `Aun con los recortes inviertes más de lo que te sobra. Mantén el plan de pensiones (desgrava) y ajusta los fondos.`,
        mes: -rp.excedenteMes,
      })
  }

  // 3b. Ingresos mensuales que se acaban pronto: no los gastes, apártalos.
  const hoy = a.inicio
  let apartado = 0
  for (const i of e.ingresos.filter((x) => x.frecuencia === 'mensual' && x.hasta && x.hasta >= hoy && x.hasta <= sumarMeses(hoy, 11))) {
    const meses = Array.from({ length: 12 }, (_, k) => sumarMeses(hoy, k)).filter((ym) => (!i.desde || ym >= i.desde) && ym <= i.hasta!).length
    apartado += i.importe * meses
    acciones.push({
      id: `temporal-${i.id}`,
      tipo: 'colchon',
      titulo: `Aparta los ${eur(i.importe * meses)} de ${i.nombre} (hasta ${etiquetaMesLarga(i.hasta!)})`,
      detalle: `Es un ingreso que se acaba: no lo uses para vivir. Muévelo a ${cuentaEfectivo} el mismo día que entra, así no te acostumbras a ese nivel de gasto.`,
      cuando: i.hasta,
    })
  }

  // 4. Colchón, préstamo e inversión con los ingresos anuales (variable, devolución del IRPF).
  const colchonObj = r.gastoMes * a.colchonMeses
  let faltaColchon = Math.max(0, colchonObj - r.efectivo - apartado)
  const anuales = e.ingresos
    .filter((i): i is Ingreso & { mes: number } => i.frecuencia === 'anual' && i.importe > 0 && i.mes != null)
    .map((i) => ({ i, ym: proximoMes(a.inicio, i.mes) }))
    .sort((x, y) => x.ym.localeCompare(y.ym))
  const anticipos = (e.prestamos ?? []).flatMap((p) => p.amortizaciones.map((am) => ({ p, am })))
  for (const { i, ym } of anuales) {
    let disponible = i.importe
    const partes: string[] = []
    const amortMes = anticipos.filter((x) => x.am.fecha === ym)
    for (const { p, am } of amortMes) {
      const c = cuadroPrestamo(p)
      const sin = cuadroPrestamo({ ...p, amortizaciones: p.amortizaciones.filter((y) => y.id !== am.id) })
      const ahorro = sin.intereses - c.intereses
      const imp = Math.min(am.importe, disponible)
      disponible -= imp
      partes.push(`${eur(imp)} a amortizar ${p.nombre} (reduce ${am.modo === 'plazo' ? 'plazo' : 'cuota'}; ahorras ~${eur(ahorro)} de intereses y terminas en ${etiquetaMesLarga(c.fin)})`)
    }
    if (faltaColchon > 0 && disponible > 0) {
      const imp = Math.min(faltaColchon, disponible)
      disponible -= imp
      faltaColchon -= imp
      partes.push(`${eur(imp)} al colchón en ${cuentaEfectivo}`)
    }
    if (disponible > 50) partes.push(`${eur(disponible)} a ${fondos[0]?.nombre ?? 'tus fondos indexados'}`)
    acciones.push({
      id: `anual-${i.id}`,
      tipo: amortMes.length ? 'deuda' : faltaColchon > 0 ? 'colchon' : 'inversion',
      titulo: `${i.nombre} de ${etiquetaMesLarga(ym)} (${eur(i.importe)}): repártelo el mismo día`,
      detalle: partes.join(' · ') + '. Muévelo antes de que se mezcle con la cuenta del día a día.',
      cuando: ym,
    })
  }
  if (faltaColchon > 0)
    acciones.push({
      id: 'colchon',
      tipo: 'colchon',
      titulo: `Completa el colchón: te faltan ${eur(faltaColchon)} para ${a.colchonMeses} meses de gastos`,
      detalle: `Objetivo ${eur(colchonObj)} en ${cuentaEfectivo}. ${automatico > 20 ? `Con los ${eur(automatico)} al mes del ahorro automático lo cubres en ${Math.ceil(faltaColchon / automatico)} meses.` : 'Hasta tenerlo, no subas aportaciones ni hagas compras grandes.'}`,
    })

  // 5. Bache de liquidez que queda incluso con el plan.
  const fp = flujo(plan, 24)
  const min = fp.reduce((m, x) => (x.efectivo < m.efectivo ? x : m), fp[0])
  if (min && min.efectivo < rp.gastoMes * 3)
    acciones.push({
      id: 'bache',
      tipo: 'aviso',
      titulo: `Aun con el plan, en ${etiquetaMesLarga(min.ym)} te quedas con ${eur(min.efectivo)}`,
      detalle: `Por debajo de 3 meses de gastos (${eur(rp.gastoMes * 3)}). ${min.notas.length ? `Ese mes: ${min.notas.join(', ')}. ` : ''}Retrasa ese pago o reduce las aportaciones los meses anteriores.`,
      cuando: min.ym,
    })

  // 6. Suscripciones activas detectadas en tus extractos.
  const an = e.movimientos?.length ? analizar(e.movimientos, sumarMeses(e.movimientos[e.movimientos.length - 1].fecha.slice(0, 7), -6) + '-01') : null
  const activas = an?.suscripciones.filter((s) => s.activa && s.mes >= 5) ?? []
  if (activas.length) {
    const claude = activas.find((s) => /claude/i.test(s.nombre) && s.mes > 150)
    acciones.push({
      id: 'suscripciones',
      tipo: 'suscripcion',
      titulo: `Revisa ${activas.length} cargos periódicos activos: ${eur(activas.reduce((s, x) => s + x.mes, 0))} al mes`,
      detalle:
        activas.map((s) => `${s.nombre} ${eur(s.mes, true)}`).join(' · ') +
        (claude ? `. Claude: prueba un mes el Max 5x (≈108,90 €) en vez del 20x; si no llegas a los límites, son ~${eur((claude.mes - 108.9) * 12)} al año.` : '. Cancela lo que no usaste el mes pasado.'),
      mes: claude ? claude.mes - 108.9 : undefined,
    })
  }

  return {
    acciones,
    ahorroHoy: r.resultadoMes,
    ahorroPlan: rp.resultadoMes,
    patrimonioHoy: finHoy.patrimonio,
    patrimonioPlan: finPlan.patrimonio,
    edadFin: finPlan.edad,
    liberasMes,
  }
}
