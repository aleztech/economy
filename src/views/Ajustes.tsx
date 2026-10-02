import { useState } from 'react'
import { Copy, Download, KeyRound, LogOut, RotateCcw, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Ajustes as TAjustes } from '../lib/types'
import { Button, Card, Field, NumberInput, Section, TextInput } from '../components/ui'

type CampoNum = { [K in keyof TAjustes]: TAjustes[K] extends number ? K : never }[keyof TAjustes]

const CAMPOS: { titulo: string; campos: { k: CampoNum; label: string; suf: string }[] }[] = [
  {
    titulo: 'Tú',
    campos: [
      { k: 'edad', label: 'Edad', suf: 'años' },
      { k: 'edadJubilacion', label: 'Edad de jubilación', suf: 'años' },
      { k: 'tipoMarginal', label: 'Tipo marginal IRPF', suf: '%' },
    ],
  },
  {
    titulo: 'Previsión',
    campos: [
      { k: 'subidaSalario', label: 'Subida salarial anual', suf: '%' },
      { k: 'inflacionGastos', label: 'Inflación de gastos', suf: '%' },
      { k: 'subidaAlquiler', label: 'Subida anual alquiler', suf: '%' },
      { k: 'mesSubidaAlquiler', label: 'Mes de subida alquiler', suf: '(1-12)' },
      { k: 'anosPrevision', label: 'Años de previsión', suf: 'años' },
    ],
  },
  {
    titulo: 'Rentabilidad real anual (sin inflación)',
    campos: [
      { k: 'rentPes', label: 'Pesimista', suf: '%' },
      { k: 'rentBase', label: 'Base', suf: '%' },
      { k: 'rentOpt', label: 'Optimista', suf: '%' },
      { k: 'tasaRetiro', label: 'Tasa de retirada', suf: '%' },
    ],
  },
  {
    titulo: 'Vivienda',
    campos: [
      { k: 'precioPiso', label: 'Precio piso objetivo', suf: '€' },
      { k: 'gastosCompraPct', label: 'Gastos de compra', suf: '%' },
      { k: 'colchonMeses', label: 'Colchón tras comprar', suf: 'meses' },
      { k: 'gastosPropietarioMes', label: 'IBI + comunidad + seguro', suf: '€/mes' },
      { k: 'mantenimientoPct', label: 'Mantenimiento anual', suf: '%' },
    ],
  },
]

