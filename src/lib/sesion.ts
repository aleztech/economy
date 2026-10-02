import type { Llave } from './crypto'

/**
 * Sesión recordada en este navegador: guarda la clave AES ya derivada (no la contraseña)
 * en IndexedDB como clave no exportable, para no pedir la contraseña al recargar.
 * Caduca a los 30 días o al cerrar sesión.
 */

const DB = 'economy'
const STORE = 'sesion'
const DIAS = 30

interface Guardada {
  key: CryptoKey
  salt: Uint8Array<ArrayBuffer>
  iter: number
  caduca: number
}

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => ok(req.result)
    req.onerror = () => ko(req.error)
  })
}

async function op<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrirDb()
  return new Promise((ok, ko) => {
    const tx = db.transaction(STORE, modo)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => ok(req.result)
    req.onerror = () => ko(req.error)
  })
}

export async function guardarSesion(llave: Llave) {
  try {
    const g: Guardada = { key: llave.key, salt: llave.salt, iter: llave.iter, caduca: Date.now() + DIAS * 86_400_000 }
    await op('readwrite', (s) => s.put(g, 'actual'))
  } catch {
    /* sin IndexedDB (modo privado): se pedirá la contraseña al recargar */
  }
}

export async function leerSesion(): Promise<Llave | null> {
  try {
    const g = (await op('readonly', (s) => s.get('actual'))) as Guardada | undefined
    if (!g || g.caduca < Date.now()) return null
    return { key: g.key, salt: g.salt, iter: g.iter }
  } catch {
    return null
  }
}

export async function borrarSesion() {
  try {
    await op('readwrite', (s) => s.delete('actual'))
  } catch {
    /* nada que borrar */
  }
}
