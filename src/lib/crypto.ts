/**
 * Cifrado de los datos con la contraseña de acceso.
 * PBKDF2-SHA256 (310.000 iteraciones) → clave AES-GCM 256.
 * La contraseña nunca se guarda: sin ella, el contenido es ruido.
 */

export interface Sobre {
  v: 1
  iter: number
  salt: string
  iv: string
  ct: string
}

const ITER = 310_000
const enc = new TextEncoder()
const dec = new TextDecoder()

const b64 = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>

export interface Llave {
  key: CryptoKey
  salt: Uint8Array<ArrayBuffer>
  iter: number
}

export async function derivar(password: string, salt?: Uint8Array<ArrayBuffer>, iter = ITER): Promise<Llave> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16))
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: s, iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return { key, salt: s, iter }
}

export async function cifrar(llave: Llave, datos: unknown): Promise<Sobre> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave.key, enc.encode(JSON.stringify(datos)))
  return { v: 1, iter: llave.iter, salt: b64(llave.salt), iv: b64(iv), ct: b64(ct) }
}

/** Lanza un error si la contraseña no es correcta. */
export async function abrir<T>(password: string, sobre: Sobre): Promise<{ datos: T; llave: Llave }> {
  const llave = await derivar(password, unb64(sobre.salt), sobre.iter)
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sobre.iv) }, llave.key, unb64(sobre.ct))
  return { datos: JSON.parse(dec.decode(plano)) as T, llave }
}

export async function abrirConLlave<T>(llave: Llave, sobre: Sobre): Promise<T> {
  if (sobre.salt !== b64(llave.salt)) throw new Error('salt distinto')
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sobre.iv) }, llave.key, unb64(sobre.ct))
  return JSON.parse(dec.decode(plano)) as T
}
