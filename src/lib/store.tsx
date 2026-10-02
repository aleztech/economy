import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Estado } from './types'
import { AJUSTES_POR_DEFECTO } from './types'
import { abrir, cifrar, derivar, type Llave, type Sobre } from './crypto'

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

export async function desbloquear(password: string): Promise<{ estado: Estado; llave: Llave; origen: 'local' | 'inicial' }> {
  const local = leerLocal()
  if (local) {
    try {
      const { datos, llave } = await abrir<Estado>(password, local)
      return { estado: normalizar(datos), llave, origen: 'local' }
    } catch {
      /* contraseña distinta a la guardada en este navegador: probamos con los datos iniciales */
    }
  }
  const { datos, llave } = await abrir<Estado>(password, await remoto())
  return { estado: normalizar(datos), llave, origen: 'inicial' }
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
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ inicial, llave: llaveInicial, onSalir, children }: { inicial: Estado; llave: Llave; onSalir: () => void; children: ReactNode }) {
  const [estado, setEstado] = useState(inicial)
  const [guardado, setGuardado] = useState<Guardado>('guardado')
  const llave = useRef(llaveInicial)
  const timer = useRef<number>()
  const primera = useRef(true)

  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    setGuardado('guardando')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      const sobre = await cifrar(llave.current, estado)
      setGuardado(escribirLocal(sobre) ? 'guardado' : 'sin-almacenamiento')
    }, 500)
    return () => window.clearTimeout(timer.current)
  }, [estado])

  const set = useCallback((fn: (e: Estado) => Estado) => setEstado((e) => ({ ...fn(e), actualizado: new Date().toISOString() })), [])

  const exportar = useCallback(async () => JSON.stringify(await cifrar(llave.current, estado)), [estado])

  const importar = useCallback(async (texto: string, password: string) => {
    const sobre = JSON.parse(texto) as Sobre
    const { datos } = await abrir<Estado>(password, sobre)
    setEstado(normalizar(datos))
  }, [])

  const restaurar = useCallback(async (password: string) => {
    const { datos } = await abrir<Estado>(password, await remoto())
    setEstado(normalizar(datos))
  }, [])

  const cambiarPassword = useCallback(
    async (actual: string, nueva: string) => {
      // Comprueba la contraseña actual contra lo guardado en este navegador (o los datos iniciales).
      await abrir(actual, leerLocal() ?? (await remoto()))
      llave.current = await derivar(nueva)
      const sobre = await cifrar(llave.current, estado)
      escribirLocal(sobre)
    },
    [estado],
  )

  return (
    <StoreCtx.Provider value={{ estado, set, guardado, exportar, importar, restaurar, cambiarPassword, salir: onSalir }}>{children}</StoreCtx.Provider>
  )
}

export const useStore = () => {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore fuera de StoreProvider')
  return c
}
