import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { resumir, flujo, mesesHorizonte, porAnos } from '../lib/calc'
import { eur, eurCorto, pct, etiquetaMes } from '../lib/format'
import { Card, Section, Stat, TooltipBox } from '../components/ui'
import { Recomendaciones } from '../components/Recs'
import type { Vista } from '../App'

const COLORES_CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#008300', '#e34948']

export default function Resumen({ ir }: { ir: (v: Vista) => void }) {
  const { estado } = useStore()
  const r = useMemo(() => resumir(estado), [estado])
  const f = useMemo(() => flujo(estado, 12), [estado])
  const largo = useMemo(() => porAnos(flujo(estado, mesesHorizonte(estado))), [estado])
  const finLargo = largo[largo.length - 1]

  // Reparto del ingreso medio: categorías principales + aportaciones + lo que sobra.
  const reparto = useMemo(() => {
    const top = r.porCategoria.slice(0, 5)
    const resto = r.porCategoria.slice(5).reduce((s, c) => s + c.importe, 0)
    const items: { label: string; valor: number; color: string }[] = top.map((c, i) => ({ label: c.categoria, valor: c.importe, color: COLORES_CAT[i] }))
    if (resto > 0) items.push({ label: 'Resto de gastos', valor: resto, color: 'var(--muted)' })
    if (r.aportMes > 0) items.push({ label: 'Inversión', valor: r.aportMes, color: 'var(--accent)' })
    if (r.excedenteMes > 0) items.push({ label: 'Sin destino', valor: r.excedenteMes, color: 'var(--line)' })
    return items
  }, [r])
  const totalReparto = Math.max(r.ingresoMedioMes, reparto.reduce((s, i) => s + i.valor, 0))

  const hoy = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const minimo = f.reduce((m, x) => Math.min(m, x.efectivo), Infinity)

  return (
    <div className="rise flex flex-col gap-8">
      <Card className="relative overflow-hidden border-0 p-5 md:p-6" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 92%, black) 0%, color-mix(in srgb, var(--accent) 70%, var(--c-in)) 100%)' }}>
        <div className="relative z-10 flex flex-col gap-1 text-white">
          <span className="text-[12px] font-medium tracking-wide text-white/75 uppercase">Patrimonio previsto a los {finLargo.edad}</span>
          <span className="num text-[38px] leading-none font-semibold tracking-tight md:text-[44px]">{eur(finLargo.patrimonio)}</span>
          <span className="mt-1 text-[13.5px] text-white/85">
            Hoy {eur(r.patrimonio)} · {r.resultadoMes >= 0 ? `te sobran ${eur(r.resultadoMes)} al mes de media` : `te faltan ${eur(-r.resultadoMes)} al mes`}
          </span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={largo} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area type="monotone" dataKey="patrimonio" stroke="rgba(255,255,255,.9)" strokeWidth={2} fill="rgba(255,255,255,.18)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="h-10" />
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ingresos / mes" value={eur(r.ingresoMedioMes)} sub={`Nómina ${eur(r.ingresoRecurrente)} + extras prorrateados`} />
        <Stat label="Gastos / mes" value={eur(r.gastoMes)} sub={r.gastosSinRellenar ? `${r.gastosSinRellenar} gastos sin rellenar` : `Fijos ${eur(r.gastoFijoMes)}`} tone={r.gastosSinRellenar ? 'warn' : undefined} />
        <Stat label="Ahorro / mes" value={eur(r.resultadoMes)} sub={`Tasa de ahorro ${pct(r.tasaAhorro)}`} tone={r.resultadoMes < 0 ? 'bad' : r.tasaAhorro >= 0.2 ? 'good' : undefined} />
        <Stat label="Patrimonio" value={eur(r.patrimonio)} sub={`${eur(r.efectivo)} en efectivo`} />
      </div>

      <Section title="Adónde va tu dinero" hint={`Reparto del ingreso medio mensual · ${hoy}`}>
        <Card className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-surface-2">
            {reparto.map((i) => (
              <div key={i.label} title={`${i.label}: ${eur(i.valor)}`} style={{ width: `${(i.valor / totalReparto) * 100}%`, background: i.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
            ))}
          </div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {reparto.map((i) => (
              <li key={i.label} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: i.color }} />
                  <span className="truncate">{i.label}</span>
                </span>
                <span className="num shrink-0 text-muted">
                  {eur(i.valor)} · {pct(i.valor / Math.max(1, r.ingresoMedioMes))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section
        title="Liquidez próximos 12 meses"
        hint={`Mínimo previsto: ${eur(minimo)}`}
        action={
          <button type="button" onClick={() => ir('prevision')} className="flex items-center gap-1 text-[13px] font-medium text-accent">
            Ver previsión <ArrowRight size={14} />
          </button>
        }
      >
        <Card className="p-2 pt-4 md:p-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={f} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-cash)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--c-cash)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                <XAxis dataKey="ym" tickFormatter={etiquetaMes} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                <YAxis tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
                <ReferenceLine y={r.gastoMes * 3} stroke="var(--warn)" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ stroke: 'var(--line)' }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <TooltipBox title={etiquetaMes(String(payload[0].payload.ym))} rows={[{ label: 'Efectivo', value: Number(payload[0].value), color: 'var(--c-cash)' }, { label: 'Neto del mes', value: Number(payload[0].payload.neto) }]} />
                    ) : null
                  }
                />
                <Area type="monotone" dataKey="efectivo" stroke="var(--c-cash)" strokeWidth={2} fill="url(#gCash)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="px-2 pt-1 text-[12px] text-muted">La línea discontinua marca 3 meses de gastos, el colchón mínimo.</p>
        </Card>
      </Section>

      <Section title="Recomendaciones" hint="Se recalculan con cada cambio que haces en ingresos, gastos o patrimonio.">
        <Recomendaciones />
      </Section>
    </div>
  )
}
