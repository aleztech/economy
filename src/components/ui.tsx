import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'
import clsx from 'clsx'
import { eur } from '../lib/format'

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-2xl border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  )
}

export function Section({ title, hint, action, children, className }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('flex flex-col gap-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="eyebrow">{label}</span>
      <span className={clsx('num truncate text-[22px] font-semibold leading-tight', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>
        {value}
      </span>
      {sub && <span className="text-[12px] text-muted">{sub}</span>}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'accent'; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-muted',
        tone === 'good' && 'bg-good-soft text-good',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'info' && 'bg-info-soft text-info',
        tone === 'accent' && 'bg-accent-soft text-accent',
      )}
    >
      {children}
    </span>
  )
}

export function Button({ variant = 'primary', className, ...p }: { variant?: 'primary' | 'ghost' | 'outline' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...p}
      className={clsx(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-medium transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-accent-fg hover:opacity-90',
        variant === 'outline' && 'border border-line bg-surface hover:bg-surface-2',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-fg',
        variant === 'danger' && 'text-bad hover:bg-bad-soft',
        className,
      )}
    />
  )
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[12px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'h-10 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[15px] text-fg outline-none transition-colors placeholder:text-muted/60 focus:border-accent'

export function TextInput(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={clsx(inputCls, p.className)} />
}

/** Campo numérico: guarda mientras escribes (no solo al salir del campo).
 *  Con `optional`, un campo vacío devuelve undefined (útil para objetivos). */
export function NumberInput({ value, onChange, suffix = '€', step, className, id, optional }: { value: number | undefined; onChange: (n: number) => void; suffix?: string; step?: number; className?: string; id?: string; optional?: boolean }) {
  const fmt = (v: number | undefined) => (v == null ? '' : String(v).replace('.', ','))
  const [txt, setTxt] = useState(fmt(value))
  const editando = useRef(false)
  // Solo sincroniza desde fuera cuando no estás escribiendo (para no borrar una coma a medias).
  useEffect(() => {
    if (!editando.current) setTxt(fmt(value))
  }, [value])
  const parse = (t: string): number | undefined | null => {
    if (t.trim() === '') return optional ? undefined : 0
    const n = Number(t.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const emitir = (t: string) => {
    const n = parse(t)
    if (n === null) return
    if (n !== value) (onChange as (n: number | undefined) => void)(n)
  }
  return (
    <div className={clsx('relative', className)}>
      <input
        id={id}
        inputMode="decimal"
        step={step}
        value={txt}
        onFocus={() => (editando.current = true)}
        onChange={(e) => {
          setTxt(e.target.value)
          emitir(e.target.value)
        }}
        onBlur={() => {
          editando.current = false
          emitir(txt)
          setTxt(fmt(parse(txt) ?? value))
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className={clsx(inputCls, 'num pr-9 text-right')}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">{suffix}</span>
    </div>
  )
}

export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={clsx(inputCls, 'appearance-none pr-8', p.className)} style={{ backgroundImage: 'none' }} />
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-[13px]">
      <span className={clsx('relative h-6 w-10 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx('h-8 rounded-lg px-3 text-[13px] font-medium transition-colors', value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Barra de progreso con valor y objetivo. */
export function Progress({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'good' | 'warn' | 'bad' }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={clsx('h-full rounded-full transition-all', tone === 'accent' && 'bg-accent', tone === 'good' && 'bg-good', tone === 'warn' && 'bg-warn', tone === 'bad' && 'bg-bad')}
        style={{ width: `${p * 100}%` }}
      />
    </div>
  )
}

export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: number; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="num">{eur(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? (
            <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  )
}
