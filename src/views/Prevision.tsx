import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { flujo, mesesHorizonte, porAnos, resumir } from '../lib/calc'
import { uid, type Aportacion, type Destino, type Evento, type Ingreso } from '../lib/types'
import { eur, eurCorto, etiquetaMes, MESES_LARGOS, pct } from '../lib/format'
import { Button, Card, Field, Legend, NumberInput, Section, Segmented, Select, Stat, TextInput, Toggle, TooltipBox } from '../components/ui'

const DESTINOS: Record<Destino, string> = { fondos: 'Fondos / inversión', pension: 'Plan de pensiones', colchon: 'Colchón (se queda en cuenta)', piso: 'Ahorro piso (se queda en cuenta)' }

const ejeX = { tick: { fontSize: 11, fill: 'var(--muted)' }, tickLine: false, axisLine: false } as const
const ejeY = { tickFormatter: eurCorto, tick: { fontSize: 11, fill: 'var(--muted)' }, tickLine: false, axisLine: false, width: 52 } as const

export default function Prevision() {
  const { estado, set } = useStore()
  const a = estado.ajustes
  const [horizonte, setHorizonte] = useState<'12' | '24' | 'h'>('h')
  const [modo, setModo] = useState<'anual' | 'mensual'>('anual')
  const meses = horizonte === 'h' ? mesesHorizonte(estado) : Number(horizonte)
  const f = useMemo(() => flujo(estado, meses), [estado, meses])
  const anos = useMemo(() => porAnos(f), [f])
  const r = useMemo(() => resumir(estado), [estado])
  const fin = f[f.length - 1]
  const tot = (k: 'neto' | 'alquiler' | 'familia' | 'ingresos' | 'gastos' | 'aportaciones') => f.reduce((s, x) => s + x[k], 0)
  const edadFin = fin.edad

  return (
    <div className="rise flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="max-w-2xl text-[14px] text-muted">
          Sueldo +{a.subidaSalario} % cada enero, variable y devolución del IRPF cada año, alquiler +{a.subidaAlquiler} % en cada aniversario, gastos corrientes +{a.inflacionGastos} % y tus extraordinarios en su mes. Todo se ajusta en Ajustes.
        </p>
        <div className="flex flex-wrap gap-2">
          <Segmented value={horizonte} onChange={setHorizonte} options={[{ value: '12', label: '12 meses' }, { value: '24', label: '24 meses' }, { value: 'h', label: `Hasta los ${a.edad + a.anosPrevision}` }]} />
          <Segmented value={modo} onChange={setModo} options={[{ value: 'anual', label: 'Por años' }, { value: 'mensual', label: 'Por meses' }]} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Patrimonio a los ${edadFin}`} value={eur(fin.patrimonio)} sub={`Hoy ${eur(r.patrimonio)}`} tone="good" />
        <Stat label={`Efectivo a los ${edadFin}`} value={eur(fin.efectivo)} sub={`Invertido ${eur(fin.invertido)}`} />
        <Stat label="Ahorro en el periodo" value={eur(tot('neto') + tot('aportaciones'))} sub={`${eur(tot('aportaciones'))} a inversión`} />
        <Stat label="Alquiler + pensión" value={eur(tot('alquiler') + tot('familia'))} sub={`${pct((tot('alquiler') + tot('familia')) / Math.max(1, tot('ingresos')))} de lo que ingresas`} tone="warn" />
      </div>

      {modo === 'anual' ? <VistaAnual anos={anos} /> : <VistaMensual f={f} umbral={r.gastoMes * 3} />}

      <Ingresos lista={estado.ingresos} onSet={(ingresos) => set((e) => ({ ...e, ingresos }))} />
      <Eventos lista={estado.eventos} inicio={a.inicio} onSet={(eventos) => set((e) => ({ ...e, eventos }))} />
      <Aportaciones lista={estado.aportaciones} onSet={(aportaciones) => set((e) => ({ ...e, aportaciones }))} />
    </div>
  )
}

function VistaAnual({ anos }: { anos: ReturnType<typeof porAnos> }) {
  const datos = anos.map((x) => ({ ...x, etiqueta: x.meses < 12 ? `${x.ano}*` : String(x.ano) }))
  return (
    <>
      <Section title="Progresión de gastos" hint="Alquiler y familia (pensión de alimentos y gastos de Alma) frente al resto. * Año incompleto.">
        <Card className="flex flex-col gap-3 p-2 pt-4 md:p-5">
          <div className="px-2">
            <Legend items={[{ label: 'Alquiler', color: 'var(--c-out)' }, { label: 'Familia', color: 'var(--c-extra)' }, { label: 'Resto', color: 'var(--muted)' }, { label: 'Extraordinarios', color: 'var(--warn)' }, { label: 'Ingresos', color: 'var(--c-in)', dashed: true }]} />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={datos} margin={{ left: 0, right: 8, top: 4, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="etiqueta" {...ejeX} />
                <YAxis {...ejeY} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const x = payload[0].payload as (typeof datos)[number]
                    return (
                      <TooltipBox
                        title={`${x.ano} · ${x.edad} años${x.meses < 12 ? ` (${x.meses} meses)` : ''}`}
                        rows={[
                          { label: 'Ingresos', value: x.ingresos, color: 'var(--c-in)' },
                          { label: 'Alquiler', value: x.alquiler, color: 'var(--c-out)' },
                          { label: 'Familia', value: x.familia, color: 'var(--c-extra)' },
                          { label: 'Resto', value: x.otrosGastos, color: 'var(--muted)' },
                          { label: 'Extraordinarios', value: x.extraordinarios, color: 'var(--warn)' },
                        ]}
                      />
                    )
                  }}
                />
                <Bar dataKey="alquiler" stackId="g" fill="var(--c-out)" maxBarSize={36} />
                <Bar dataKey="familia" stackId="g" fill="var(--c-extra)" maxBarSize={36} />
                <Bar dataKey="otrosGastos" stackId="g" fill="var(--muted)" fillOpacity={0.55} maxBarSize={36} />
                <Bar dataKey="extraordinarios" stackId="g" fill="var(--warn)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line dataKey="ingresos" stroke="var(--c-in)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: 'var(--c-in)' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      <Section title="Evolución del patrimonio" hint="Efectivo en cuenta más inversiones, con la rentabilidad base en euros corrientes.">
        <Card className="flex flex-col gap-3 p-2 pt-4 md:p-5">
          <div className="px-2">
            <Legend items={[{ label: 'Invertido', color: 'var(--c-in)' }, { label: 'Efectivo', color: 'var(--c-cash)' }]} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datos} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="etiqueta" {...ejeX} />
                <YAxis {...ejeY} />
                <Tooltip cursor={{ stroke: 'var(--line)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={`Final de ${payload[0].payload.ano}`} rows={[{ label: 'Efectivo', value: Number(payload[0].payload.efectivo), color: 'var(--c-cash)' }, { label: 'Invertido', value: Number(payload[0].payload.invertido), color: 'var(--c-in)' }, { label: 'Total', value: Number(payload[0].payload.patrimonio) }]} /> : null)} />
                <Area type="monotone" dataKey="invertido" stackId="p" stroke="var(--c-in)" strokeWidth={2} fill="var(--c-in)" fillOpacity={0.18} />
                <Area type="monotone" dataKey="efectivo" stackId="p" stroke="var(--c-cash)" strokeWidth={2} fill="var(--c-cash)" fillOpacity={0.22} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      <Section title="Año a año">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-right text-muted">
                <th className="px-4 py-2.5 text-left font-medium">Año</th>
                <th className="px-3 py-2.5 font-medium">Nómina</th>
                <th className="px-3 py-2.5 font-medium">Variable + IRPF</th>
                <th className="px-3 py-2.5 font-medium">Extra</th>
                <th className="px-3 py-2.5 font-medium">Alquiler</th>
                <th className="px-3 py-2.5 font-medium">Familia</th>
                <th className="px-3 py-2.5 font-medium">Resto</th>
                <th className="px-3 py-2.5 font-medium">Extraord.</th>
                <th className="px-3 py-2.5 font-medium">Ahorro</th>
                <th className="px-3 py-2.5 font-medium">Efectivo</th>
                <th className="px-4 py-2.5 font-medium">Patrimonio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {datos.map((x) => (
                <tr key={x.ano} className="num text-right">
                  <td className="px-4 py-2.5 text-left font-sans font-medium whitespace-nowrap">
                    {x.etiqueta} <span className="font-normal text-muted">· {x.edad}</span>
                  </td>
                  <td className="px-3 py-2.5">{eur(x.nomina)}</td>
                  <td className="px-3 py-2.5">{eur(x.ingresosAnuales)}</td>
                  <td className="px-3 py-2.5">{eur(x.ingresosExtra)}</td>
                  <td className="px-3 py-2.5">{eur(x.alquiler)}</td>
                  <td className="px-3 py-2.5">{eur(x.familia)}</td>
                  <td className="px-3 py-2.5">{eur(x.otrosGastos)}</td>
                  <td className="px-3 py-2.5">{eur(x.extraordinarios)}</td>
                  <td className={clsx('px-3 py-2.5', x.neto + x.aportaciones < 0 ? 'text-bad' : 'text-good')}>{eur(x.neto + x.aportaciones)}</td>
                  <td className="px-3 py-2.5">{eur(x.efectivo)}</td>
                  <td className="px-4 py-2.5 font-medium">{eur(x.patrimonio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-[12px] text-muted">Ahorro = ingresos − gastos − extraordinarios (incluye lo que va a inversión). Desliza la tabla en el móvil.</p>
      </Section>
    </>
  )
}

function VistaMensual({ f, umbral }: { f: ReturnType<typeof flujo>; umbral: number }) {
  const datos = f.map((m) => ({ ...m, salidaGastos: m.gastos }))
  return (
    <>
      <Section title="Entradas y salidas" hint={`Saldo neto del periodo: ${eur(f.reduce((s, m) => s + m.neto, 0))}`}>
        <Card className="flex flex-col gap-3 p-2 pt-4 md:p-4">
          <div className="px-2">
            <Legend items={[{ label: 'Ingresos', color: 'var(--c-in)' }, { label: 'Gastos', color: 'var(--c-out)' }, { label: 'Inversión', color: 'var(--c-cash)' }, { label: 'Extraordinarios', color: 'var(--c-extra)' }]} />
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ left: 0, right: 8, top: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="ym" tickFormatter={etiquetaMes} {...ejeX} interval="preserveStartEnd" minTickGap={14} />
                <YAxis {...ejeY} />
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
                          { label: 'Alquiler', value: m.alquiler, color: 'var(--c-out)' },
                          { label: 'Familia', value: m.familia, color: 'var(--c-out)' },
                          { label: 'Resto', value: m.otrosGastos, color: 'var(--c-out)' },
                          ...(m.extraordinarios ? [{ label: 'Extraordinarios', value: m.extraordinarios, color: 'var(--c-extra)' }] : []),
                          { label: 'Inversión', value: m.aportaciones, color: 'var(--c-cash)' },
                          { label: 'Neto', value: m.neto },
                        ]}
                      />
                    )
                  }}
                />
                <Bar dataKey="ingresos" fill="var(--c-in)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                <Bar dataKey="salidaGastos" stackId="s" fill="var(--c-out)" maxBarSize={16} />
                <Bar dataKey="aportaciones" stackId="s" fill="var(--c-cash)" maxBarSize={16} />
                <Bar dataKey="extraordinarios" stackId="s" fill="var(--c-extra)" radius={[4, 4, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      <Section title="Efectivo disponible" hint="Lo que tendrías en cuenta a final de cada mes. La línea discontinua marca 3 meses de gastos.">
        <Card className="p-2 pt-4 md:p-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={f} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="ym" tickFormatter={etiquetaMes} {...ejeX} interval="preserveStartEnd" minTickGap={14} />
                <YAxis {...ejeY} />
                <ReferenceLine y={umbral} stroke="var(--warn)" strokeDasharray="4 4" />
                <Tooltip cursor={{ stroke: 'var(--line)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={etiquetaMes(String(payload[0].payload.ym))} rows={[{ label: 'Efectivo', value: Number(payload[0].value), color: 'var(--c-cash)' }]} /> : null)} />
                <Area type="monotone" dataKey="efectivo" stroke="var(--c-cash)" strokeWidth={2} fill="var(--c-cash)" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      <Section title="Mes a mes">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-2.5 font-medium">Mes</th>
                <th className="px-3 py-2.5 text-right font-medium">Entra</th>
                <th className="px-3 py-2.5 text-right font-medium">Gastos</th>
                <th className="px-3 py-2.5 text-right font-medium">Inversión</th>
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
                  <td className="num px-3 py-2.5 text-right">{eur(m.gastos + m.extraordinarios)}</td>
                  <td className="num px-3 py-2.5 text-right">{eur(m.aportaciones)}</td>
                  <td className={clsx('num px-3 py-2.5 text-right', m.neto < 0 ? 'text-bad' : 'text-good')}>{eur(m.neto)}</td>
                  <td className="num px-3 py-2.5 text-right">{eur(m.efectivo)}</td>
                  <td className="px-4 py-2.5 text-muted">{m.notas.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </>
  )
}

function Fila({ children, onBorrar }: { children: React.ReactNode; onBorrar: () => void }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
      <Button variant="ghost" className="mt-6 h-10 w-10 shrink-0 px-0" onClick={onBorrar} aria-label="Eliminar">
        <Trash2 size={16} />
      </Button>
    </div>
  )
}

function Ingresos({ lista, onSet }: { lista: Ingreso[]; onSet: (l: Ingreso[]) => void }) {
  const up = (id: string, p: Partial<Ingreso>) => onSet(lista.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <Section title="Ingresos recurrentes" hint="Netos. Los anuales se cobran cada año en el mes que indiques." action={<Button className="h-9 px-3" onClick={() => onSet([...lista, { id: uid(), nombre: 'Nuevo ingreso', importe: 0, frecuencia: 'mensual' }])}><Plus size={16} /> Añadir</Button>}>
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
                    Cada año, en {n}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="col-span-2 sm:col-span-4">
              <Toggle checked={!!i.crece} onChange={(v) => up(i.id, { crece: v })} label="Sube cada año con la subida salarial" />
            </div>
          </Fila>
        ))}
      </Card>
    </Section>
  )
}

function Aportaciones({ lista, onSet }: { lista: Aportacion[]; onSet: (l: Aportacion[]) => void }) {
  const up = (id: string, p: Partial<Aportacion>) => onSet(lista.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <Section title="Aportaciones mensuales" hint="Lo que apartas cada mes y adónde va. Las anuales, divídelas entre 12." action={<Button className="h-9 px-3" onClick={() => onSet([...lista, { id: uid(), nombre: 'Nueva aportación', importe: 0, destino: 'fondos' }])}><Plus size={16} /> Añadir</Button>}>
      <Card className="divide-y divide-line">
        {lista.map((x) => (
          <Fila key={x.id} onBorrar={() => onSet(lista.filter((y) => y.id !== x.id))}>
            <Field label="Concepto" className="col-span-2">
              <TextInput id={`an-${x.id}`} value={x.nombre} onChange={(e) => up(x.id, { nombre: e.target.value })} />
            </Field>
            <Field label="Al mes">
              <NumberInput id={`ai-${x.id}`} value={x.importe} onChange={(n) => up(x.id, { importe: n })} />
            </Field>
            <Field label="Destino">
              <Select id={`ad-${x.id}`} value={x.destino} onChange={(e) => up(x.id, { destino: e.target.value as Destino })}>
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
  const add = (tipo: Evento['tipo']) => onSet([...lista, { id: uid(), nombre: tipo === 'gasto' ? 'Gasto extraordinario' : 'Ingreso extraordinario', importe: 0, fecha: inicio, tipo }])
  return (
    <Section
      title="Extraordinarios"
      hint="Gastos o ingresos puntuales en una fecha: coche, viaje, venta, retorno de una inversión…"
      action={
        <div className="flex gap-1.5">
          <Button variant="outline" className="h-9 px-3" onClick={() => add('gasto')}>
            <Plus size={16} /> Gasto
          </Button>
          <Button className="h-9 px-3" onClick={() => add('ingreso')}>
            <Plus size={16} /> Ingreso
          </Button>
        </div>
      }
    >
      <Card className="divide-y divide-line">
        {[...lista]
          .sort((x, y) => x.fecha.localeCompare(y.fecha))
          .map((ev) => (
            <Fila key={ev.id} onBorrar={() => onSet(lista.filter((x) => x.id !== ev.id))}>
              <Field label="Concepto" className="col-span-2 sm:col-span-1">
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
