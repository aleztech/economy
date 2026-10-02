// Cifra seed.json con la contraseña (variable de entorno ECONOMY_PASS) y escribe public/data.enc.
// seed.json está en .gitignore: al repo solo llega el fichero cifrado.
import { readFileSync, writeFileSync } from 'node:fs'
import { webcrypto as crypto } from 'node:crypto'

const pass = process.env.ECONOMY_PASS
if (!pass) {
  console.error('Falta ECONOMY_PASS')
  process.exit(1)
}
const datos = JSON.parse(readFileSync(new URL('../seed.json', import.meta.url), 'utf8'))
const enc = new TextEncoder()
const b64 = (b) => Buffer.from(b).toString('base64')
const iter = 310_000
const salt = crypto.getRandomValues(new Uint8Array(16))
const iv = crypto.getRandomValues(new Uint8Array(12))
const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(datos)))
writeFileSync(new URL('../public/data.enc', import.meta.url), JSON.stringify({ v: 1, iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) }))
console.log('public/data.enc listo')
