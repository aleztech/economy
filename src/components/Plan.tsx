import { useMemo } from 'react'
import clsx from 'clsx'
import { CalendarClock, Check, Landmark, PiggyBank, Repeat, Scissors, TriangleAlert, TrendingUp, Wallet } from 'lucide-react'
import { planDeAccion, type TipoAccion } from '../lib/acciones'
import { useStore } from '../lib/store'
import { eur, etiquetaMesLarga } from '../lib/format'
import { Badge, Card, Stat } from './ui'

const ICONO: Record<TipoAccion, typeof Scissors> = {
  recorte: Scissors,
  automatizar: Repeat,
  colchon: Wallet,
  deuda: Landmark,
  inversion: TrendingUp,
  suscripcion: CalendarClock,
  aviso: TriangleAlert,
}

export function PlanAccion() {
  const { estado, set } = useStore()
  const p = useMemo(() => planDeAccion(estado), [estado])
  const hechas = new Set(estado.accionesHechas ?? [])
  const alternar = (id: string) =>
    set((e) => {
      const s = new Set(e.accionesHechas ?? [])
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return { ...e, accionesHechas: [...s] }
    })
  const pendientes = p.acciones.filter((x) => !hechas.has(x.id)).length

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ahorro hoy" value={`${eur(p.ahorroHoy)}/mes`} sub="Con tu gasto real" tone={p.ahorroHoy < 300 ? 'warn' : undefined} />
        <Stat label="Ahorro con el plan" value={`${eur(p.ahorroPlan)}/mes`} sub={`+${eur(p.liberasMes)} al mes`} tone="good" />
        <Stat label={`Patrimonio a los ${p.edadFin}`} value={eur(p.patrimonioPlan)} sub={`Sin el plan: ${eur(p.patrimonioHoy)}`} tone="good" />
        <Stat label="Pasos" value={`${p.acciones.length - pendientes}/${p.acciones.length}`} sub={pendientes ? `${pendientes} por hacer` : 'Todo hecho'} />
      </div>
      <ol className="flex flex-col gap-2.5">
        {p.acciones.map((x, k) => {
          const I = ICONO[x.tipo]
          const hecha = hechas.has(x.id)
          return (
            <li key={x.id}>
              <Card className={clsx('flex gap-3 p-4', hecha && 'opacity-55')}>
                <button
                  type="button"
                  onClick={() => alternar(x.id)}
                  aria-pressed={hecha}
                  aria-label={hecha ? 'Marcar como pendiente' : 'Marcar como hecho'}
                  className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors', hecha ? 'border-good bg-good text-white' : 'border-line text-muted hover:border-accent hover:text-accent')}
                >
                  {hecha ? <Check size={18} /> : <span className="num text-[13px] font-semibold">{k + 1}</span>}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={x.tipo === 'aviso' ? 'warn' : x.tipo === 'recorte' || x.tipo === 'suscripcion' ? 'accent' : 'info'}>
                      <I size={11} /> {x.tipo === 'recorte' ? 'Recorte' : x.tipo === 'automatizar' ? 'Automatizar' : x.tipo === 'colchon' ? 'Colchón' : x.tipo === 'deuda' ? 'Préstamo' : x.tipo === 'inversion' ? 'Inversión' : x.tipo === 'suscripcion' ? 'Suscripciones' : 'Ojo'}
                    </Badge>
                    {x.cuando && <Badge>{etiquetaMesLarga(x.cuando)}</Badge>}
                  </div>
                  <h3 className={clsx('text-[14.5px] leading-snug font-semibold', hecha && 'line-through')}>{x.titulo}</h3>
                  <p className="text-[13.5px] leading-relaxed text-muted">{x.detalle}</p>
                </div>
                {x.mes != null && x.mes > 0 && (
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="num text-[15px] font-semibold text-good">+{eur(x.mes)}</span>
                    <span className="text-[11.5px] text-muted">al mes</span>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ol>
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <PiggyBank size={13} /> Marca cada paso cuando lo hagas. Los importes salen de tus gastos (objetivos incluidos), préstamos, ingresos anuales y extractos importados.
      </p>
    </div>
  )
}
