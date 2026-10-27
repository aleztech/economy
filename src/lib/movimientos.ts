/**
 * Movimientos importados de extractos (Revolut y PayPal): parseo, clasificación y análisis de recortes.
 * Todo ocurre en el navegador; los movimientos se guardan cifrados junto al resto de datos.
 */
import type { Categoria, Gasto } from './types'

export type Fuente = 'revolut' | 'paypal'
export type TipoMov = 'gasto' | 'ingreso' | 'interno' | 'ahorro'

export interface Movimiento {
  id: string
  /** AAAA-MM-DD */
  fecha: string
  desc: string
  /** Negativo = sale dinero. En euros. */
  importe: number
  fuente: Fuente
  tipo: TipoMov
  grupo: string
  categoria: Categoria
  /** Detalle del artículo (PayPal). */
  detalle?: string
}

interface Regla {
  grupo: string
  categoria: Categoria
  re: RegExp
  tipo?: TipoMov
  /** Gasto recortable sin cambiar de vida. */
  disc?: boolean
  /** Recorte razonable (0-1) para estimar lo que liberas. Por defecto 0,5. */
  recorte?: number
  /** Gasto de la web al que corresponde (por id). */
  gastoId?: string
  aviso?: string
}

/** El orden importa: gana la primera regla que encaja. */
const REGLAS: Regla[] = [
  // Movimientos entre tus cuentas y ahorro
  { grupo: 'Traspasos propios', categoria: 'Otros', tipo: 'interno', re: /cuenta remunerada|savings ?vault|vault topup|hucha|pocket|alejandro gonz[aá]lez|closing transaction|savingsaccount migration|^recarga$|recarga con open banking|una recarga de apple pay/i },
  { grupo: 'Inversión', categoria: 'Otros', tipo: 'ahorro', re: /renta 4|indexa|myinvestor|cuenta de inversi[oó]n|trade republic|\bxtb\b|revolut digital assets/i },
  // Vivienda y familia
  { grupo: 'Alquiler', categoria: 'Vivienda', re: /candelaria|alquiler/i, gastoId: 'alquiler' },
  { grupo: 'Pensión y gastos de Alma', categoria: 'Familia', re: /sara esther|alma gonz[aá]lez|2care4kids/i, gastoId: 'pension-alma' },
  { grupo: 'Suministros y comunidad', categoria: 'Suministros', re: /iberdrola|endesa|naturgy|orange|movistar|vodafone|digi |comunidad prop/i },
  // Comida
  { grupo: 'Supermercado y Wetaca', categoria: 'Comida', re: /lidl|alcampo|mercadona|ahorra ?mas|aldi|carrefour|supercor|hipercor|eroski|\bdia\b|^alimentacion|carnes mor|mercado san|bazar mei|ecolac|wetaca/i, disc: true, recorte: 0.15, gastoId: 'super' },
  { grupo: 'Suplementos', categoria: 'Salud y deporte', re: /prozis|io\.?genix|vitalfuel|evotech|myprotein|hsn|calmova|neurokalm|restfulness|aquapure|nuvelis|elexirium|revoray|borea nova|airbreazy/i, disc: true, recorte: 0.8, gastoId: 'deporte', aviso: 'Compras de impulso: casi todas llegan por anuncios.' },
  { grupo: 'Comida a domicilio', categoria: 'Comida', re: /uber eats|glovo|just ?eat|deliveroo/i, disc: true, recorte: 0.8, gastoId: 'fuera' },
  // Transporte
  { grupo: 'Uber y taxis', categoria: 'Transporte', re: /^uber$|uber payments|uber bv|taxi|licencia|llic|cabify|bolt/i, disc: true, recorte: 0.5, gastoId: 'uber' },
  { grupo: 'Transporte y moto', categoria: 'Transporte', re: /renfe|civitas|plenergy|taller|tramicar|amorerental|repsol|cepsa|galp|ayto madrid|parking|ser madrid/i, gastoId: 'cercanias' },
  // Caprichos y consumo
  { grupo: 'Bici y deporte', categoria: 'Salud y deporte', re: /canyon|ruedas custom|zwift|deporvillage|decathlon|tradeinn|assos|revenge|strava|siroko|alpecin|gobik|sprinter|sports direct|adidas|rockthesport|wellbeinn|alltricks|mammoth|bike24|bike|ciclo|wahoo|garmin|bikeinn/i, disc: true, recorte: 0.7, gastoId: 'deporte' },
  { grupo: 'AliExpress, Temu y Shein', categoria: 'Otros', re: /aliexpress|temu|shein|alipay|wish\.com/i, disc: true, recorte: 0.8, gastoId: 'online', aviso: 'Muchos pedidos pequeños: el gasto se nota a fin de mes, no al comprar.' },
  { grupo: 'Amazon', categoria: 'Otros', re: /amazon/i, disc: true, recorte: 0.5, gastoId: 'online' },
  { grupo: 'Tiendas de anuncios (Shopify)', categoria: 'Otros', re: /^sp /i, disc: true, recorte: 1, gastoId: 'online', aviso: 'Llegan por anuncios de Instagram/Facebook: oculta esos anunciantes.' },
  { grupo: 'Tabaco y vaper', categoria: 'Ocio', re: /no mas humos|expendedur|estanco|vaper|sub-ohm|masquevapor|tabac/i, disc: true, recorte: 1, gastoId: 'tabaco-alcohol' },
  { grupo: 'Apuestas', categoria: 'Ocio', re: /betfair|bet365|codere|sportium|bwin|pokerstars|william hill/i, disc: true, recorte: 1, gastoId: 'ocio' },
  { grupo: 'Videojuegos', categoria: 'Ocio', re: /microsoft payments|store steam|steam|gamivo|playstation|nintendo|xbox|epic games/i, disc: true, recorte: 0.7, gastoId: 'ocio' },
  { grupo: 'Viajes y hoteles', categoria: 'Ocio', re: /grupotel|booking|barcel[oó]|aptos 2h|nu mallorca|radsalon|hotel|airbnb|ryanair|vueling|iberia|thomas britz/i, disc: true, recorte: 0.4, gastoId: 'ocio' },
  { grupo: 'Ocio y eventos', categoria: 'Ocio', re: /zoo|micropolix|mad cool|idasfest|enterticket|eventim|ingresse|tablao|bengala|rock garden|kinki|cine|festival|entradas/i, disc: true, recorte: 0.3, gastoId: 'ocio' },
  { grupo: 'Música y DJ', categoria: 'Suscripciones', re: /tidal|beatport|soundcloud|mixcloud|alphatheta|cleverbridge|virtualdj|ppg digital|bimotordj|thomann|spotify/i, disc: true, recorte: 0.5, gastoId: 'streaming', aviso: 'Varias plataformas de música a la vez: quédate con una.' },
  { grupo: 'Streaming y apps', categoria: 'Suscripciones', re: /netflix|dazn|hbo|disney|^apple$|apple\.com|icloud|tarifa del plan|lookiero|linkedin|brave|lemsqzy|lockit/i, disc: true, recorte: 0.4, gastoId: 'streaming' },
  { grupo: 'IA, dominios y servidores', categoria: 'Suscripciones', re: /claude|anthropic|openai|perplexity|namecheap|hetzner|paddle|meta platforms|leakradar|oddspapi|21st|cursor|github|vercel|dreamina|pipo|深度求索|deepseek|kimi|information system audit/i, disc: true, recorte: 0.3, gastoId: 'ia-apps', aviso: 'Si es para tus proyectos o el trabajo, que lo pague la empresa.' },
  { grupo: 'Electrónica', categoria: 'Otros', re: /fnac|mediamarkt|apple store|insta360|pccomponentes/i, disc: true, recorte: 0.7 },
  { grupo: 'Ropa', categoria: 'Otros', re: /zalando|mango|sfera|h&m|zara|pull|oscar|overlap|suzushii|bershka|primark/i, disc: true, recorte: 0.5, gastoId: 'otros' },
  { grupo: 'Salud y farmacia', categoria: 'Otros', re: /farmacia|farm[aá]cia|fcia|opticas|mediquo/i, gastoId: 'otros' },
  { grupo: 'Pagos aplazados', categoria: 'Otros', re: /aplazame|klarna|sequra|pagantis/i, disc: true, recorte: 1, aviso: 'Comprar a plazos lo que no puedes pagar al contado es señal de exceso.' },
  { grupo: 'Efectivo', categoria: 'Otros', re: /retirada de efectivo|cajero|atm /i, disc: true, recorte: 0.5, gastoId: 'efectivo', aviso: 'El efectivo no deja rastro: apunta en qué se va.' },
  { grupo: 'Bizums y transferencias a personas', categoria: 'Otros', re: /^bizum payment to|^to |^transferencia a/i },
]

