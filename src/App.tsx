import { useState } from 'react'
import clsx from 'clsx'
import { CalendarRange, Landmark, LayoutDashboard, Lock, Receipt, Settings, TrendingUp, Eye, EyeOff, LoaderCircle, RefreshCw } from 'lucide-react'
import { StoreProvider, desbloquear, useStore, type Sesion } from './lib/store'
import Resumen from './views/Resumen'
import Gastos from './views/Gastos'
import Prevision from './views/Prevision'
import Futuro from './views/Futuro'
import Patrimonio from './views/Patrimonio'
import Ajustes from './views/Ajustes'

export type Vista = 'resumen' | 'gastos' | 'prevision' | 'futuro' | 'patrimonio' | 'ajustes'

const NAV: { id: Vista; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'gastos', label: 'Gastos', icon: Receipt },
  { id: 'prevision', label: 'Previsión', icon: CalendarRange },
  { id: 'futuro', label: 'Futuro', icon: TrendingUp },
  { id: 'patrimonio', label: 'Patrimonio', icon: Landmark },
]

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null)
  if (!sesion) return <Acceso onOk={setSesion} />
  return (
    <StoreProvider inicial={sesion.estado} nuevo={sesion.nuevo} llave={sesion.llave} onSalir={() => setSesion(null)}>
      <Shell />
    </StoreProvider>
  )
}

function Acceso({ onOk }: { onOk: (s: Sesion) => void }) {
  const [pass, setPass] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const entrar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!pass) return
    setCargando(true)
    setError('')
    try {
      const r = await desbloquear(pass)
      onOk(r)
    } catch {
      setError('Contraseña incorrecta. Revisa mayúsculas y símbolos.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <form onSubmit={entrar} className="rise flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-fg">
            <Lock size={20} />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight">Economy</h1>
          <p className="text-[14px] leading-relaxed text-muted">
            Tus cuentas personales: ingresos, gastos, previsión y patrimonio. Los datos están cifrados y solo se abren con tu contraseña.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="pass" className="text-[12px] font-medium text-muted">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="pass"
              type={ver ? 'text' : 'password'}
              autoComplete="current-password"
              autoFocus
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-surface px-4 pr-12 text-[16px] outline-none focus:border-accent"
            />
            <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-muted">
              {ver ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="text-[13px] text-bad">{error}</p>}
        </div>
        <button type="submit" disabled={cargando || !pass} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-medium text-accent-fg disabled:opacity-60">
          {cargando && <LoaderCircle size={18} className="animate-spin" />}
          {cargando ? 'Descifrando…' : 'Entrar'}
        </button>
        <p className="text-[12px] text-muted">Cifrado AES-256 con clave derivada de tu contraseña (PBKDF2, 310.000 iteraciones). La contraseña no se guarda en ningún sitio.</p>
      </form>
    </main>
  )
}

function Shell() {
  const [vista, setVista] = useState<Vista>('resumen')
  const { guardado, pendiente, resolverPendiente } = useStore()
  const ir = (v: Vista) => {
    setVista(v)
    window.scrollTo({ top: 0 })
  }
  const titulo = vista === 'ajustes' ? 'Ajustes' : NAV.find((n) => n.id === vista)!.label

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      {/* Barra lateral en escritorio */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line px-3 py-6 md:flex">
        <div className="mb-6 flex items-center gap-2 px-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
            <TrendingUp size={16} />
          </div>
          <span className="text-[16px] font-semibold tracking-tight">Economy</span>
        </div>
        {[...NAV, { id: 'ajustes' as Vista, label: 'Ajustes', icon: Settings }].map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => ir(n.id)}
            className={clsx('flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors', vista === n.id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg')}
          >
            <n.icon size={18} />
            {n.label}
          </button>
        ))}
        <div className="mt-auto px-3 text-[12px] text-muted">{guardado === 'guardando' ? 'Guardando…' : guardado === 'guardado' ? 'Cambios guardados y cifrados' : 'Este navegador no permite guardar'}</div>
      </aside>

      <div className="min-w-0">
        <header className="sticky z-20 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur md:px-8" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
          <h1 className="text-[20px] font-semibold tracking-tight">{titulo}</h1>
          <div className="flex items-center gap-2">
            <span className={clsx('h-2 w-2 rounded-full', guardado === 'guardando' ? 'bg-warn' : guardado === 'guardado' ? 'bg-good' : 'bg-bad')} title={guardado} />
            <button type="button" onClick={() => ir('ajustes')} aria-label="Ajustes" className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-2 md:hidden">
              <Settings size={19} />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1100px] px-4 pt-5 pb-28 md:px-8 md:pb-12">
          {pendiente && (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-info/30 bg-info-soft p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <RefreshCw size={18} className="mt-0.5 shrink-0 text-info" />
                <p className="text-[13.5px] leading-relaxed">
                  <strong>Hay datos actualizados publicados.</strong> Cargarlos sustituye los cambios que hayas hecho en este navegador.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => resolverPendiente(false)} className="h-9 rounded-xl px-3 text-[13.5px] font-medium text-muted hover:bg-surface">
                  Mantener los míos
                </button>
                <button type="button" onClick={() => resolverPendiente(true)} className="h-9 rounded-xl bg-info px-3 text-[13.5px] font-medium text-white">
                  Cargar actualizados
                </button>
              </div>
            </div>
          )}
          {vista === 'resumen' && <Resumen ir={ir} />}
          {vista === 'gastos' && <Gastos />}
          {vista === 'prevision' && <Prevision />}
          {vista === 'futuro' && <Futuro />}
          {vista === 'patrimonio' && <Patrimonio />}
          {vista === 'ajustes' && <Ajustes />}
        </main>
      </div>

      {/* Barra inferior en móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => ir(n.id)} className={clsx('flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-medium', vista === n.id ? 'text-accent' : 'text-muted')}>
              <n.icon size={21} strokeWidth={vista === n.id ? 2.25 : 1.75} />
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
