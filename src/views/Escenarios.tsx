import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ShieldAlert, Sparkles } from 'lucide-react'
import { useStore } from '../lib/store'
import { conObjetivos, flujo, fvAnualidad, mensual, mesesHorizonte, planPiso, porAnos, pruebasEstres, resumir } from '../lib/calc'
import { DISCRECIONALES, type Estado } from '../lib/types'
import { eur, eurCorto, etiquetaMesLarga } from '../lib/format'
import { Badge, Card, Legend, Section, Stat, TooltipBox } from '../components/ui'

/** Aplica objetivos de recorte y, además, un % de recorte al resto de gastos recortables. */
function escenarioAjuste(e: Estado, recortePct: number): Estado {
  const base = conObjetivos(e)
  if (!recortePct) return base
  return {
    ...base,
    gastos: base.gastos.map((g) => {
      const orig = e.gastos.find((x) => x.id === g.id)!
      if (orig.objetivo != null || !DISCRECIONALES.includes(g.categoria)) return g
      return { ...g, importe: g.importe * (1 - recortePct / 100) }
    }),
  }
}

export function Cinturon() {
  const { estado } = useStore()
  const a = estado.ajustes
  const [recorte, setRecorte] = useState(0)
  const n = mesesHorizonte(estado)
  const ajustado = useMemo(() => escenarioAjuste(estado, recorte), [estado, recorte])
  const r0 = useMemo(() => resumir(estado), [estado])
  const r1 = useMemo(() => resumir(ajustado), [ajustado])
  const a0 = useMemo(() => porAnos(flujo(estado, n)), [estado, n])
  const a1 = useMemo(() => porAnos(flujo(ajustado, n)), [ajustado, n])
  const p0 = useMemo(() => planPiso(estado), [estado])
  const p1 = useMemo(() => planPiso(ajustado), [ajustado])
  const ahorroMes = r0.gastoMes - r1.gastoMes
  const fin0 = a0[a0.length - 1]
  const fin1 = a1[a1.length - 1]
  const anosJub = a.edadJubilacion - a.edad
  const a67 = fvAnualidad(ahorroMes * 12, a.rentBase / 100, anosJub)
  const conObj = estado.gastos.filter((g) => g.objetivo != null && g.objetivo !== mensual(g))
  const datos = a0.map((x, i) => ({ ano: x.ano, actual: x.patrimonio, ajustado: a1[i].patrimonio }))
  const mesesAntes = p0.mesesHasta != null && p1.mesesHasta != null ? p0.mesesHasta - p1.mesesHasta : null

  return (
    <Section title="Si te ajustas el cinturón" hint="Compara tu ritmo actual con tus objetivos de recorte (los fijas en cada gasto) y un recorte extra en gastos variables.">
      <Card className="flex flex-col gap-5 p-4 md:p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="recorte" className="text-[14px] font-medium">
              Recorte extra en comida, ocio, transporte, suscripciones…
            </label>
            <span className="num text-[15px] font-semibold text-accent">−{recorte} %</span>
          </div>
          <input id="recorte" type="range" min={0} max={50} step={5} value={recorte} onChange={(e) => setRecorte(Number(e.target.value))} />
          <div className="flex flex-wrap gap-1.5">
            {conObj.length ? (
              conObj.map((g) => (
                <Badge key={g.id} tone={g.objetivo! < mensual(g) ? 'good' : 'warn'}>
                  {g.nombre}: {eur(mensual(g))} → {eur(g.objetivo!)}
                </Badge>
              ))
            ) : (
              <span className="text-[12.5px] text-muted">Aún no has fijado objetivos. En Gastos, abre un gasto (por ejemplo tabaco y alcohol) y pon cuánto quieres gastar.</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Liberas al mes" value={eur(ahorroMes)} sub={`${eur(ahorroMes * 12)} al año`} tone={ahorroMes > 0 ? 'good' : ahorroMes < 0 ? 'bad' : undefined} />
          <Stat label={`Más patrimonio a los ${fin0.edad}`} value={eur(fin1.patrimonio - fin0.patrimonio)} sub={`${eur(fin1.patrimonio)} en total`} tone={fin1.patrimonio > fin0.patrimonio ? 'good' : undefined} />
          <Stat label={`Invertido, a los ${a.edadJubilacion}`} value={eur(a67)} sub="En euros de hoy" />
          <Stat label="Piso" value={mesesAntes ? `${mesesAntes} meses antes` : '—'} sub={p1.fecha ? `Entrada en ${etiquetaMesLarga(p1.fecha)}` : 'Fuera de plazo'} tone={mesesAntes ? 'good' : undefined} />
        </div>

        <div className="flex flex-col gap-2">
          <Legend items={[{ label: 'Con el ajuste', color: 'var(--good)' }, { label: 'Ritmo actual', color: 'var(--muted)', dashed: true }]} />
          <div className="-mx-2 h-52 md:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datos} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="ano" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip cursor={{ stroke: 'var(--line)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={`Final de ${payload[0].payload.ano}`} rows={[{ label: 'Con el ajuste', value: Number(payload[0].payload.ajustado), color: 'var(--good)' }, { label: 'Ritmo actual', value: Number(payload[0].payload.actual), color: 'var(--muted)' }]} /> : null)} />
                <Line dataKey="actual" stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                <Line dataKey="ajustado" stroke="var(--good)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--good)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="flex items-start gap-2 text-[12.5px] text-muted">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
          Dejar tabaco y alcohol y comer más en casa no solo libera dinero: suele bajar también gastos en salud y ocio que aquí no se cuentan.
        </p>
      </Card>
    </Section>
  )
}

export function Riesgos() {
  const { estado } = useStore()
  const r = useMemo(() => resumir(estado), [estado])
  const est = useMemo(() => pruebasEstres(estado), [estado])
  const base = est[0]
  const runwayEfectivo = r.gastoMes > 0 ? r.efectivo / r.gastoMes : Infinity
  const runwayTotal = r.gastoMes > 0 ? (r.efectivo + r.liquidoInvertido) / r.gastoMes : Infinity
  const edadFin = estado.ajustes.edad + estado.ajustes.anosPrevision
  const fijos = r.ingresoMedioMes > 0 ? r.gastoFijoMes / r.ingresoMedioMes : 0

  return (
    <Section title="Riesgos" hint={`Qué pasa con tu patrimonio a los ${edadFin} si algo sale mal. Cada escenario repite la previsión con un golpe aplicado.`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sin ingresos aguantas" value={`${runwayEfectivo.toFixed(1)} meses`} sub="Solo con efectivo" tone={runwayEfectivo < 3 ? 'bad' : runwayEfectivo < 6 ? 'warn' : 'good'} />
        <Stat label="Vendiendo fondos" value={`${runwayTotal.toFixed(1)} meses`} sub="Efectivo + fondos líquidos" />
        <Stat label="Gastos fijos" value={`${Math.round(fijos * 100)} %`} sub="De tus ingresos medios" tone={fijos > 0.5 ? 'warn' : undefined} />
        <Stat label="Dependencia del variable" value={`${Math.round(((r.ingresoMedioMes - r.ingresoRecurrente) / Math.max(1, r.ingresoMedioMes)) * 100)} %`} sub="De tus ingresos anuales" />
      </div>
      <Card className="flex flex-col gap-3 p-4 md:p-5">
        <div className="eyebrow">Patrimonio a los {edadFin} por escenario</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={est} layout="vertical" margin={{ left: 0, right: 64, top: 0, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke="var(--c-grid)" />
              <XAxis type="number" tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="nombre" width={130} tick={{ fontSize: 12, fill: 'var(--fg)' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={String(payload[0].payload.nombre)} rows={[{ label: 'Patrimonio', value: Number(payload[0].payload.patrimonioFinal) }, { label: 'Efectivo final', value: Number(payload[0].payload.efectivoFinal) }, { label: 'Diferencia', value: Number(payload[0].payload.diferencia) }]} /> : null)} />
              <Bar dataKey="patrimonioFinal" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {est.map((x) => (
                  <Cell key={x.id} fill={x.id === 'base' ? 'var(--c-cash)' : 'var(--c-out)'} />
                ))}
                <LabelList dataKey="diferencia" position="right" formatter={(v: number) => (v ? eurCorto(v) : '')} style={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <ul className="grid gap-2.5 md:grid-cols-2">
        {est.slice(1).map((x) => {
          const grave = x.minimoEfectivo < r.gastoMes * 3
          return (
            <li key={x.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', grave ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn')}>
                <ShieldAlert size={18} />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-[14.5px] font-semibold">{x.nombre}</h3>
                <p className="text-[13px] text-muted">{x.descripcion}</p>
                <p className="text-[13px]">
                  Patrimonio <span className="num font-medium">{eur(x.diferencia)}</span> frente a la base. Efectivo mínimo <span className={clsx('num font-medium', grave && 'text-bad')}>{eur(x.minimoEfectivo)}</span> ({etiquetaMesLarga(x.mesMinimo)}).
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-[12px] text-muted">Base: {eur(base.patrimonioFinal)}. Los escenarios no suman entre sí; cada uno es un golpe aislado.</p>
    </Section>
  )
}
