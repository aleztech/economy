import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Estado } from './types'
import { AJUSTES_POR_DEFECTO } from './types'
import { abrir, abrirConLlave, cifrar, derivar, type Llave, type Sobre } from './crypto'
import { borrarSesion, guardarSesion, leerSesion } from './sesion'

const CLAVE_LOCAL = 'economy.v1'

const leerLocal = (): Sobre | null => {
  try {
    const t = localStorage.getItem(CLAVE_LOCAL)
    return t ? (JSON.parse(t) as Sobre) : null
  } catch {
    return null
  }
}
const escribirLocal = (s: Sobre) => {
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

async function remoto(): Promise<Sobre> {
  const r = await fetch(`${import.meta.env.BASE_URL}data.enc`, { cache: 'no-store' })
  if (!r.ok) throw new Error('No se encuentran los datos cifrados')
  return r.json()
}

/** Completa campos nuevos en datos guardados con versiones anteriores. */
const normalizar = (e: Estado): Estado => ({ ...e, ajustes: { ...AJUSTES_POR_DEFECTO, ...e.ajustes } })

export interface Sesion {
  estado: Estado
  llave: Llave
  origen: 'local' | 'inicial'
  /** Datos publicados más recientes que los guardados en este navegador. */
  nuevo?: Estado
}

const desdeRemoto = (d: Estado): Estado => normalizar({ ...d, baseSeed: d.actualizado })

/** Reabre sin contraseña con la clave recordada en este navegador, si la hay. */
export async function reanudar(): Promise<Sesion | null> {
  const llave = await leerSesion()
  if (!llave) return null
  const local = leerLocal()
  let pub: Estado | null = null
  try {
    pub = await abrirConLlave<Estado>(llave, await remoto())
  } catch {
    /* los publicados usan otra sal (se republicaron) o no hay conexión */
  }
  if (local) {
    try {
      const datos = await abrirConLlave<Estado>(llave, local)
      const nuevo = pub && pub.actualizado !== datos.baseSeed ? desdeRemoto(pub) : undefined
      return { estado: normalizar(datos), llave, origen: 'local', nuevo }
    } catch {
      return null
    }
  }
  return pub ? { estado: desdeRemoto(pub), llave, origen: 'inicial' } : null
}

export async function desbloquear(password: string): Promise<Sesion> {
  const local = leerLocal()
  if (local) {
    try {
      const { datos, llave } = await abrir<Estado>(password, local)
      let nuevo: Estado | undefined
      try {
        const pub = (await abrir<Estado>(password, await remoto())).datos
        if (pub.actualizado !== datos.baseSeed) nuevo = desdeRemoto(pub)
      } catch {
        /* sin conexión o contraseña distinta en los publicados: seguimos con lo local */
      }
      await guardarSesion(llave)
      return { estado: normalizar(datos), llave, origen: 'local', nuevo }
    } catch {
      /* contraseña distinta a la guardada en este navegador: probamos con los datos iniciales */
    }
  }
  const { datos, llave } = await abrir<Estado>(password, await remoto())
  await guardarSesion(llave)
  return { estado: desdeRemoto(datos), llave, origen: 'inicial' }
}

type Guardado = 'guardado' | 'guardando' | 'sin-almacenamiento'

interface Ctx {
  estado: Estado
  set: (fn: (e: Estado) => Estado) => void
  guardado: Guardado
  exportar: () => Promise<string>
  importar: (texto: string, password: string) => Promise<void>
  restaurar: (password: string) => Promise<void>
  cambiarPassword: (actual: string, nueva: string) => Promise<void>
  salir: () => void
  pendiente: Estado | null
  resolverPendiente: (cargar: boolean) => void
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ inicial, nuevo, llave: llaveInicial, onSalir, children }: { inicial: Estado; nuevo?: Estado; llave: Llave; onSalir: () => void; children: ReactNode }) {
  const [estado, setEstado] = useState(inicial)
  const [pendiente, setPendiente] = useState<Estado | null>(nuevo ?? null)
  const resolverPendiente = useCallback(
    (cargar: boolean) => {
      if (!pendiente) return
      if (cargar) setEstado(pendiente)
      else setEstado((e) => ({ ...e, baseSeed: pendiente.baseSeed }))
      setPendiente(null)
    },
    [pendiente],
  )
  const [guardado, setGuardado] = useState<Guardado>('guardado')
  const llave = useRef(llaveInicial)
  const timer = useRef<number>()
  const primera = useRef(true)

  const ultimo = useRef(estado)
  const sucio = useRef(false)
  const guardarYa = useCallback(async () => {
    if (!sucio.current) return
    sucio.current = false
    const sobre = await cifrar(llave.current, ultimo.current)
    setGuardado(escribirLocal(sobre) ? 'guardado' : 'sin-almacenamiento')
  }, [])

  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    ultimo.current = estado
    sucio.current = true
    setGuardado('guardando')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(guardarYa, 150)
  }, [estado, guardarYa])

  // Guarda al instante si cierras, recargas o cambias de app.
  useEffect(() => {
    const flush = () => {
      window.clearTimeout(timer.current)
      void guardarYa()
    }
    const vis = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [guardarYa])

  const set = useCallback((fn: (e: Estado) => Estado) => setEstado((e) => ({ ...fn(e), actualizado: new Date().toISOString() })), [])

  const exportar = useCallback(async () => JSON.stringify(await cifrar(llave.current, estado)), [estado])

  const importar = useCallback(async (texto: string, password: string) => {
    const sobre = JSON.parse(texto) as Sobre
    const { datos } = await abrir<Estado>(password, sobre)
    setEstado(normalizar(datos))
  }, [])

  const restaurar = useCallback(async (password: string) => {
    const { datos } = await abrir<Estado>(password, await remoto())
    setEstado(desdeRemoto(datos))
    setPendiente(null)
  }, [])

  const cambiarPassword = useCallback(
    async (actual: string, nueva: string) => {
      // Comprueba la contraseña actual contra lo guardado en este navegador (o los datos iniciales).
      await abrir(actual, leerLocal() ?? (await remoto()))
      llave.current = await derivar(nueva)
      await guardarSesion(llave.current)
      const sobre = await cifrar(llave.current, estado)
      escribirLocal(sobre)
    },
    [estado],
  )

  return (
    <StoreCtx.Provider value={{ estado, set, guardado, exportar, importar, restaurar, cambiarPassword, salir: () => void borrarSesion().then(onSalir), pendiente, resolverPendiente }}>{children}</StoreCtx.Provider>
  )
}

export const useStore = () => {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore fuera de StoreProvider')
  return c
}
