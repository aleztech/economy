import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ChevronDown, FileUp, Repeat, Scissors, ShoppingBag, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { analizar, fusionar, mediasPorGasto, parsePaypal, parseRevolut, type GrupoAnalisis, type Movimiento } from '../lib/movimientos'
import { mensual } from '../lib/calc'
import { eur, eurCorto, etiquetaMes } from '../lib/format'
import { Badge, Button, Card, Legend, Section, Segmented, Stat, TooltipBox } from '../components/ui'

type Periodo = '3' | '6' | '12' | 'todo'

const ejeX = { tick: { fontSize: 11, fill: 'var(--muted)' }, tickLine: false, axisLine: false } as const

async function leerArchivo(f: File): Promise<Movimiento[]> {
  const esTexto = /\.(txt|csv)$/i.test(f.name)
  if (esTexto) {
    const texto = await f.text()
    const cab = texto.slice(0, 400)
    if (/"?(Bruto|Gross)"?/.test(cab) && /"?(Nombre|Name)"?/.test(cab)) return parsePaypal(texto)
  }
  const XLSX = await import('xlsx')
  const wb = esTexto ? XLSX.read(await f.text(), { type: 'string', cellDates: true }) : XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true })
  const hoja = wb.Sheets[wb.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: '' })
  return parseRevolut(filas)
}