const GRUPO_TARJETA: Regla = { grupo: 'Bares, restaurantes y otros comercios', categoria: 'Comida', re: /./, disc: true, recorte: 0.35, gastoId: 'fuera' }

export function reglaDe(grupo: string): Regla | undefined {
  return [...REGLAS, GRUPO_TARJETA].find((r) => r.grupo === grupo)
}

function clasificar(desc: string, importe: number, fuente: Fuente, tipoOrigen = ''): Pick<Movimiento, 'tipo' | 'grupo' | 'categoria'> {
  if (/intereses|interest/i.test(tipoOrigen)) return { tipo: 'ingreso', grupo: 'Intereses', categoria: 'Otros' }
  for (const r of REGLAS) if (r.re.test(desc)) return { tipo: r.tipo ?? (importe > 0 && r.grupo !== 'Efectivo' ? 'ingreso' : 'gasto'), grupo: r.grupo, categoria: r.categoria }
  if (importe > 0) return { tipo: /reembolso|refund|disputa/i.test(tipoOrigen) ? 'gasto' : 'ingreso', grupo: /reembolso|refund|disputa/i.test(tipoOrigen) ? 'Reembolsos' : 'Ingresos', categoria: 'Otros' }
  if (fuente === 'revolut' && /paypal/i.test(desc)) return { tipo: 'gasto', grupo: 'PayPal (sin detalle)', categoria: 'Otros' }
  return { tipo: 'gasto', grupo: GRUPO_TARJETA.grupo, categoria: GRUPO_TARJETA.categoria }
}

