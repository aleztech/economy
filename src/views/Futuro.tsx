import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store'
import { alquilerVsCompra, aportacionNecesaria, planPiso, proyeccion, resumir } from '../lib/calc'
import { eur, eurCorto, etiquetaMes, etiquetaMesLarga } from '../lib/format'
import { Badge, Card, Field, Legend, NumberInput, Progress, Section, Stat, Toggle, TooltipBox } from '../components/ui'

export default function Futuro() {
  const { estado, set } = useStore()
  const a = estado.ajustes
  const [extra, setExtra] = useState(0)
  const r = useMemo(() => resumir(estado), [estado])
  const p = useMemo(() => proyeccion(estado, extra), [estado, extra])
  const base = useMemo(() => proyeccion(estado, 0), [estado])
  const nec = useMemo(() => aportacionNecesaria(estado), [estado])
  const piso = useMemo(() => planPiso(estado), [estado])
  const avc = useMemo(() => alquilerVsCompra(estado), [estado])
  const fin = p[p.length - 1]
  const finBase = base[base.length - 1]
  const datos = p.map((x) => ({ ...x, rango: [x.pes, x.opt] as [number, number] }))
  const setA = (patch: Partial<typeof a>) => set((e) => ({ ...e, ajustes: { ...e.ajustes, ...patch } }))
  const cruce = avc.find((x) => x.acumPropiedad < x.acumAlquiler && x.ano > 0)

  return (
    <div className="rise flex flex-col gap-10">
      {/* Jubilación */}
      <Section title={`Patrimonio invertido a los ${a.edadJubilacion}`} hint="En euros de hoy (rentabilidad real, ya descontada la inflación). Incluye fondos, plan de pensiones y alternativos.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Pesimista" value={eur(fin.pes)} sub={`${a.rentPes} % real anual`} />
          <Stat label="Base" value={eur(fin.base)} sub={`${a.rentBase} % real anual`} tone={fin.base >= fin.objetivo ? 'good' : 'warn'} />
          <Stat label="Optimista" value={eur(fin.opt)} sub={`${a.rentOpt} % real anual`} />
          <Stat label="Objetivo vivienda" value={eur(fin.objetivo)} sub={`Alquiler × 12 / ${a.tasaRetiro} %`} />
        </div>

        <Card className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="extra" className="text-[14px] font-medium">
                ¿Y si aportas más cada mes?
              </label>
              <span className="num text-[15px] font-semibold text-accent">+{eur(extra)}</span>
            </div>
            <input id="extra" type="range" min={0} max={2000} step={25} value={extra} onChange={(e) => setExtra(Number(e.target.value))} className="w-full" />
            <p className="text-[13px] text-muted">
              Ahora aportas {eur(r.aportFondos + r.aportPension)} al mes.{' '}
              {extra > 0 ? (
                <>
                  Con {eur(extra)} más llegarías a <strong className="text-fg">{eur(fin.base)}</strong> en el escenario base ({eur(fin.base - finBase.base)} más).
                </>
              ) : nec > 0 ? (
                <>Para cubrir el objetivo en el escenario base necesitas unos {eur(nec)} más al mes.</>
              ) : (
                <>En el escenario base ya cubres el objetivo.</>
              )}
            </p>
          </div>
          <Legend items={[{ label: 'Base', color: 'var(--c-cash)' }, { label: 'Rango pesimista–optimista', color: 'color-mix(in srgb, var(--c-cash) 25%, transparent)' }, { label: 'Objetivo', color: 'var(--warn)', dashed: true }, { label: 'Lo que aportas', color: 'var(--muted)', dashed: true }]} />
          <div className="-mx-2 h-64 md:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={datos} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="edad" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} tickFormatter={(v) => `${v} años`} />
                <YAxis tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={56} />
                <Tooltip
                  cursor={{ stroke: 'var(--line)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const x = payload[0].payload as (typeof datos)[number]
                    return (
                      <TooltipBox
                        title={`A los ${x.edad} años`}
                        rows={[
                          { label: 'Optimista', value: x.opt },
                          { label: 'Base', value: x.base, color: 'var(--c-cash)' },
                          { label: 'Pesimista', value: x.pes },
                          { label: 'Aportado', value: x.aportado, color: 'var(--muted)' },
                        ]}
                      />
                    )
                  }}
                />
                <Area dataKey="rango" stroke="none" fill="var(--c-cash)" fillOpacity={0.14} isAnimationActive={false} />
                <Line dataKey="aportado" stroke="var(--muted)" strokeDasharray="3 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line dataKey="base" stroke="var(--c-cash)" strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
                <ReferenceLine y={fin.objetivo} stroke="var(--warn)" strokeDasharray="5 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      {/* Piso */}
      <Section title="Plan piso" hint="Cuándo tendrás en efectivo la entrada, los gastos de compra y un colchón, al ritmo de tu previsión.">
        <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
          <Card className="flex flex-col gap-4 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="eyebrow">Fecha estimada</span>
              {piso.fecha ? <Badge tone={piso.mesesHasta === 0 ? 'good' : 'accent'}>{piso.mesesHasta === 0 ? 'Ya lo tienes' : `En ${piso.mesesHasta} meses`}</Badge> : <Badge tone="warn">Más de 12 años</Badge>}
            </div>
            <div className="text-[26px] font-semibold tracking-tight capitalize">{piso.fecha ? etiquetaMesLarga(piso.fecha) : 'Fuera de plazo'}</div>
            <div className="flex flex-col gap-1.5">
              <Progress value={piso.disponibleHoy} max={piso.necesario} />
              <div className="flex justify-between text-[12px] text-muted">
                <span className="num">Hoy {eur(piso.disponibleHoy)}</span>
                <span className="num">Necesitas {eur(piso.necesario)}</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-muted">Entrada ({a.entradaPct} %)</dt>
              <dd className="num text-right">{eur(piso.entrada)}</dd>
              <dt className="text-muted">Gastos de compra ({a.gastosCompraPct} %)</dt>
              <dd className="num text-right">{eur(piso.gastosCompra)}</dd>
              <dt className="text-muted">Colchón ({a.colchonMeses} meses)</dt>
              <dd className="num text-right">{eur(piso.colchon)}</dd>
              <dt className="text-muted">Cuota hipoteca</dt>
              <dd className="num text-right">{eur(piso.cuota)}/mes</dd>
              <dt className="text-muted">Coste total como propietario</dt>
              <dd className="num text-right">{eur(piso.costeMensualPropietario)}/mes</dd>
            </dl>
          </Card>
          <Card className="flex flex-col gap-3 p-4 md:p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio del piso">
                <NumberInput id="precio" value={a.precioPiso} onChange={(n) => setA({ precioPiso: n })} />
              </Field>
              <Field label="Tipo hipoteca">
                <NumberInput id="tipo" value={a.tipoHipoteca} suffix="%" onChange={(n) => setA({ tipoHipoteca: n })} />
              </Field>
              <Field label="Plazo">
                <NumberInput id="plazo" value={a.plazoHipoteca} suffix="años" onChange={(n) => setA({ plazoHipoteca: n })} />
              </Field>
              <Field label="Entrada">
                <NumberInput id="entrada" value={a.entradaPct} suffix="%" onChange={(n) => setA({ entradaPct: n })} />
              </Field>
            </div>
            <Toggle checked={a.usarFondosParaPiso} onChange={(v) => setA({ usarFondosParaPiso: v })} label="Contar los fondos líquidos para la entrada" />
            <div className="-mx-2 h-40 md:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={piso.serie} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                  <XAxis dataKey="ym" tickFormatter={etiquetaMes} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                  <YAxis tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
                  <ReferenceLine y={piso.necesario} stroke="var(--warn)" strokeDasharray="5 4" />
                  <Tooltip cursor={{ stroke: 'var(--line)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={etiquetaMes(String(payload[0].payload.ym))} rows={[{ label: 'Disponible', value: Number(payload[0].value), color: 'var(--c-cash)' }, { label: 'Necesario', value: piso.necesario }]} /> : null)} />
                  <Area type="monotone" dataKey="disponible" stroke="var(--c-cash)" strokeWidth={2} fill="var(--c-cash)" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </Section>

      {/* Alquiler vs compra */}
      <Section title="Alquilar o comprar" hint={`Coste mensual en euros corrientes. El alquiler sube un ${a.subidaAlquiler} % al año; la cuota de la hipoteca es fija y desaparece al terminar.`}>
        <Card className="flex flex-col gap-3 p-4 md:p-5">
          <Legend items={[{ label: 'Alquiler', color: 'var(--c-out)' }, { label: 'Propiedad (cuota + gastos)', color: 'var(--c-in)' }]} />
          <div className="-mx-2 h-56 md:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={avc} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="edad" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} tickFormatter={(v) => `${v} años`} />
                <YAxis tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip cursor={{ stroke: 'var(--line)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={`A los ${payload[0].payload.edad} años`} rows={[{ label: 'Alquiler', value: Number(payload[0].payload.alquiler), color: 'var(--c-out)' }, { label: 'Propiedad', value: Number(payload[0].payload.propiedad), color: 'var(--c-in)' }]} /> : null)} />
                <Line dataKey="alquiler" stroke="var(--c-out)" strokeWidth={2} dot={false} />
                <Line dataKey="propiedad" stroke="var(--c-in)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            A los {a.edadJubilacion} pagarías {eur(avc[Math.min(avc.length - 1, a.edadJubilacion - a.edad)].alquiler)} al mes de alquiler.
            {cruce ? ` El gasto acumulado como propietario baja del de inquilino a los ${cruce.edad} años.` : ''} No incluye la revalorización del piso ni lo que rendiría la entrada invertida.
          </p>
        </Card>
      </Section>
    </div>
  )
}
