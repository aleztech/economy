export type Frecuencia = 'mensual' | 'trimestral' | 'anual'

export const CATEGORIAS = [
  'Vivienda',
  'Familia',
  'Suministros',
  'Internet y móvil',
  'Comida',
  'Transporte',
  'Seguros',
  'Suscripciones',
  'Salud y deporte',
  'Ocio',
  'Otros',
] as const
export type Categoria = (typeof CATEGORIAS)[number]

/** Categorías que se pueden recortar sin cambiar de vida (para recomendaciones). */
export const DISCRECIONALES: Categoria[] = ['Comida', 'Transporte', 'Suscripciones', 'Ocio', 'Otros', 'Salud y deporte']

export interface Ingreso {
  id: string
  nombre: string
  importe: number
  frecuencia: 'mensual' | 'anual'
  /** Mes de cobro (1-12) si es anual. */
  mes?: number
  /** Si sube cada enero con la subida salarial prevista. */
  crece?: boolean
}

/** Cómo se actualiza un gasto con los años. */
export type Indexacion = 'ipc' | 'alquiler' | 'propia' | 'ninguna'

export interface Gasto {
  id: string
  nombre: string
  categoria: Categoria
  importe: number
  frecuencia: Frecuencia
  /** Mes de cargo (1-12) para gastos anuales. */
  mes?: number
  fijo?: boolean
  /** Importe mensual objetivo tras optimizar (opcional). */
  objetivo?: number
  nota?: string
  /** Por defecto: alquiler para Vivienda, IPC para el resto. */
  indexa?: Indexacion
  /** % anual si indexa = 'propia'. */
  subida?: number
  /** Año al que corresponde el importe; sube a partir del siguiente. */
  anoBase?: number
}

export type Destino = 'fondos' | 'pension' | 'colchon' | 'piso'

export interface Aportacion {
  id: string
  nombre: string
  importe: number
  destino: Destino
}

export interface Evento {
  id: string
  nombre: string
  importe: number
  /** AAAA-MM */
  fecha: string
  tipo: 'gasto' | 'ingreso'
  /** Si el ingreso viene de liquidar un activo, se retira de patrimonio ese mes. */
  activoId?: string
}

export type TipoActivo = 'indexado' | 'gestion-activa' | 'efectivo' | 'pension' | 'alternativo'

export interface Activo {
  id: string
  nombre: string
  valor: number
  tipo: TipoActivo
  /** Coste anual total en % (TER + gestión). */
  coste?: number
  liquido: boolean
}

export interface Ajustes {
  edad: number
  edadJubilacion: number
  /** Rentabilidad real anual en %, tres escenarios. */
  rentPes: number
  rentBase: number
  rentOpt: number
  subidaAlquiler: number
  tasaRetiro: number
  tipoMarginal: number
  precioPiso: number
  entradaPct: number
  gastosCompraPct: number
  colchonMeses: number
  tipoHipoteca: number
  plazoHipoteca: number
  gastosPropietarioMes: number
  mantenimientoPct: number
  usarFondosParaPiso: boolean
  /** Primer mes de la previsión, AAAA-MM. */
  inicio: string
  /** Subida salarial anual prevista (%), cada enero. */
  subidaSalario: number
  /** Inflación de los gastos corrientes (%), cada enero. */
  inflacionGastos: number
  /** Mes en que se actualiza el alquiler (aniversario del contrato). */
  mesSubidaAlquiler: number
  /** Años de previsión detallada. */
  anosPrevision: number
}

export interface Estado {
  version: 1
  ingresos: Ingreso[]
  gastos: Gasto[]
  aportaciones: Aportacion[]
  eventos: Evento[]
  activos: Activo[]
  ajustes: Ajustes
  actualizado: string
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  edad: 45,
  edadJubilacion: 67,
  rentPes: 2,
  rentBase: 4,
  rentOpt: 6,
  subidaAlquiler: 2.5,
  tasaRetiro: 4,
  tipoMarginal: 45,
  precioPiso: 280000,
  entradaPct: 20,
  gastosCompraPct: 10,
  colchonMeses: 6,
  tipoHipoteca: 3,
  plazoHipoteca: 25,
  gastosPropietarioMes: 175,
  mantenimientoPct: 1,
  usarFondosParaPiso: false,
  inicio: '2026-11',
  subidaSalario: 1,
  inflacionGastos: 2.5,
  mesSubidaAlquiler: 11,
  anosPrevision: 5,
}

export const uid = () => Math.random().toString(36).slice(2, 10)
