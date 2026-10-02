import type { Estado } from './types'
import { DISCRECIONALES } from './types'
import { resumir, flujo, proyeccion, aportacionNecesaria, planPiso, fvAnualidad, mensual, porAnos, mesesHorizonte } from './calc'
import { eur, pct, etiquetaMesLarga } from './format'

export type Nivel = 'alta' | 'media' | 'info' | 'ok'

export interface Recomendacion {
  id: string
  nivel: Nivel
  area: 'Gastos' | 'Ahorro' | 'Inversión' | 'Fiscalidad' | 'Vivienda' | 'Liquidez' | 'Jubilación'
  titulo: string
  texto: string
  /** Euros al año que mueve la recomendación, para ordenar. */
  impacto?: number
}

const ORDEN: Record<Nivel, number> = { alta: 0, media: 1, info: 2, ok: 3 }

/** Reglas que se recalculan con cada cambio de ingresos, gastos o patrimonio. */
export function recomendar(e: Estado): Recomendacion[] {
  const r = resumir(e)
  const a = e.ajustes
  const anos = Math.max(1, a.edadJubilacion - a.edad)
  const rb = a.rentBase / 100
  const alJubilarte = (mensualEur: number) => fvAnualidad(mensualEur * 12, rb, anos)
  const out: Recomendacion[] = []

  // 1. Datos incompletos
  if (r.gastosSinRellenar > 0) {
    out.push({
      id: 'sin-rellenar',
      nivel: 'alta',
      area: 'Gastos',
      titulo: `Te faltan ${r.gastosSinRellenar} gastos por rellenar`,
      texto: 'Mientras estén a cero, la tasa de ahorro y las previsiones salen más optimistas de lo real. Empieza por comida, transporte y suscripciones, que suelen ser los más grandes.',
    })
  }

  // 2. Resultado negativo
  if (r.resultadoMes < 0) {
    out.push({
      id: 'deficit',
      nivel: 'alta',
      area: 'Ahorro',
      titulo: 'Gastas más de lo que ingresas',
      texto: `En media mensual te faltan ${eur(-r.resultadoMes)}. Cada mes así sale de tu colchón.`,
      impacto: -r.resultadoMes * 12,
    })
  } else if (r.excedenteMes < 0) {
    out.push({
      id: 'aportaciones-altas',
      nivel: 'media',
      area: 'Ahorro',
      titulo: 'Tus aportaciones superan lo que te sobra',
      texto: `Inviertes ${eur(r.aportMes)} al mes pero solo te sobran ${eur(r.resultadoMes)}. La diferencia (${eur(-r.excedenteMes)}) la estás sacando de la liquidez.`,
    })
  }

  // 3. Tasa de ahorro
  if (r.ingresoMedioMes > 0 && r.resultadoMes >= 0 && r.gastosSinRellenar === 0) {
    const t = r.tasaAhorro
    if (t < 0.1)
      out.push({ id: 'tasa', nivel: 'alta', area: 'Ahorro', titulo: `Tasa de ahorro baja: ${pct(t)}`, texto: 'Por debajo del 10 % cualquier imprevisto te descuadra. Objetivo razonable con tus ingresos: 20 % o más.' })
    else if (t < 0.2)
      out.push({ id: 'tasa', nivel: 'media', area: 'Ahorro', titulo: `Tasa de ahorro mejorable: ${pct(t)}`, texto: `Subir al 20 % supondría ahorrar ${eur((0.2 - t) * r.ingresoMedioMes)} más al mes.`, impacto: (0.2 - t) * r.ingresoMedioMes * 12 })
    else out.push({ id: 'tasa', nivel: 'ok', area: 'Ahorro', titulo: `Tasa de ahorro sana: ${pct(t)}`, texto: 'Ahorras una quinta parte o más de lo que ingresas. Lo importante ahora es que ese dinero tenga destino.' })
  }

  // 4. Excedente sin destino
  if (r.excedenteMes > 300) {
    out.push({
      id: 'excedente',
      nivel: 'info',
      area: 'Ahorro',
      titulo: `${eur(r.excedenteMes)} al mes sin destino`,
      texto: `Es dinero que se acumula en cuenta. Asignado a inversión serían unos ${eur(alJubilarte(r.excedenteMes))} de hoy a los ${a.edadJubilacion}; asignado al piso, adelantas la compra.`,
      impacto: r.excedenteMes * 12,
    })
  }

  // 5. Peso de la vivienda
  if (r.ingresoMedioMes > 0 && r.vivienda > 0) {
    const pv = r.vivienda / r.ingresoMedioMes
    if (pv > 0.35) out.push({ id: 'vivienda', nivel: 'alta', area: 'Vivienda', titulo: `La vivienda se lleva el ${pct(pv)} de tus ingresos`, texto: 'Por encima del 35 % queda poco margen. Es la palanca más grande que tienes.' })
    else if (pv > 0.3) out.push({ id: 'vivienda', nivel: 'media', area: 'Vivienda', titulo: `Vivienda: ${pct(pv)} de tus ingresos`, texto: 'En el límite de lo recomendable (30 %). Vigila que las subidas anuales se queden en el IRAV.' })
  }

  // 6. Colchón
  if (r.gastoMes > 0) {
    if (r.mesesColchon < 3) out.push({ id: 'colchon', nivel: 'alta', area: 'Liquidez', titulo: `Colchón de solo ${r.mesesColchon.toFixed(1)} meses`, texto: `Para 6 meses de gastos necesitas ${eur(r.gastoMes * 6)} en efectivo. Prioriza esto antes de invertir más.` })
    else if (r.mesesColchon < 6) out.push({ id: 'colchon', nivel: 'media', area: 'Liquidez', titulo: `Colchón de ${r.mesesColchon.toFixed(1)} meses`, texto: `Te faltan ${eur(r.gastoMes * 6 - r.efectivo)} para llegar a 6 meses de gastos.` })
    else if (r.mesesColchon > 12 && !e.aportaciones.some((x) => x.destino === 'piso'))
      out.push({ id: 'colchon', nivel: 'info', area: 'Liquidez', titulo: `${r.mesesColchon.toFixed(0)} meses de gastos en efectivo`, texto: 'Si no lo reservas para el piso, lo que pasa de 6-9 meses pierde valor con la inflación. Una cuenta remunerada o un fondo monetario al menos lo protege.' })
    else out.push({ id: 'colchon', nivel: 'ok', area: 'Liquidez', titulo: `Colchón cubierto: ${r.mesesColchon.toFixed(1)} meses`, texto: 'Tienes margen para imprevistos sin tocar las inversiones.' })
  }

  // 7. Gastos extraordinarios que no cubre la liquidez
  const f = flujo(e, 18)
  const minimo = f.reduce((m, x) => (x.efectivo < m.efectivo ? x : m), f[0])
  if (minimo && minimo.efectivo < r.gastoMes * 3) {
    out.push({
      id: 'bache',
      nivel: minimo.efectivo < 0 ? 'alta' : 'media',
      area: 'Liquidez',
      titulo: `Tu liquidez baja a ${eur(minimo.efectivo)} en ${etiquetaMesLarga(minimo.ym)}`,
      texto: 'Los gastos extraordinarios de la previsión te dejan con menos de 3 meses de colchón. Retrasa alguno o reduce aportaciones esos meses.',
    })
  }

  // 8. Fondos caros
  for (const act of e.activos) {
    if ((act.coste ?? 0) >= 1 && act.valor > 0) {
      const n = Math.min(20, anos)
      const perdida = act.valor * ((1 + rb) ** n - (1 + rb - ((act.coste ?? 0) - 0.2) / 100) ** n)
      out.push({
        id: `coste-${act.id}`,
        nivel: 'media',
        area: 'Inversión',
        titulo: `${act.nombre}: coste del ${String(act.coste).replace('.', ',')} % al año`,
        texto: `Frente a un indexado al 0,2 %, te cuesta unos ${eur(perdida)} en ${n} años solo con el saldo actual. Un traspaso entre fondos no tributa.`,
        impacto: perdida / n,
      })
    }
  }

  // 9. Concentración en productos ilíquidos o alternativos
  const alt = e.activos.filter((x) => x.tipo === 'alternativo').reduce((s, x) => s + x.valor, 0)
  if (r.patrimonio > 0 && alt / r.patrimonio > 0.1)
    out.push({ id: 'alternativo', nivel: 'media', area: 'Inversión', titulo: `${pct(alt / r.patrimonio)} en inversiones alternativas`, texto: 'Crowdfunding y similares son ilíquidos y con riesgo de impago. Mejor que no pasen del 5-10 % del total.' })

  // 10. Plan de pensiones y desgravación
  const pensionAnual = r.aportPension * 12
  if (pensionAnual < 1500) {
    const hueco = 1500 - pensionAnual
    out.push({
      id: 'pension',
      nivel: 'media',
      area: 'Fiscalidad',
      titulo: `Te quedan ${eur(hueco)} de aportación desgravable al plan de pensiones`,
      texto: `Con un tipo marginal del ${a.tipoMarginal} %, aportar ${eur(hueco / 12)} al mes te devuelve unos ${eur((hueco * a.tipoMarginal) / 100)} en la renta. Si aportas de golpe, hazlo antes del 31 de diciembre.`,
      impacto: (hueco * a.tipoMarginal) / 100,
    })
  } else {
    out.push({ id: 'pension', nivel: 'ok', area: 'Fiscalidad', titulo: 'Aprovechas la desgravación del plan de pensiones', texto: 'Llegas al máximo de 1.500 € al año.' })
  }

  // 11. Ingresos anuales: qué hacer con ellos
  const anuales = e.ingresos.filter((i) => i.frecuencia === 'anual' && i.importe > 0)
  if (anuales.length) {
    const total = anuales.reduce((s, i) => s + i.importe, 0)
    out.push({
      id: 'anuales',
      nivel: 'info',
      area: 'Ahorro',
      titulo: `Decide hoy el destino de ${eur(total)} de ingresos extra al año`,
      texto: `${anuales.map((i) => i.nombre).join(', ')}. Si tu prioridad es el piso, guárdalos sin riesgo (cuenta remunerada o monetario); si es la jubilación, a indexados. Sin plan, se diluyen en gasto.`,
    })
  }

  // 12. Objetivo de jubilación
  const p = proyeccion(e)
  const fin = p[p.length - 1]
  if (fin && fin.objetivo > 0) {
    const nec = aportacionNecesaria(e)
    if (nec > 0)
      out.push({
        id: 'jubilacion',
        nivel: nec > 300 ? 'alta' : 'media',
        area: 'Jubilación',
        titulo: `Te faltan ${eur(fin.objetivo - fin.base)} para cubrir la vivienda a los ${a.edadJubilacion}`,
        texto: `Con un ${a.rentBase} % real llegarías a ${eur(fin.base)}. Para cubrir el alquiler con un retiro del ${a.tasaRetiro} % necesitas ${eur(fin.objetivo)}: aporta ${eur(nec)} más al mes.`,
        impacto: nec * 12,
      })
    else
      out.push({ id: 'jubilacion', nivel: 'ok', area: 'Jubilación', titulo: `Objetivo de jubilación cubierto (${eur(fin.base)})`, texto: `En el escenario base superas los ${eur(fin.objetivo)} que necesitas para pagar la vivienda con tu cartera. En el pesimista llegarías a ${eur(fin.pes)}.` })
  }

  // 13. Mayor gasto recortable
  const disc = e.gastos.filter((g) => DISCRECIONALES.includes(g.categoria) && g.importe > 0).sort((x, y) => mensual(y) - mensual(x))
  if (disc[0]) {
    const g = disc[0]
    const recorte = mensual(g) * 0.2
    out.push({
      id: 'recorte',
      nivel: 'info',
      area: 'Gastos',
      titulo: `Recortar un 20 % en ${g.nombre.toLowerCase()} = ${eur(recorte)} al mes`,
      texto: `Es tu mayor gasto recortable. Invertido, serían ${eur(alJubilarte(recorte))} de hoy a los ${a.edadJubilacion}.`,
      impacto: recorte * 12,
    })
  }

  // 14. Suscripciones
  const subs = e.gastos.filter((g) => g.categoria === 'Suscripciones').reduce((s, g) => s + mensual(g), 0)
  if (subs > 60)
    out.push({ id: 'subs', nivel: 'media', area: 'Gastos', titulo: `${eur(subs)} al mes en suscripciones`, texto: `Son ${eur(subs * 12)} al año. Revisa cuáles no usaste el último mes y cancélalas o pásalas a plan anual.`, impacto: subs * 12 * 0.3 })

  // 15. Objetivos de optimización fijados
  const ahorroObj = e.gastos.reduce((s, g) => s + (g.objetivo != null && g.objetivo < mensual(g) ? mensual(g) - g.objetivo : 0), 0)
  if (ahorroObj > 0)
    out.push({ id: 'objetivos', nivel: 'info', area: 'Gastos', titulo: `Tus objetivos de recorte liberan ${eur(ahorroObj)} al mes`, texto: `Al año son ${eur(ahorroObj * 12)}. Si los cumples e inviertes la diferencia: ${eur(alJubilarte(ahorroObj))} de hoy a los ${a.edadJubilacion}.`, impacto: ahorroObj * 12 })

  // 16. Piso
  const pp = planPiso(e)
  if (pp.fecha)
    out.push({ id: 'piso', nivel: 'info', area: 'Vivienda', titulo: `Entrada del piso: ${pp.mesesHasta === 0 ? 'ya la tienes' : etiquetaMesLarga(pp.fecha)}`, texto: `Necesitas ${eur(pp.necesario)} (entrada, gastos y colchón) para un piso de ${eur(a.precioPiso)}. Cuota estimada: ${eur(pp.cuota)} al mes a ${a.plazoHipoteca} años.` })
  else
    out.push({ id: 'piso', nivel: 'media', area: 'Vivienda', titulo: 'Con el ritmo actual no llegas a la entrada en 12 años', texto: `Necesitas ${eur(pp.necesario)}. Guarda los ingresos extra para el piso o baja el precio objetivo.` })

  // 17. Tendencia: gastos que crecen más rápido que el sueldo
  const anosF = porAnos(flujo(e, mesesHorizonte(e))).filter((x) => x.meses === 12)
  if (anosF.length >= 2) {
    const ini = anosF[0]
    const ult = anosF[anosF.length - 1]
    const peso = (x: typeof ini) => (x.alquiler + x.familia) / Math.max(1, x.ingresos)
    const subida = peso(ult) - peso(ini)
    if (subida > 0.005)
      out.push({
        id: 'tendencia',
        nivel: subida > 0.03 ? 'media' : 'info',
        area: 'Vivienda',
        titulo: `Alquiler y pensión pasan del ${pct(peso(ini))} al ${pct(peso(ult))} de tus ingresos`,
        texto: `Entre ${ini.ano} y ${ult.ano} suben más rápido que tu sueldo (+${a.subidaSalario} % al año). En ${ult.ano} te costarán ${eur(ult.alquiler + ult.familia)}, ${eur(ult.alquiler + ult.familia - ini.alquiler - ini.familia)} más que en ${ini.ano}.`,
      })
  }

  // 18. Riesgo de depender del variable
  const variable = e.ingresos.filter((i) => i.frecuencia === 'anual').reduce((s2, i) => s2 + i.importe, 0)
  if (r.ingresoAnual > 0 && variable / r.ingresoAnual > 0.15)
    out.push({
      id: 'dependencia-variable',
      nivel: 'info',
      area: 'Ahorro',
      titulo: `El ${pct(variable / r.ingresoAnual)} de tus ingresos no es nómina`,
      texto: 'Variable y devolución de la renta no están garantizados. Haz que tus gastos fijos se paguen solo con la nómina y trata los extras como ahorro.',
    })

  return out.sort((x, y) => ORDEN[x.nivel] - ORDEN[y.nivel] || (y.impacto ?? 0) - (x.impacto ?? 0))
}