export default function Ajustes() {
  const { estado, set, exportar, importar, restaurar, cambiarPassword, salir } = useStore()
  const a = estado.ajustes
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [backup, setBackup] = useState('')
  const [passImport, setPassImport] = useState('')
  const [confirmarReset, setConfirmarReset] = useState(false)
  const [passReset, setPassReset] = useState('')

  const aviso = (t: string, ok = true) => {
    setMsg({ t, ok })
    window.setTimeout(() => setMsg(null), 5000)
  }

  const descargar = async () => {
    const txt = await exportar()
    const url = URL.createObjectURL(new Blob([txt], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `economy-${new Date().toISOString().slice(0, 10)}.enc`
    link.click()
    URL.revokeObjectURL(url)
    aviso('Copia cifrada descargada.')
  }
  const copiar = async () => {
    const txt = await exportar()
    try {
      await navigator.clipboard.writeText(txt)
      aviso('Copia cifrada copiada al portapapeles.')
    } catch {
      setBackup(txt)
      aviso('No se pudo copiar: la tienes en el cuadro de importar para copiarla a mano.', false)
    }
  }

  return (
    <div className="rise flex max-w-2xl flex-col gap-8">
      {msg && <div className={`rounded-xl px-4 py-3 text-[13.5px] ${msg.ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>{msg.t}</div>}

      {CAMPOS.map((g) => (
        <Section key={g.titulo} title={g.titulo}>
          <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            {g.campos.map((c) => (
              <Field key={c.k} label={c.label}>
                <NumberInput id={`aj-${c.k}`} value={a[c.k]} suffix={c.suf} onChange={(n) => set((e) => ({ ...e, ajustes: { ...e.ajustes, [c.k]: n } }))} />
              </Field>
            ))}
          </Card>
        </Section>
      ))}

      <Section title="Inicio de la previsión">
        <Card className="grid grid-cols-2 gap-3 p-4">
          <Field label="Primer mes de la previsión">
            <TextInput id="aj-inicio" type="month" value={a.inicio} onChange={(e) => e.target.value && set((s) => ({ ...s, ajustes: { ...s.ajustes, inicio: e.target.value } }))} />
          </Field>
        </Card>
      </Section>

      <Section title="Copias de seguridad" hint="Los cambios se guardan cifrados en este navegador. Para llevarlos a otro dispositivo, exporta aquí e importa allí.">
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={descargar}>
              <Download size={16} /> Descargar copia
            </Button>
            <Button variant="outline" onClick={copiar}>
              <Copy size={16} /> Copiar copia
            </Button>
          </div>
          <Field label="Importar copia (pega el contenido o carga el archivo)">
            <textarea id="aj-backup" value={backup} onChange={(e) => setBackup(e.target.value)} rows={3} className="w-full rounded-xl border border-line bg-surface p-3 font-mono text-[12px] outline-none focus:border-accent" />
          </Field>
          <input
            id="aj-file"
            type="file"
            accept=".enc,.json,application/json"
            className="text-[13px] text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-fg"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setBackup(await f.text())
            }}
          />
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Contraseña de esa copia" className="flex-1">
              <TextInput id="aj-passimp" type="password" value={passImport} onChange={(e) => setPassImport(e.target.value)} />
            </Field>
            <Button
              disabled={!backup || !passImport}
              onClick={async () => {
                try {
                  await importar(backup, passImport)
                  setBackup('')
                  setPassImport('')
                  aviso('Copia importada.')
                } catch {
                  aviso('No se pudo abrir la copia: revisa el contenido y la contraseña.', false)
                }
              }}
            >
              <Upload size={16} /> Importar
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="Contraseña">
        <Card className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Actual">
              <TextInput id="aj-actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
            </Field>
            <Field label="Nueva">
              <TextInput id="aj-nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
            </Field>
          </div>
          <p className="text-[12.5px] text-muted">Cambia la clave de lo guardado en este navegador. Los datos iniciales publicados siguen abriéndose con la contraseña original.</p>
          <div>
            <Button
              variant="outline"
              disabled={!actual || nueva.length < 8}
              onClick={async () => {
                try {
                  await cambiarPassword(actual, nueva)
                  setActual('')
                  setNueva('')
                  aviso('Contraseña cambiada.')
                } catch {
                  aviso('La contraseña actual no es correcta.', false)
                }
              }}
            >
              <KeyRound size={16} /> Cambiar contraseña
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="Sesión">
        <Card className="flex flex-col gap-3 p-4">
          {confirmarReset ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Contraseña original, para confirmar" className="flex-1">
                <TextInput id="aj-reset" type="password" value={passReset} onChange={(e) => setPassReset(e.target.value)} />
              </Field>
              <Button variant="ghost" onClick={() => setConfirmarReset(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={!passReset}
                onClick={async () => {
                  try {
                    await restaurar(passReset)
                    setConfirmarReset(false)
                    setPassReset('')
                    aviso('Datos iniciales restaurados.')
                  } catch {
                    aviso('Contraseña incorrecta.', false)
                  }
                }}
              >
                Restaurar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setConfirmarReset(true)}>
                <RotateCcw size={16} /> Volver a los datos iniciales
              </Button>
              <Button variant="outline" onClick={salir}>
                <LogOut size={16} /> Cerrar sesión
              </Button>
            </div>
          )}
        </Card>
      </Section>
    </div>
  )
}