export default function Recortes() {
  const { estado, set } = useStore()
  const movs = estado.movimientos ?? []
  const [periodo, setPeriodo] = useState<Periodo>('12')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [cargando, setCargando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const hasta = movs.length ? movs[movs.length - 1].fecha : undefined
  const desde = useMemo(() => {
    if (!hasta || periodo === 'todo') return undefined
    const d = new Date(hasta)
    d.setMonth(d.getMonth() - Number(periodo))
    return d.toISOString().slice(0, 10)
  }, [hasta, periodo])
  const a = useMemo(() => analizar(movs, desde), [movs, desde])
  const comparacion = useMemo(() => (a ? mediasPorGasto(a, estado.gastos) : []), [a, estado.gastos])

  const importar = async (files: FileList | null) => {
    if (!files?.length) return
    setCargando(true)
    setMsg(null)
    try {
      let nuevos: Movimiento[] = []
      const nombres: string[] = []
      for (const f of Array.from(files)) {
        const l = await leerArchivo(f)
        nuevos = nuevos.concat(l)
        nombres.push(`${f.name}: ${l.length} movimientos`)
      }
      set((e) => ({ ...e, movimientos: fusionar(e.movimientos ?? [], nuevos) }))
      setMsg({ ok: true, t: `Importado. ${nombres.join(' · ')}` })
    } catch (err) {
      setMsg({ ok: false, t: err instanceof Error ? err.message : 'No se pudo leer el archivo.' })
    } finally {
      setCargando(false)
      if (input.current) input.current.value = ''
    }
  }

  const aplicarMedias = () =>
    set((e) => ({
      ...e,
      gastos: e.gastos.map((g) => {
        const c = comparacion.find((x) => x.gasto.id === g.id)
        if (!c) return g
        const f = g.frecuencia === 'mensual' ? 1 : g.frecuencia === 'trimestral' ? 3 : 12
        return { ...g, importe: Math.round(c.real * f) }
      }),
    }))

  const cortar = a ? a.grupos.filter((g) => g.disc && g.liberas >= 5).sort((x, y) => y.liberas - x.liberas) : []
  const fijos = a ? a.grupos.filter((g) => !g.disc) : []
  const grandes = a ? a.grupos.flatMap((g) => g.grandes.map((m) => ({ ...m, grupo: g.grupo }))).sort((x, y) => x.importe - y.importe) : []

  return (
    <div className="rise flex flex-col gap-8">
      <Section
        title="Importar extractos"
        hint={
          <>
            Revolut (Excel o CSV) y PayPal (informe de actividad en CSV/TXT). Se leen en este navegador y se guardan cifrados aquí; no se suben a ningún sitio. Si importas PayPal, sus compras sustituyen a los cargos genéricos “PayPal” de Revolut.
          </>
        }
      >
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={input} type="file" multiple accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => importar(e.target.files)} />
            <Button onClick={() => input.current?.click()} disabled={cargando}>
              <FileUp size={16} /> {cargando ? 'Leyendo…' : 'Elegir archivos'}
            </Button>
            {movs.length > 0 && (
              <Button variant="ghost" onClick={() => set((e) => ({ ...e, movimientos: [] }))}>
                <Trash2 size={16} /> Borrar movimientos
              </Button>
            )}
            {movs.length > 0 && (
              <span className="text-[12.5px] text-muted">
                {movs.length} movimientos · {movs[0].fecha} → {hasta}
              </span>
            )}
          </div>
          {msg && <p className={clsx('text-[13px]', msg.ok ? 'text-good' : 'text-bad')}>{msg.t}</p>}
        </Card>
      </Section>

      {!a ? (
        <Card className="p-6 text-[14px] text-muted">Importa un extracto para ver en qué se va tu dinero y qué recortar.</Card>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <Segmented value={periodo} onChange={setPeriodo} options={[{ value: '3', label: '3 meses' }, { value: '6', label: '6 meses' }, { value: '12', label: '12 meses' }, { value: 'todo', label: 'Todo' }]} />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Gasto al mes" value={eur(a.gastoMes)} sub={`${a.desde} → ${a.hasta} (${a.meses.toFixed(1)} meses)`} />
              <Stat label="Recortable al mes" value={eur(a.discMes)} sub={`${Math.round((a.discMes / Math.max(1, a.gastoMes)) * 100)} % de lo que gastas`} tone="warn" />
              <Stat label="Si recortas lo sugerido" value={eur(a.liberasMes)} sub={`${eur(a.liberasMes * 12)} al año`} tone="good" />
              <Stat label="Suscripciones activas" value={eur(a.suscripciones.filter((x) => x.activa).reduce((s, x) => s + x.mes, 0))} sub={`${a.suscripciones.filter((x) => x.activa).length} cargos periódicos activos`} />
            </div>
            {a.paypalSinDetalle > 20 && (
              <p className="flex items-center gap-2 text-[13px] text-warn">
                <AlertTriangle size={15} /> {eur(a.paypalSinDetalle)}/mes en PayPal sin detalle: importa el informe de actividad de PayPal de esas fechas.
              </p>
            )}
          </div>

          <Section title="Qué cortar" hint="Gastos que dependen de ti, ordenados por lo que liberas con un recorte razonable. Toca uno para ver comercios y compras.">
            <Card className="divide-y divide-line overflow-hidden">
              {cortar.map((g) => (
                <FilaCorte key={g.grupo} g={g} />
              ))}
            </Card>
          </Section>

          {a.suscripciones.length > 0 && (
            <Section title="Suscripciones y cuotas" hint="Cargos periódicos con importes parecidos. Activas: han cobrado en el último mes y medio. Pregúntate si las usaste el mes pasado.">
              <Card className="divide-y divide-line overflow-hidden">
                {a.suscripciones.map((x) => (
                  <div key={x.nombre} className={clsx('flex items-center gap-3 px-4 py-2.5', !x.activa && 'opacity-55')}>
                    <Repeat size={15} className={clsx('shrink-0', x.activa ? 'text-warn' : 'text-muted')} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium">{x.nombre}</span>
                      <span className="text-[12px] text-muted">
                        {x.grupo} · {x.meses} meses · {x.activa ? `último cargo ${x.ultimo}` : `terminada (último ${x.ultimo})`}
                      </span>
                    </div>
                    <span className="num text-[14px]">{eur(x.mes, true)}/mes</span>
                  </div>
                ))}
              </Card>
            </Section>
          )}

          <Section title="Mes a mes" hint="Gasto recortable frente al resto. Lo que quieres ver es la barra naranja bajando.">
            <Card className="flex flex-col gap-3 p-2 pt-4 md:p-4">
              <div className="px-2">
                <Legend items={[{ label: 'Recortable', color: 'var(--warn)' }, { label: 'Resto', color: 'var(--muted)' }]} />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.meses_} margin={{ left: 0, right: 8, top: 4, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid vertical={false} stroke="var(--c-grid)" />
                    <XAxis dataKey="ym" tickFormatter={etiquetaMes} {...ejeX} />
                    <YAxis tickFormatter={eurCorto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={52} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={etiquetaMes(String(payload[0].payload.ym))} rows={[{ label: 'Recortable', value: Number(payload[0].payload.disc), color: 'var(--warn)' }, { label: 'Resto', value: Number(payload[0].payload.resto) }]} /> : null)} />
                    <Bar dataKey="disc" stackId="m" fill="var(--warn)" maxBarSize={30} />
                    <Bar dataKey="resto" stackId="m" fill="var(--muted)" fillOpacity={0.5} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Section>

          {comparacion.length > 0 && (
            <Section
              title="Tus gastos frente a lo real"
              hint="Lo que tienes puesto en Gastos comparado con la media de los extractos. Si no coinciden, las previsiones fallan."
              action={
                <Button variant="outline" className="h-9 px-3" onClick={aplicarMedias}>
                  Actualizar importes
                </Button>
              }
            >
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-right text-muted">
                      <th className="px-4 py-2.5 text-left font-medium">Gasto</th>
                      <th className="px-3 py-2.5 font-medium">En la web</th>
                      <th className="px-3 py-2.5 font-medium">Real</th>
                      <th className="px-3 py-2.5 font-medium">Objetivo</th>
                      <th className="px-4 py-2.5 font-medium">Te pasas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {comparacion.map((c) => {
                      const web = mensual(c.gasto)
                      const obj = c.gasto.objetivo ?? web
                      return (
                        <tr key={c.gasto.id} className="num text-right">
                          <td className="px-4 py-2.5 text-left font-sans">
                            <div className="font-medium">{c.gasto.nombre}</div>
                            <div className="text-[11.5px] text-muted">{c.grupos.join(', ')}</div>
                          </td>
                          <td className={clsx('px-3 py-2.5', Math.abs(web - c.real) > Math.max(20, c.real * 0.15) && 'text-warn')}>{eur(web)}</td>
                          <td className="px-3 py-2.5">{eur(c.real)}</td>
                          <td className="px-3 py-2.5">{c.gasto.objetivo != null ? eur(c.gasto.objetivo) : '—'}</td>
                          <td className={clsx('px-4 py-2.5', c.real > obj + 5 ? 'text-bad' : 'text-good')}>{c.real > obj + 5 ? `+${eur(c.real - obj)}` : 'En objetivo'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
              <p className="text-[12px] text-muted">“Actualizar importes” pone la media real en cada gasto y mantiene tus objetivos.</p>
            </Section>
          )}

          {grandes.length > 0 && (
            <Section title="Compras grandes" hint="Cargos de 300 € o más. Pregúntate cuáles volverías a hacer.">
              <Card className="divide-y divide-line overflow-hidden">
                {grandes.slice(0, 20).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <ShoppingBag size={15} className="shrink-0 text-muted" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium">{m.desc}</span>
                      <span className="truncate text-[12px] text-muted">
                        {m.fecha} · {m.grupo}
                        {m.detalle ? ` · ${m.detalle}` : ''}
                      </span>
                    </div>
                    <span className="num text-[14px]">{eur(-m.importe)}</span>
                  </div>
                ))}
              </Card>
            </Section>
          )}

          <Section title="Lo que no se recorta" hint="Vivienda, familia, suministros y movimientos a terceros, como referencia.">
            <Card className="divide-y divide-line overflow-hidden">
              {fijos.map((g) => (
                <div key={g.grupo} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]">
                  <span>{g.grupo}</span>
                  <span className="num">{eur(g.mes)}/mes</span>
                </div>
              ))}
            </Card>
          </Section>
        </>
      )}
    </div>
  )
}

function FilaCorte({ g }: { g: GrupoAnalisis }) {
  const [abierto, setAbierto] = useState(false)
  const objetivo = g.mes - g.liberas
  return (
    <div className={clsx(abierto && 'bg-surface-2/50')}>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Scissors size={16} className="shrink-0 text-warn" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[14.5px] font-medium">{g.grupo}</span>
          <span className="flex flex-wrap gap-1.5">
            <Badge>{g.n} compras</Badge>
            {g.n > 0 && <Badge>ticket típico {eur(g.ticketMedio)}</Badge>}
            {g.pequenas >= 10 && <Badge tone="warn">{g.pequenas} compras de menos de 30 €</Badge>}
            {g.grandes.length > 0 && <Badge tone="info">{g.grandes.length} de 300 € o más</Badge>}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="num text-[15px] font-medium">{eur(g.mes)}/mes</span>
          <span className="num text-[12px] text-good">−{eur(g.liberas)}/mes</span>
        </div>
        <ChevronDown size={16} className={clsx('shrink-0 text-muted transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-[13px] text-muted">
            Bajarlo a <strong className="text-fg">{eur(objetivo)}/mes</strong> libera <strong className="text-good">{eur(g.liberas * 12)} al año</strong>.{g.aviso ? ` ${g.aviso}` : ''}
          </p>
          <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
            {g.comercios.slice(0, 8).map((c) => (
              <div key={c.nombre} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                <span className="min-w-0 truncate">{c.nombre}</span>
                <span className="num shrink-0 text-muted">
                  {c.n}× · <span className="text-fg">{eur(c.total)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
