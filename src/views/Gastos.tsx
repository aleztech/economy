import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pencil, Plus, Trash2, Target } from 'lucide-react'
import { useStore } from '../lib/store'
import { mensual, resumir, fvAnualidad } from '../lib/calc'
import { CATEGORIAS, uid, type Categoria, type Frecuencia, type Gasto, type Indexacion } from '../lib/types'
import { eur, eurCorto, MESES_LARGOS } from '../lib/format'
import { Badge, Button, Card, Field, NumberInput, Section, Select, Stat, TextInput, Toggle, TooltipBox } from '../components/ui'

const FREQ: Record<Frecuencia, string> = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }

export default function Gastos() {
  const { estado, set } = useStore()
  const r = useMemo(() => resumir(estado), [estado])
  const [abierto, setAbierto] = useState<string | null>(null)
  const [vista, setVista] = useState<'categoria' | 'importe'>('categoria')

  const actualizar = (id: string, patch: Partial<Gasto>) => set((e) => ({ ...e, gastos: e.gastos.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
  const borrar = (id: string) => set((e) => ({ ...e, gastos: e.gastos.filter((g) => g.id !== id) }))
  const nuevo = (categoria: Categoria = 'Otros') => {
    const id = uid()
    set((e) => ({ ...e, gastos: [...e.gastos, { id, nombre: 'Nuevo gasto', categoria, importe: 0, frecuencia: 'mensual' }] }))
    setAbierto(id)
  }

  const ahorroObjetivos = estado.gastos.reduce((s, g) => s + (g.objetivo != null && g.objetivo < mensual(g) ? mensual(g) - g.objetivo : 0), 0)
  const a = estado.ajustes
  const anos = a.edadJubilacion - a.edad

  const grupos = useMemo(() => {
    const m = new Map<Categoria, Gasto[]>()
    for (const c of CATEGORIAS) m.set(c, [])
    for (const g of estado.gastos) m.get(g.categoria)!.push(g)
    return [...m.entries()].filter(([, l]) => l.length)
  }, [estado.gastos])

  const ordenados = useMemo(() => [...estado.gastos].sort((x, y) => mensual(y) - mensual(x)), [estado.gastos])

  return (
    <div className="rise flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total al mes" value={eur(r.gastoMes)} sub={`${eur(r.gastoMes * 12)} al año`} />
        <Stat label="Fijos" value={eur(r.gastoFijoMes)} sub="Vivienda, familia, suministros…" />
        <Stat label="Variables" value={eur(r.gastoVariableMes)} sub="Donde más margen hay" />
        <Stat label="Recorte objetivo" value={eur(ahorroObjetivos)} sub={ahorroObjetivos ? `${eur(fvAnualidad(ahorroObjetivos * 12, a.rentBase / 100, anos))} a los ${a.edadJubilacion}` : 'Fija objetivos en cada gasto'} tone={ahorroObjetivos ? 'good' : undefined} />
      </div>

      {r.porCategoria.length > 0 && (
        <Section title="Por categoría" hint="Equivalente mensual (los gastos anuales y trimestrales se prorratean).">
          <Card className="p-2 pt-3 md:p-4">
            <div style={{ height: Math.max(140, r.porCategoria.length * 38) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.porCategoria} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }} barCategoryGap={8}>
                  <CartesianGrid horizontal={false} stroke="var(--c-grid)" />
                  <XAxis type="number" tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="categoria" width={112} tick={{ fontSize: 12, fill: 'var(--fg)' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={String(payload[0].payload.categoria)} rows={[{ label: 'Al mes', value: Number(payload[0].value) }, { label: 'Al año', value: Number(payload[0].value) * 12 }]} /> : null)} />
                  <Bar dataKey="importe" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {r.porCategoria.map((c) => (
                      <Cell key={c.categoria} fill={c.categoria === 'Vivienda' || c.categoria === 'Familia' ? 'var(--muted)' : 'var(--c-out)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="px-2 pt-1 text-[12px] text-muted">En gris, gastos que no dependen de ti a corto plazo.</p>
          </Card>
        </Section>
      )}

      <Section
        title="Gastos recurrentes"
        hint="Toca un gasto para editarlo. Fija un objetivo para medir cuánto liberas."
        action={
          <Button onClick={() => nuevo()} className="h-9 px-3">
            <Plus size={16} /> Añadir
          </Button>
        }
      >
        <div className="flex gap-2">
          {(['categoria', 'importe'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setVista(v)} className={clsx('h-8 rounded-full border px-3 text-[12.5px] font-medium', vista === v ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted')}>
              {v === 'categoria' ? 'Por categoría' : 'De mayor a menor'}
            </button>
          ))}
        </div>

        {vista === 'categoria' ? (
          <div className="flex flex-col gap-5">
            {grupos.map(([cat, lista]) => (
              <div key={cat} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="eyebrow">{cat}</span>
                  <span className="num text-[12px] text-muted">{eur(lista.reduce((s, g) => s + mensual(g), 0))}/mes</span>
                </div>
                <Card className="divide-y divide-line overflow-hidden">
                  {lista.map((g) => (
                    <FilaGasto key={g.id} g={g} abierto={abierto === g.id} onToggle={() => setAbierto(abierto === g.id ? null : g.id)} onChange={(p) => actualizar(g.id, p)} onBorrar={() => borrar(g.id)} />
                  ))}
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {ordenados.map((g) => (
              <FilaGasto key={g.id} g={g} conCategoria abierto={abierto === g.id} onToggle={() => setAbierto(abierto === g.id ? null : g.id)} onChange={(p) => actualizar(g.id, p)} onBorrar={() => borrar(g.id)} />
            ))}
          </Card>
        )}
      </Section>
    </div>
  )
}

function FilaGasto({ g, abierto, onToggle, onChange, onBorrar, conCategoria }: { g: Gasto; abierto: boolean; onToggle: () => void; onChange: (p: Partial<Gasto>) => void; onBorrar: () => void; conCategoria?: boolean }) {
  const [confirmar, setConfirmar] = useState(false)
  const m = mensual(g)
  const vacio = !g.importe
  const conObjetivo = g.objetivo != null && g.objetivo < m
  const editar = () => {
    if (!abierto) onToggle()
    window.setTimeout(() => {
      const el = document.getElementById(`n-${g.id}`) as HTMLInputElement | null
      el?.focus()
      el?.select()
    }, 30)
  }

  if (confirmar)
    return (
      <div className="flex items-center gap-3 bg-bad-soft/60 px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-[14px]">
          ¿Eliminar <strong>{g.nombre}</strong>?
        </span>
        <Button variant="ghost" className="h-9 px-3" onClick={() => setConfirmar(false)}>
          Cancelar
        </Button>
        <Button variant="danger" className="h-9 bg-surface px-3" onClick={onBorrar}>
          Eliminar
        </Button>
      </div>
    )

  return (
    <div className={clsx(abierto && 'bg-surface-2/50')}>
      <div className="flex items-center gap-1 pr-2">
        <button type="button" onClick={onToggle} aria-expanded={abierto} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[14.5px] font-medium">{g.nombre}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              {conCategoria && <Badge>{g.categoria}</Badge>}
              {g.frecuencia !== 'mensual' && <Badge tone="info">{FREQ[g.frecuencia]} · {eur(g.importe)}</Badge>}
              {g.fijo && <Badge>Fijo</Badge>}
              {vacio && <Badge tone="warn">Sin rellenar</Badge>}
              {conObjetivo && (
                <Badge tone="good">
                  <Target size={11} /> {eur(g.objetivo!)}
                </Badge>
              )}
            </span>
          </div>
          <span className={clsx('num shrink-0 text-[15px] font-medium', vacio && 'text-muted')}>{eur(m, m % 1 !== 0)}</span>
        </button>
        <button type="button" onClick={editar} aria-label={`Editar ${g.nombre}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
          <Pencil size={16} />
        </button>
        <button type="button" onClick={() => setConfirmar(true)} aria-label={`Eliminar ${g.nombre}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad">
          <Trash2 size={16} />
        </button>
      </div>

      {abierto && (
        <div className="grid grid-cols-2 gap-3 px-4 pt-1 pb-4">
          <Field label="Nombre" className="col-span-2">
            <TextInput id={`n-${g.id}`} value={g.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
          </Field>
          <Field label="Importe">
            <NumberInput id={`i-${g.id}`} value={g.importe} onChange={(n) => onChange({ importe: n })} />
          </Field>
          <Field label="Frecuencia">
            <Select id={`f-${g.id}`} value={g.frecuencia} onChange={(e) => onChange({ frecuencia: e.target.value as Frecuencia })}>
              {Object.entries(FREQ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoría">
            <Select id={`c-${g.id}`} value={g.categoria} onChange={(e) => onChange({ categoria: e.target.value as Categoria })}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          {g.frecuencia !== 'mensual' ? (
            <Field label={g.frecuencia === 'anual' ? 'Mes de cargo' : 'Primer mes'}>
              <Select id={`m-${g.id}`} value={g.mes ?? 1} onChange={(e) => onChange({ mes: Number(e.target.value) })}>
                {MESES_LARGOS.map((n, i) => (
                  <option key={n} value={i + 1}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Objetivo al mes">
              <NumberInput id={`o-${g.id}`} optional value={g.objetivo} onChange={(n) => onChange({ objetivo: n })} />
            </Field>
          )}
          {g.frecuencia !== 'mensual' && (
            <Field label="Objetivo (equivalente al mes)" className="col-span-2">
              <NumberInput id={`o2-${g.id}`} optional value={g.objetivo} onChange={(n) => onChange({ objetivo: n })} />
            </Field>
          )}
          <Field label="Cómo sube con los años">
            <Select id={`x-${g.id}`} value={g.indexa ?? (g.categoria === 'Vivienda' ? 'alquiler' : 'ipc')} onChange={(e) => onChange({ indexa: e.target.value as Indexacion })}>
              <option value="ipc">Con la inflación</option>
              <option value="alquiler">Como el alquiler (aniversario)</option>
              <option value="propia">Un % propio</option>
              <option value="ninguna">No sube</option>
            </Select>
          </Field>
          {g.indexa === 'propia' ? (
            <Field label="% anual">
              <NumberInput id={`s-${g.id}`} value={g.subida} suffix="%" onChange={(n) => onChange({ subida: n })} />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Nota" className="col-span-2">
            <TextInput id={`t-${g.id}`} value={g.nota ?? ''} placeholder="Opcional" onChange={(e) => onChange({ nota: e.target.value || undefined })} />
          </Field>
          <div className="col-span-2 flex items-center justify-between gap-3 pt-1">
            <Toggle checked={!!g.fijo} onChange={(v) => onChange({ fijo: v })} label="Gasto fijo" />
            <Button variant="outline" className="h-9 px-3" onClick={onToggle}>
              Listo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
