import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { resumir } from '../lib/calc'
import { uid, type Activo, type TipoActivo } from '../lib/types'
import { eur, pct } from '../lib/format'
import { Badge, Button, Card, Field, NumberInput, Section, Select, Stat, TextInput, Toggle } from '../components/ui'

const TIPOS: Record<TipoActivo, { label: string; color: string }> = {
  indexado: { label: 'Fondo indexado', color: '#2a78d6' },
  'gestion-activa': { label: 'Gestión activa', color: '#eb6834' },
  pension: { label: 'Plan de pensiones', color: '#7a6fd0' },
  alternativo: { label: 'Alternativo', color: '#eda100' },
  efectivo: { label: 'Efectivo', color: '#1baf7a' },
}

export default function Patrimonio() {
  const { estado, set } = useStore()
  const r = useMemo(() => resumir(estado), [estado])
  const [abierto, setAbierto] = useState<string | null>(null)
  const up = (id: string, p: Partial<Activo>) => set((e) => ({ ...e, activos: e.activos.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
  const borrar = (id: string) => set((e) => ({ ...e, activos: e.activos.filter((x) => x.id !== id) }))
  const nuevo = () => {
    const id = uid()
    set((e) => ({ ...e, activos: [...e.activos, { id, nombre: 'Nuevo activo', valor: 0, tipo: 'indexado', liquido: true }] }))
    setAbierto(id)
  }

  const porTipo = useMemo(() => {
    const m = new Map<TipoActivo, number>()
    for (const x of estado.activos) m.set(x.tipo, (m.get(x.tipo) ?? 0) + x.valor)
    return [...m.entries()].map(([tipo, valor]) => ({ tipo, valor })).sort((a, b) => b.valor - a.valor)
  }, [estado.activos])

  const invertidos = estado.activos.filter((x) => x.tipo !== 'efectivo' && x.valor > 0)
  const costeMedio = invertidos.reduce((s, x) => s + x.valor * (x.coste ?? 0), 0) / Math.max(1, invertidos.reduce((s, x) => s + x.valor, 0))
  const disponible = r.efectivo + r.liquidoInvertido

  return (
    <div className="rise flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={eur(r.patrimonio)} sub={`${(r.patrimonio / Math.max(1, r.ingresoMedioMes)).toFixed(0)} meses de ingresos`} />
        <Stat label="Disponible" value={eur(disponible)} sub="Efectivo + fondos que puedes vender" />
        <Stat label="Efectivo" value={eur(r.efectivo)} sub={`${Number.isFinite(r.mesesColchon) ? r.mesesColchon.toFixed(1) : '—'} meses de gastos`} />
        <Stat label="Coste medio" value={`${costeMedio.toFixed(2).replace('.', ',')} %`} sub="Ponderado por saldo invertido" tone={costeMedio > 0.6 ? 'warn' : 'good'} />
      </div>

      <Section title="Composición">
        <Card className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
            {porTipo.map((t) => (
              <div key={t.tipo} style={{ width: `${(t.valor / Math.max(1, r.patrimonio)) * 100}%`, background: TIPOS[t.tipo].color }} className="h-full first:rounded-l-full last:rounded-r-full" />
            ))}
          </div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {porTipo.map((t) => (
              <li key={t.tipo} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TIPOS[t.tipo].color }} />
                  {TIPOS[t.tipo].label}
                </span>
                <span className="num text-muted">
                  {eur(t.valor)} · {pct(t.valor / Math.max(1, r.patrimonio))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section
        title="Cuentas y fondos"
        hint="Actualiza los saldos cuando quieras: las previsiones y recomendaciones se recalculan."
        action={
          <Button className="h-9 px-3" onClick={nuevo}>
            <Plus size={16} /> Añadir
          </Button>
        }
      >
        <Card className="divide-y divide-line overflow-hidden">
          {[...estado.activos]
            .sort((a, b) => b.valor - a.valor)
            .map((x) => (
              <div key={x.id} className={clsx(abierto === x.id && 'bg-surface-2/50')}>
                <button type="button" onClick={() => setAbierto(abierto === x.id ? null : x.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: TIPOS[x.tipo].color }} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14.5px] font-medium">{x.nombre}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge>{TIPOS[x.tipo].label}</Badge>
                      {x.coste != null && <Badge tone={x.coste >= 1 ? 'warn' : 'neutral'}>{String(x.coste).replace('.', ',')} % anual</Badge>}
                      {!x.liquido && <Badge tone="info">No disponible</Badge>}
                    </span>
                  </div>
                  <span className="num shrink-0 text-[15px] font-medium">{eur(x.valor)}</span>
                  <ChevronDown size={16} className={clsx('shrink-0 text-muted transition-transform', abierto === x.id && 'rotate-180')} />
                </button>
                {abierto === x.id && (
                  <div className="grid grid-cols-2 gap-3 px-4 pt-1 pb-4">
                    <Field label="Nombre" className="col-span-2">
                      <TextInput id={`pn-${x.id}`} value={x.nombre} onChange={(e) => up(x.id, { nombre: e.target.value })} />
                    </Field>
                    <Field label="Valor actual">
                      <NumberInput id={`pv-${x.id}`} value={x.valor} onChange={(n) => up(x.id, { valor: n })} />
                    </Field>
                    <Field label="Coste anual">
                      <NumberInput id={`pc-${x.id}`} optional suffix="%" value={x.coste} onChange={(n) => up(x.id, { coste: n })} />
                    </Field>
                    <Field label="Tipo" className="col-span-2">
                      <Select id={`pt-${x.id}`} value={x.tipo} onChange={(e) => up(x.id, { tipo: e.target.value as TipoActivo })}>
                        {Object.entries(TIPOS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="col-span-2 flex items-center justify-between">
                      <Toggle checked={x.liquido} onChange={(v) => up(x.id, { liquido: v })} label="Disponible si lo necesito" />
                      <Button variant="ghost" className="h-9 px-3" onClick={() => borrar(x.id)} aria-label="Eliminar">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </Card>
      </Section>
    </div>
  )
}
