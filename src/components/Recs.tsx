import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CircleCheck, Info, TriangleAlert, CircleAlert } from 'lucide-react'
import { recomendar, type Nivel, type Recomendacion } from '../lib/recs'
import { useStore } from '../lib/store'
import { Badge, Segmented } from './ui'

const ICONO: Record<Nivel, { icon: typeof Info; cls: string; tone: 'bad' | 'warn' | 'info' | 'good' }> = {
  alta: { icon: CircleAlert, cls: 'bg-bad-soft text-bad', tone: 'bad' },
  media: { icon: TriangleAlert, cls: 'bg-warn-soft text-warn', tone: 'warn' },
  info: { icon: Info, cls: 'bg-info-soft text-info', tone: 'info' },
  ok: { icon: CircleCheck, cls: 'bg-good-soft text-good', tone: 'good' },
}
const NIVEL_TXT: Record<Nivel, string> = { alta: 'Urgente', media: 'Mejorable', info: 'Oportunidad', ok: 'Bien' }

export function RecItem({ r }: { r: Recomendacion }) {
  const I = ICONO[r.nivel]
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', I.cls)}>
        <I.icon size={18} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={I.tone}>{NIVEL_TXT[r.nivel]}</Badge>
          <Badge>{r.area}</Badge>
        </div>
        <h3 className="text-[14.5px] leading-snug font-semibold">{r.titulo}</h3>
        <p className="text-[13.5px] leading-relaxed text-muted">{r.texto}</p>
      </div>
    </li>
  )
}

export function Recomendaciones({ limite }: { limite?: number }) {
  const { estado } = useStore()
  const recs = useMemo(() => recomendar(estado), [estado])
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'bien'>('pendientes')
  const lista = recs.filter((r) => (filtro === 'todas' ? true : filtro === 'bien' ? r.nivel === 'ok' : r.nivel !== 'ok'))
  const visibles = limite ? lista.slice(0, limite) : lista
  return (
    <div className="flex flex-col gap-3">
      {!limite && (
        <Segmented
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'pendientes', label: `Por hacer (${recs.filter((r) => r.nivel !== 'ok').length})` },
            { value: 'bien', label: `Bien (${recs.filter((r) => r.nivel === 'ok').length})` },
            { value: 'todas', label: 'Todas' },
          ]}
        />
      )}
      <ul className="flex flex-col gap-2.5">
        {visibles.map((r) => (
          <RecItem key={r.id} r={r} />
        ))}
        {!visibles.length && <li className="rounded-2xl border border-dashed border-line p-6 text-center text-[14px] text-muted">Nada pendiente aquí.</li>}
      </ul>
    </div>
  )
}