/* ---------- Parseo ---------- */

const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim().replace(/\s/g, '')
  if (!s) return NaN
  // 1.234,56 → 1234.56 ; 1234.56 → 1234.56
  if (/,\d{1,2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'))
  return Number(s.replace(/,/g, ''))
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fechaDe = (v: unknown): string => {
  if (v instanceof Date) return iso(v)
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}

/** Revolut exporta a veces importes como fechas ("1.10" → 1-oct, "5022.08" → ago-5022). Los recupera. */
const importeRevolut = (v: unknown): number => {
  if (v instanceof Date) {
    const y = v.getFullYear()
    return y >= 1990 && y <= 2100 ? Math.round((v.getDate() + (v.getMonth() + 1) / 100) * 100) / 100 : Math.round((y + (v.getMonth() + 1) / 100) * 100) / 100
  }
  return num(v)
}

const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const col = (cab: string[], ...nombres: string[]) => cab.findIndex((c) => nombres.some((n) => c.trim().toLowerCase() === n.toLowerCase()))

/** Filas (primera = cabecera) de un extracto de Revolut en Excel o CSV. */
export function parseRevolut(filas: unknown[][]): Movimiento[] {
  const cab = (filas[0] ?? []).map((c) => String(c ?? ''))
  const iTipo = col(cab, 'Tipo', 'Type')
  const iFecha = col(cab, 'Fecha de inicio', 'Started Date')
  const iDesc = col(cab, 'Descripción', 'Description')
  const iImp = col(cab, 'Importe', 'Amount')
  const iCom = col(cab, 'Comisión', 'Fee')
  const iEst = col(cab, 'State', 'Estado')
  const iProd = col(cab, 'Producto', 'Product')
  if (iFecha < 0 || iDesc < 0 || iImp < 0) throw new Error('No parece un extracto de Revolut (faltan columnas de fecha, descripción o importe).')
  const out: Movimiento[] = []
  filas.slice(1).forEach((f, k) => {
    const estado = String(f[iEst] ?? '')
    if (/devuelto|reverted|declined|rechaz/i.test(estado)) return
    const fecha = fechaDe(f[iFecha])
    const desc = String(f[iDesc] ?? '').replace(/\s+/g, ' ').trim()
    const imp = importeRevolut(f[iImp]) - (iCom >= 0 ? num(f[iCom]) || 0 : 0)
    if (!fecha || !Number.isFinite(imp) || imp === 0) return
    const tipoOrigen = iTipo >= 0 ? String(f[iTipo] ?? '') : ''
    const producto = iProd >= 0 ? String(f[iProd] ?? '') : ''
    let c = clasificar(desc, imp, 'revolut', tipoOrigen)
    // Movimientos dentro de la cuenta remunerada / depósito: internos salvo intereses.
    if (producto && !/actual|current/i.test(producto) && c.tipo !== 'ingreso') c = { tipo: 'interno', grupo: 'Traspasos propios', categoria: 'Otros' }
    out.push({ id: 'r' + hash(`${fecha}|${desc}|${imp}|${producto}|${k}`), fecha, desc, importe: imp, fuente: 'revolut', ...c })
  })
  return out
}

/** Texto de un informe de actividad de PayPal (CSV o TXT con tabuladores). */
export function parsePaypal(texto: string): Movimiento[] {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  const sep = (lineas[0].match(/\t/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? '\t' : ','
  const partir = (l: string) => {
    const out: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (ch === '"') {
        if (q && l[i + 1] === '"') {
          cur += '"'
          i++
        } else q = !q
      } else if (ch === sep && !q) {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
    out.push(cur)
    return out
  }
  const filas = lineas.map(partir)
  const cab = filas[0]
  const iFecha = col(cab, 'Fecha', 'Date')
  const iNombre = col(cab, 'Nombre', 'Name')
  const iTipo = col(cab, 'Tipo', 'Type')
  const iEstado = col(cab, 'Estado', 'Status')
  const iDiv = col(cab, 'Divisa', 'Currency')
  const iBruto = col(cab, 'Bruto', 'Gross')
  const iId = col(cab, 'Id. de transacción', 'Transaction ID')
  const iRef = col(cab, 'Id. de referencia de trans.', 'Reference Txn ID')
  const iArt = col(cab, 'Nombre de artículo', 'Item Title')
  if (iFecha < 0 || iBruto < 0 || iTipo < 0) throw new Error('No parece un informe de actividad de PayPal.')
  const datos = filas.slice(1)
  // Conversiones de divisa: importe en EUR por id de la transacción original.
  const eurPorRef = new Map<string, number>()
  for (const f of datos) if (/conversi[oó]n de divisas|currency conversion/i.test(f[iTipo]) && f[iDiv] === 'EUR') eurPorRef.set(f[iRef], num(f[iBruto]))
  const out: Movimiento[] = []
  for (const f of datos) {
    const tipo = f[iTipo] ?? ''
    if (!/completado|completed/i.test(f[iEstado] ?? '')) continue
    const esPago = /^pago|payment/i.test(tipo) && !/recibido|received/i.test(tipo)
    const esReembolso = /reembolso|refund/i.test(tipo)
    if (!esPago && !esReembolso) continue
    let imp = num(f[iBruto])
    if (f[iDiv] && f[iDiv] !== 'EUR') imp = eurPorRef.get(f[iId]) ?? NaN
    if (!Number.isFinite(imp) || imp === 0) continue
    const fecha = fechaDe(f[iFecha])
    const desc = (f[iNombre] ?? '').trim() || 'PayPal'
    const c = clasificar(desc, esReembolso ? -Math.abs(imp) : imp, 'paypal')
    out.push({ id: 'p' + (f[iId] || hash(`${fecha}|${desc}|${imp}`)), fecha, desc, importe: imp, fuente: 'paypal', ...c, tipo: 'gasto', detalle: (f[iArt] ?? '').slice(0, 140) || undefined })
  }
  return out
}

/** Une movimientos nuevos con los guardados (sin duplicados) y quita los cargos de PayPal en Revolut que ya tienen detalle. */
export function fusionar(prev: Movimiento[], nuevos: Movimiento[]): Movimiento[] {
  const m = new Map(prev.map((x) => [x.id, x]))
  for (const x of nuevos) m.set(x.id, x)
  return [...m.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/* ---------- Análisis ---------- */

export interface GrupoAnalisis {
  grupo: string
  categoria: Categoria
  total: number
  mes: number
  n: number
  ticketMedio: number
  pequenas: number
  grandes: Movimiento[]
  disc: boolean
  recorte: number
  liberas: number
  gastoId?: string
  aviso?: string
  comercios: { nombre: string; total: number; n: number }[]
  porMes: Map<string, number>
}

export interface Suscripcion {
  nombre: string
  /** Coste mensual mientras está activa. */
  mes: number
  meses: number
  ultimo: string
  grupo: string
  /** Ha cobrado en los últimos 45 días del extracto. */
  activa: boolean
}

export interface Analisis {
  desde: string
  hasta: string
  meses: number
  gastoMes: number
  ingresoMes: number
  discMes: number
  liberasMes: number
  grupos: GrupoAnalisis[]
  suscripciones: Suscripcion[]
  meses_: { ym: string; disc: number; resto: number }[]
  paypalSinDetalle: number
}

const DIAS_MES = 30.44

/** Movimientos que cuentan: quita los cargos de PayPal vistos en Revolut cuando hay detalle de PayPal para esas fechas. */
export function efectivos(movs: Movimiento[]): Movimiento[] {
  const pp = movs.filter((m) => m.fuente === 'paypal')
  if (!pp.length) return movs
  const d0 = pp[0].fecha
  const d1 = pp[pp.length - 1].fecha
  return movs.filter((m) => !(m.fuente === 'revolut' && m.grupo === 'PayPal (sin detalle)' && m.fecha >= d0 && m.fecha <= d1))
}

export function analizar(todos: Movimiento[], desde?: string, hasta?: string): Analisis | null {
  const movs = efectivos(todos).filter((m) => (!desde || m.fecha >= desde) && (!hasta || m.fecha <= hasta))
  if (!movs.length) return null
  const d0 = movs[0].fecha
  const d1 = movs[movs.length - 1].fecha
  const meses = Math.max(1, (new Date(d1).getTime() - new Date(d0).getTime()) / 864e5 / DIAS_MES)
  const gastos = movs.filter((m) => m.tipo === 'gasto')
  const ingresos = movs.filter((m) => m.tipo === 'ingreso')
  const mapa = new Map<string, Movimiento[]>()
  for (const m of gastos) mapa.set(m.grupo, [...(mapa.get(m.grupo) ?? []), m])
  const grupos: GrupoAnalisis[] = [...mapa.entries()]
    .map(([grupo, l]) => {
      const r = reglaDe(grupo)
      const total = -l.reduce((s, m) => s + m.importe, 0)
      const salidas = l.filter((m) => m.importe < 0)
      const tickets = salidas.map((m) => -m.importe).sort((a, b) => a - b)
      const com = new Map<string, { total: number; n: number }>()
      for (const m of l) {
        const k = m.desc.replace(/^bizum (purchase at|payment to): /i, '').slice(0, 48)
        const c = com.get(k) ?? { total: 0, n: 0 }
        c.total -= m.importe
        c.n += m.importe < 0 ? 1 : 0
        com.set(k, c)
      }
      const porMes = new Map<string, number>()
      for (const m of l) porMes.set(m.fecha.slice(0, 7), (porMes.get(m.fecha.slice(0, 7)) ?? 0) - m.importe)
      const disc = !!r?.disc
      const recorte = r?.recorte ?? 0.5
      const mes = total / meses
      return {
        grupo,
        categoria: l[0].categoria,
        total,
        mes,
        n: salidas.length,
        ticketMedio: tickets.length ? tickets[Math.floor(tickets.length / 2)] : 0,
        pequenas: tickets.filter((t) => t < 30).length,
        grandes: salidas.filter((m) => -m.importe >= 300).sort((a, b) => a.importe - b.importe),
        disc,
        recorte,
        liberas: disc ? mes * recorte : 0,
        gastoId: r?.gastoId,
        aviso: r?.aviso,
        comercios: [...com.entries()].map(([nombre, c]) => ({ nombre, ...c })).sort((a, b) => b.total - a.total),
        porMes,
      }
    })
    .filter((g) => g.total > 0.5)
    .sort((a, b) => b.mes - a.mes)

  // Suscripciones y cuotas: mismo comercio con cargos parecidos y periódicos (no bares ni súper).
  const GRUPOS_SUSC = /música|streaming|ia, dominios|bici|pagos aplazados|videojuegos|suplementos/i
  const porComercio = new Map<string, Movimiento[]>()
  for (const m of gastos) if (m.importe < 0) porComercio.set(m.desc, [...(porComercio.get(m.desc) ?? []), m])
  const suscripciones: Suscripcion[] = []
  for (const [nombre, l] of porComercio) {
    if (!GRUPOS_SUSC.test(l[0].grupo) && !/plan|subscription|suscrip|premium|pro\b/i.test(nombre)) continue
    const mesesDistintos = new Set(l.map((m) => m.fecha.slice(0, 7)))
    if (mesesDistintos.size < 3) continue
    const imps = l.map((m) => -m.importe).sort((a, b) => a - b)
    const mediana = imps[Math.floor(imps.length / 2)]
    const parecidos = imps.filter((x) => Math.abs(x - mediana) <= Math.max(1.5, mediana * 0.15)).length
    if (parecidos / imps.length < 0.5 || l.length > mesesDistintos.size * 2) continue
    const ultimo = l[l.length - 1].fecha
    const primero = l[0].fecha
    const span = Math.max(1, (new Date(ultimo).getTime() - new Date(primero).getTime()) / 864e5 / DIAS_MES + 1)
    const activa = (new Date(d1).getTime() - new Date(ultimo).getTime()) / 864e5 <= 45
    // Activas: lo cobrado en sus últimos 90 días / 3. Terminadas: el cargo típico.
    const t90 = new Date(ultimo).getTime() - 90 * 864e5
    const reciente = l.filter((m) => new Date(m.fecha).getTime() > t90).reduce((s, m) => s - m.importe, 0) / 3
    suscripciones.push({ nombre, mes: activa ? reciente : mediana * Math.min(1, parecidos / span), meses: mesesDistintos.size, ultimo, grupo: l[0].grupo, activa })
  }
  suscripciones.sort((a, b) => Number(b.activa) - Number(a.activa) || b.mes - a.mes)

  const ymSet = [...new Set(gastos.map((m) => m.fecha.slice(0, 7)))].sort()
  const meses_ = ymSet.map((ym) => {
    let disc = 0
    let resto = 0
    for (const m of gastos) if (m.fecha.startsWith(ym)) (reglaDe(m.grupo)?.disc ? (disc -= m.importe) : (resto -= m.importe))
    return { ym, disc, resto }
  })
  const gastoMes = grupos.reduce((s, g) => s + g.mes, 0)
  return {
    desde: d0,
    hasta: d1,
    meses,
    gastoMes,
    ingresoMes: ingresos.reduce((s, m) => s + m.importe, 0) / meses,
    discMes: grupos.filter((g) => g.disc).reduce((s, g) => s + g.mes, 0),
    liberasMes: grupos.reduce((s, g) => s + g.liberas, 0),
    grupos,
    suscripciones,
    meses_,
    paypalSinDetalle: grupos.find((g) => g.grupo === 'PayPal (sin detalle)')?.mes ?? 0,
  }
}

/** Media mensual real por gasto de la web (según las reglas), para comparar y actualizar importes. */
export function mediasPorGasto(a: Analisis, gastos: Gasto[]): { gasto: Gasto; real: number; grupos: string[] }[] {
  const m = new Map<string, { real: number; grupos: string[] }>()
  for (const g of a.grupos) {
    if (!g.gastoId || !gastos.some((x) => x.id === g.gastoId)) continue
    const e = m.get(g.gastoId) ?? { real: 0, grupos: [] }
    e.real += g.mes
    e.grupos.push(g.grupo)
    m.set(g.gastoId, e)
  }
  return [...m.entries()].map(([id, v]) => ({ gasto: gastos.find((x) => x.id === id)!, ...v })).sort((x, y) => y.real - x.real)
}
