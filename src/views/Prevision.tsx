import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { flujo, resumir } from '../lib/calc'
import { uid, type Aportacion, type Destino, type Evento, type Ingreso } from '../lib/types'
import { eur, eurCorto, etiquetaMes, MESES_LARGOS } from '../lib/format'
import { Button, Card, Field, Legend, NumberInput, Section, Segmented, Select, TextInput, TooltipBox } from '../components/ui'

const DESTINOS: Record<Destino, string> = { fondos: 'Fondos / inversión', pension: 'Plan de pensiones', colchon: 'Colchón (se queda en cuenta)', piso: 'Ahorro piso (se queda en cuenta)' }

export default function Prevision() {
  const { estado, set } = useStore()
  const [meses, setMeses] = useState<'12' | '24'>('12')
  const f = useMemo(() => flujo(estado, Number(meses)), [estado, meses])
  const r = useMemo(() => resumir(estado), [estado])
  const datos = f.map((m) => ({ ...m, gastosNeg: m.gastos, extraNeg: m.extraordinarios, aportNeg: m.aportaciones }))
  const totalNeto = f.reduce((s, m) => s + m.neto, 0)

  return (
    <div className="rise flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-muted">Lo que entra y sale de tu cuenta mes a mes, con el variable, la devolución de la renta, los gastos anuales y los extraordinarios en su mes real.</p>
        <Segmented value={meses} onChange={setMeses} options={[{ value: '12', label: '12 meses' }, { value: '24', label: '24 meses' }]} />
      </div>

      <Section title="Entradas y salidas" hint={`Saldo neto del periodo: ${eur(totalNeto)}`}>
        <Card className="flex flex-col gap-3 p-2 pt-4 md:p-4">
          <div className="px-2">
            <Legend items={[{ label: 'Ingresos', color: 'var(--c-in)' }, { label: 'Gastos', color: 'var(--c-out)' }, { label: 'Extraordinarios', color: 'var(--c-extra)' }, { label: 'Inversión', color: 'var(--c-cash)' }]} />
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ left: 0, right: 8, top: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="ym" tickFormatter={etiquetaMes} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
                <YAxis tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const m = payload[0].payload as (typeof datos)[number]
                    return (
                      <TooltipBox
                        title={etiquetaMes(m.ym)}
                        rows={[
                          { label: 'Ingresos', value: m.ingresos, color: 'var(--c-in)' },
                          { label: 'Gastos', value: m.gastos, color: 'var(--c-out)' },
                          ...(m.extraordinarios ? [{ label: 'Extraordinarios', value: m.extraordinarios, color: 'var(--c-extra)' }] : []),
                          { label: 'Inversión', value: m.aportaciones, color: 'var(--c-cash)' },
                          { label: 'Neto', value: m.neto },
                        ]}
                      />
                    )
                  }}
                />
                <Bar dataKey="ingresos" fill="var(--c-in)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="gastosNeg" stackId="s" fill="var(--c-out)" maxBarSize={18} />
                <Bar dataKey="aportNeg" stackId="s" fill="var(--c-cash)" maxBarSize={18} />
                <Bar dataKey="extraNeg" stackId="s" fill="var(--c-extra)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      <Section title="Efectivo disponible" hint="Lo que tendrías en cuenta a final de cada mes si se cumple la previsión.">
        <Card className="p-2 pt-4 md:p-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={f} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCash2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-cash)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--c-cash)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="ym" tickFormatter={etiquetaMes} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
                <YAxis tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
                <ReferenceLine y={r.gastoMes * 3} stroke="var(--warn)" strokeDasharray="4 4" />
                <Tooltip cursor={{ stroke: 'var(--line)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={etiquetaMes(String(payload[0].payload.ym))} rows={[{ label: 'Efectivo', value: Number(payload[0].value), color: 'var(--c-cash)' }]} /> : null)} />
                <Area type="monotone" dataKey="efectivo" stroke="var(--c-cash)" strokeWidth={2} fill="url(#gCash2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      <Section title="Mes a mes">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-2.5 font-medium">Mes</th>
                <th className="px-3 py-2.5 text-right font-medium">Entra</th>
                <th className="px-3 py-2.5 text-right font-medium">Sale</th>
                <th className="px-3 py-2.5 text-right font-medium">Neto</th>
                <th className="px-3 py-2.5 text-right font-medium">Efectivo</th>
                <th className="px-4 py-2.5 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {f.map((m) => (
                <tr key={m.ym}>
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{etiquetaMes(m.ym)}</td>
                  <td className="num px-3 py-2.5 text-right">{eur(m.ingresos)}</td>
                  <td className="num px-3 py-2.5 text-right">{eur(m.gastos + m.extraordinarios + m.aportaciones)}</td>
                  <td className={clsx('num px-3 py-2.5 text-right', m.neto < 0 ? 'text-bad' : 'text-good')}>{eur(m.neto)}</td>
                  <td className="num px-3 py-2.5 text-right">{eur(m.efectivo)}</td>
                  <td className="px-4 py-2.5 text-muted">{m.notas.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Ingresos lista={estado.ingresos} onSet={(ingresos) => set((e) => ({ ...e, ingresos }))} />
      <Aportaciones lista={estado.aportaciones} onSet={(aportaciones) => set((e) => ({ ...e, aportaciones }))} />
      <Eventos lista={estado.eventos} inicio={estado.ajustes.inicio} onSet={(eventos) => set((e) => ({ ...e, eventos }))} />
    </div>
  )
}

function Fila({ children, onBorrar }: { children: React.ReactNode; onBorrar: () => void }) {
  return (
    <div className="flex items-end gap-2 px-4 py-3">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
      <Button variant="ghost" className="h-10 w-10 shrink-0 px-0" onClick={onBorrar} aria-label="Eliminar">
        <Trash2 size={16} />
      </Button>
    </div>
  )
}

function Ingresos({ lista, onSet }: { lista: Ingreso[]; onSet: (l: Ingreso[]) => void }) {
  const up = (id: string, p: Partial<Ingreso>) => onSet(lista.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <Section title="Ingresos" hint="Netos. Los anuales se cobran en el mes que indiques." action={<Button className="h-9 px-3" onClick={() => onSet([...lista, { id: uid(), nombre: 'Nuevo ingreso', importe: 0, frecuencia: 'mensual' }])}><Plus size={16} /> Añadir</Button>}>
      <Card className="divide-y divide-line">
        {lista.map((i) => (
          <Fila key={i.id} onBorrar={() => onSet(lista.filter((x) => x.id !== i.id))}>
            <Field label="Concepto" className="col-span-2">
              <TextInput id={`in-${i.id}`} value={i.nombre} onChange={(e) => up(i.id, { nombre: e.target.value })} />
            </Field>
            <Field label="Importe">
              <NumberInput id={`ii-${i.id}`} value={i.importe} onChange={(n) => up(i.id, { importe: n })} />
            </Field>
            <Field label="Cuándo">
              <Select id={`if-${i.id}`} value={i.frecuencia === 'mensual' ? 'm' : String(i.mes ?? 1)} onChange={(e) => (e.target.value === 'm' ? up(i.id, { frecuencia: 'mensual', mes: undefined }) : up(i.id, { frecuencia: 'anual', mes: Number(e.target.value) }))}>
                <option value="m">Cada mes</option>
                {MESES_LARGOS.map((n, k) => (
                  <option key={n} value={k + 1}>
                    Anual, en {n}
                  </option>
                ))}
              </Select>
            </Field>
          </Fila>
        ))}
      </Card>
    </Section>
  )
}

function Aportaciones({ lista, onSet }: { lista: Aportacion[]; onSet: (l: Aportacion[]) => void }) {
  const up = (id: string, p: Partial<Aportacion>) => onSet(lista.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <Section title="Aportaciones mensuales" hint="Lo que apartas cada mes y adónde va." action={<Button className="h-9 px-3" onClick={() => onSet([...lista, { id: uid(), nombre: 'Nueva aportación', importe: 0, destino: 'fondos' }])}><Plus size={16} /> Añadir</Button>}>
      <Card className="divide-y divide-line">
        {lista.map((a) => (
          <Fila key={a.id} onBorrar={() => onSet(lista.filter((x) => x.id !== a.id))}>
            <Field label="Concepto" className="col-span-2">
              <TextInput id={`an-${a.id}`} value={a.nombre} onChange={(e) => up(a.id, { nombre: e.target.value })} />
            </Field>
            <Field label="Al mes">
              <NumberInput id={`ai-${a.id}`} value={a.importe} onChange={(n) => up(a.id, { importe: n })} />
            </Field>
            <Field label="Destino">
              <Select id={`ad-${a.id}`} value={a.destino} onChange={(e) => up(a.id, { destino: e.target.value as Destino })}>
                {Object.entries(DESTINOS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </Fila>
        ))}
        {!lista.length && <p className="p-4 text-[13px] text-muted">Sin aportaciones.</p>}
      </Card>
    </Section>
  )
}

function Eventos({ lista, inicio, onSet }: { lista: Evento[]; inicio: string; onSet: (l: Evento[]) => void }) {
  const up = (id: string, p: Partial<Evento>) => onSet(lista.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <Section title="Extraordinarios" hint="Compras o ingresos puntuales: coche, viaje, venta de algo…" action={<Button className="h-9 px-3" onClick={() => onSet([...lista, { id: uid(), nombre: 'Nuevo', importe: 0, fecha: inicio, tipo: 'gasto' }])}><Plus size={16} /> Añadir</Button>}>
      <Card className="divide-y divide-line">
        {lista.map((ev) => (
          <Fila key={ev.id} onBorrar={() => onSet(lista.filter((x) => x.id !== ev.id))}>
            <Field label="Concepto">
              <TextInput id={`en-${ev.id}`} value={ev.nombre} onChange={(e) => up(ev.id, { nombre: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <Select id={`et-${ev.id}`} value={ev.tipo} onChange={(e) => up(ev.id, { tipo: e.target.value as Evento['tipo'] })}>
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </Select>
            </Field>
            <Field label="Importe">
              <NumberInput id={`ei-${ev.id}`} value={ev.importe} onChange={(n) => up(ev.id, { importe: n })} />
            </Field>
            <Field label="Mes">
              <TextInput id={`ef-${ev.id}`} type="month" value={ev.fecha} onChange={(e) => e.target.value && up(ev.id, { fecha: e.target.value })} />
            </Field>
          </Fila>
        ))}
        {!lista.length && <p className="p-4 text-[13px] text-muted">Sin extraordinarios previstos.</p>}
      </Card>
    </Section>
  )
}
