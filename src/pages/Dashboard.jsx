import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent, Icon } from '../components/Layout'
import { Badge, Avatar, EmptyState } from '../components/ui'

// Etapas del flujo de un proyecto, en orden. `desde` = fecha en que entró a la etapa.
const ETAPAS = [
  { id: 'prospecto',      label: 'Prospecto',      desde: p => p.fecha_creacion || p.created_at },
  { id: 'cotizado',       label: 'Cotizado',       desde: p => p.fecha_cotizado },
  { id: 'sena_pagada',    label: 'Seña pagada',    desde: p => p.fecha_sena_pagada },
  { id: 'en_fabricacion', label: 'En fabricación', desde: p => p.fecha_inicio_fabricacion },
  { id: 'entregado',      label: 'Entregado',      desde: p => p.fecha_entrega_real },
]
const ETAPA_IDX = Object.fromEntries(ETAPAS.map((e, i) => [e.id, i]))
const DIAS_ESTANCADO = 7
const DAY = 86400000

const PERIODOS = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes',    label: 'Mes' },
  { id: 'anio',   label: 'Año' },
]

const valor = p => Number(p.valor_final || p.valor_estimado || 0)
const dias = d => d ? Math.floor((Date.now() - new Date(d)) / DAY) : null
const money = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR')
const moneyShort = n => {
  if (n == null) return '—'
  if (n >= 1e6) return '$' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M'
  if (n >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString('es-AR') + ' k'
  return '$' + Math.round(n)
}
function inicioPeriodo(id) {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (id === 'semana') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  if (id === 'mes') d.setDate(1)
  if (id === 'anio') { d.setMonth(0); d.setDate(1) }
  return d
}
const enPeriodo = (fecha, desde) => fecha && new Date(fecha) >= desde

// ─── Dashboard ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [proyectos, setProyectos] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [etapa, setEtapa] = useState(null)         // filtro de la tabla desde el pipeline
  const [orden, setOrden] = useState({ key: 'dias', dir: -1 })

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.from('proyectos').select('id, nombre, estado, tipo_trabajo, fecha_creacion, created_at, fecha_cotizado, fecha_sena_pagada, fecha_inicio_fabricacion, fecha_entrega_estimada, fecha_entrega_real, valor_final, valor_estimado, clientes(nombre)'),
      supabase.from('prospectos').select('id, nombre, apellido, canal_origen, estado, created_at, proximo_seguimiento, presupuesto_estimado').eq('activo', true).order('created_at', { ascending: false }).limit(200),
    ]).then(([pr, ps]) => {
      if (!vivo) return
      setProyectos(pr.data || [])
      setProspectos(ps.data || [])
      setLoading(false)
    })
    return () => { vivo = false }
  }, [])

  const m = useMemo(() => {
    const desde = inicioPeriodo(periodo)
    const activos = proyectos.filter(p => p.estado !== 'cancelado')
    const conDias = activos.map(p => {
      const e = ETAPAS[ETAPA_IDX[p.estado]]
      const enEtapa = e ? dias(e.desde(p)) : null
      const vence = p.fecha_entrega_estimada && p.estado !== 'entregado' ? -dias(p.fecha_entrega_estimada) : null
      return { ...p, _dias: enEtapa, _vence: vence, _valor: valor(p) }
    })

    const abiertosPros = prospectos.filter(p => !['ganado', 'perdido', 'dormido'].includes(p.estado))
    const porEtapa = ETAPAS.map(e => {
      if (e.id === 'prospecto') return { ...e, label: 'Prospectos', n: abiertosPros.length, total: abiertosPros.reduce((s, p) => s + Number(p.presupuesto_estimado || 0), 0), link: '/prospectos' }
      const items = conDias.filter(p => p.estado === e.id)
      return { ...e, n: items.length, total: items.reduce((s, p) => s + p._valor, 0) }
    })
    const abiertos = conDias.filter(p => p.estado !== 'entregado')
    const pipeline = abiertos.reduce((s, p) => s + p._valor, 0)

    const cotizadosPeriodo = conDias.filter(p => enPeriodo(p.fecha_cotizado, desde))
    const entregadosPeriodo = conDias.filter(p => p.estado === 'entregado' && enPeriodo(p.fecha_entrega_real, desde))

    const cotizadosAlguna = conDias.filter(p => p.fecha_cotizado)
    const avanzaron = cotizadosAlguna.filter(p => ETAPA_IDX[p.estado] >= ETAPA_IDX.sena_pagada)
    const tasa = cotizadosAlguna.length ? avanzaron.length / cotizadosAlguna.length : null
    const ciclos = conDias.filter(p => p.fecha_cotizado && p.fecha_sena_pagada)
      .map(p => (new Date(p.fecha_sena_pagada) - new Date(p.fecha_cotizado)) / DAY)
    const ciclo = ciclos.length ? ciclos.reduce((a, b) => a + b, 0) / ciclos.length : null

    // Cotizado por mes, últimos 6 meses
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - (5 - i))
      const fin = new Date(d); fin.setMonth(fin.getMonth() + 1)
      const items = conDias.filter(p => p.fecha_cotizado && new Date(p.fecha_cotizado) >= d && new Date(p.fecha_cotizado) < fin)
      return { key: d.toISOString(), label: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''), total: items.reduce((s, p) => s + p._valor, 0), n: items.length }
    })

    // Qué requiere atención hoy
    const atencion = [
      ...conDias.filter(p => p.estado === 'cotizado' && p._dias >= DIAS_ESTANCADO).map(p => ({
        id: 'e' + p.id, tone: 'warning', icon: 'hourglass_top', titulo: p.clientes?.nombre || p.nombre || 'Proyecto',
        texto: `${p._dias} días en Cotizado sin seña`, accion: 'Ver proyecto', go: '/proyectos', peso: p._dias,
      })),
      ...conDias.filter(p => p._vence != null && p._vence < 0).map(p => ({
        id: 'v' + p.id, tone: 'danger', icon: 'event_busy', titulo: p.nombre || 'Proyecto',
        texto: `Entrega vencida hace ${-p._vence} días`, accion: 'Ver en taller', go: '/produccion', peso: 1000 - p._vence,
      })),
      ...prospectos.filter(p => p.proximo_seguimiento && new Date(p.proximo_seguimiento) < new Date()).map(p => ({
        id: 's' + p.id, tone: 'info', icon: 'call', titulo: `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Prospecto',
        texto: `Seguimiento pendiente desde ${new Date(p.proximo_seguimiento).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`,
        accion: 'Contactar', go: `/prospectos/${p.id}`, peso: dias(p.proximo_seguimiento),
      })),
    ].sort((a, b) => b.peso - a.peso)

    return {
      conDias, porEtapa, pipeline, abiertos, cotizadosPeriodo, entregadosPeriodo, tasa, ciclo, meses, atencion,
      cotizadoPeriodo: cotizadosPeriodo.reduce((s, p) => s + p._valor, 0),
      entregadoPeriodo: entregadosPeriodo.reduce((s, p) => s + p._valor, 0),
      nuevosProspectos: prospectos.filter(p => enPeriodo(p.created_at, desde)).length,
    }
  }, [proyectos, prospectos, periodo])

  const filas = useMemo(() => {
    const base = etapa ? m.conDias.filter(p => p.estado === etapa) : m.abiertos
    const get = {
      nombre: p => (p.nombre || '').toLowerCase(), cliente: p => (p.clientes?.nombre || '').toLowerCase(),
      etapa: p => ETAPA_IDX[p.estado] ?? -1, valor: p => p._valor, dias: p => p._dias ?? -1,
      entrega: p => p.fecha_entrega_estimada || '9999',
    }[orden.key]
    return [...base].sort((a, b) => (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0) * orden.dir)
  }, [m, etapa, orden])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = profile?.nombre?.split(' ')[0] || ''
  const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const periodoTxt = { semana: 'esta semana', mes: 'este mes', anio: 'este año' }[periodo]

  return (
    <Layout>
      <Topbar
        title={`${saludo}${nombre ? `, ${nombre}` : ''}`}
        subtitle={`${fechaHoy} · ${loading ? 'Cargando operación…' : `${m.abiertos.length} proyectos abiertos por ${money(m.pipeline)}`}`}
        actions={<>
          <Segmented value={periodo} onChange={setPeriodo} options={PERIODOS} label="Período" />
          <button className="btn btn-secondary" onClick={() => navigate('/prospectos')}><Icon name="person_add" size={18} />Nuevo prospecto</button>
        </>}
      />
      <PageContent>
        <div className="grid grid-cols-1 gap-5">
          {/* ── Pipeline ── */}
          <Pipeline etapas={m.porEtapa} activa={etapa} onSelect={e => e.link ? navigate(e.link) : setEtapa(x => x === e.id ? null : e.id)} loading={loading} />

          {/* ── Indicadores ── */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi loading={loading} icon="request_quote" label={`Cotizado ${periodoTxt}`} value={moneyShort(m.cotizadoPeriodo)}
              foot={`${m.cotizadosPeriodo.length} ${m.cotizadosPeriodo.length === 1 ? 'cotización' : 'cotizaciones'}`} />
            <Kpi loading={loading} icon="local_shipping" label={`Entregado ${periodoTxt}`} value={moneyShort(m.entregadoPeriodo)}
              foot={`${m.entregadosPeriodo.length} proyecto${m.entregadosPeriodo.length === 1 ? '' : 's'} terminado${m.entregadosPeriodo.length === 1 ? '' : 's'}`} />
            <Kpi loading={loading} icon="handshake" label="Cotizaciones que pasan a seña" value={m.tasa == null ? '—' : `${Math.round(m.tasa * 100)} %`}
              foot={<Meter value={m.tasa || 0} />} />
            <Kpi loading={loading} icon="timer" label="De cotizado a seña" value={m.ciclo == null ? '—' : `${Math.round(m.ciclo)} días`}
              foot={`${m.nuevosProspectos} prospecto${m.nuevosProspectos === 1 ? '' : 's'} nuevo${m.nuevosProspectos === 1 ? '' : 's'} ${periodoTxt}`} />
          </div>

          {/* ── Proyectos + Atención ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <section className="surface lg:col-span-8 overflow-hidden flex flex-col">
              <PanelHead title={etapa ? `Proyectos en ${ETAPAS[ETAPA_IDX[etapa]].label.toLowerCase()}` : 'Proyectos abiertos'}
                meta={`${filas.length} de ${m.conDias.length}`}
                action={<>
                  {etapa && <button className="btn btn-quiet btn-sm" onClick={() => setEtapa(null)}><Icon name="filter_alt_off" size={16} />Quitar filtro</button>}
                  <button className="btn btn-quiet btn-sm" onClick={() => navigate('/proyectos')}>Ver tablero</button>
                </>} />
              <ProyectosTabla filas={filas} orden={orden} setOrden={setOrden} loading={loading} onOpen={() => navigate('/proyectos')} />
            </section>

            <section className="surface lg:col-span-4 flex flex-col">
              <PanelHead title="Necesita atención" meta={loading ? '' : m.atencion.length ? `${m.atencion.length} pendiente${m.atencion.length === 1 ? '' : 's'}` : ''} />
              <Atencion items={m.atencion} loading={loading} navigate={navigate} />
            </section>
          </div>

          {/* ── Tendencia + Prospectos ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <section className="surface lg:col-span-7">
              <PanelHead title="Monto cotizado por mes" meta="Últimos 6 meses" />
              <div className="px-5 pb-5"><BarChart data={m.meses} loading={loading} /></div>
            </section>
            <section className="surface lg:col-span-5 flex flex-col">
              <PanelHead title="Prospectos recientes" action={<button className="btn btn-quiet btn-sm" onClick={() => navigate('/prospectos')}>Ver todos</button>} />
              <Prospectos items={prospectos.slice(0, 6)} loading={loading} navigate={navigate} />
            </section>
          </div>
        </div>
      </PageContent>
    </Layout>
  )
}

// ─── Piezas ──────────────────────────────────────────────────────────────────
function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-[3px] rounded-lg bg-z-inset border border-z-line">
      {options.map(o => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`h-[28px] px-3 rounded-md text-[13px] font-semibold transition-colors ${value === o.id ? 'bg-z-surface text-z-ink shadow-z-sm' : 'text-z-ink-3 hover:text-z-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function PanelHead({ title, meta, action }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-4 pb-3">
      <h3 className="text-[15px] font-semibold text-z-ink">{title}</h3>
      {meta && <span className="text-[12.5px] text-z-ink-3">{meta}</span>}
      <div className="ml-auto flex gap-1">{action}</div>
    </div>
  )
}

function Kpi({ icon, label, value, foot, loading }) {
  return (
    <div className="surface px-5 py-4 min-w-0">
      <div className="flex items-center gap-2 text-z-ink-3 text-[13px] font-medium mb-3">
        <span className="w-7 h-7 rounded-md bg-z-primary/10 text-z-primary inline-flex items-center justify-center shrink-0"><Icon name={icon} size={17} /></span>
        <span className="truncate">{label}</span>
      </div>
      {loading ? <div className="z-skeleton h-[30px] w-2/3" /> :
        <div className="text-[28px] leading-[30px] font-[650] text-z-ink tracking-[-0.02em]" style={{ fontStretch: '92%' }}>{value}</div>}
      <div className="mt-2 text-[12.5px] text-z-ink-3 min-h-[18px]">{loading ? '' : foot}</div>
    </div>
  )
}

function Meter({ value }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex-1 h-[6px] rounded-full bg-z-inset overflow-hidden">
        <div className="h-full rounded-full bg-z-primary transition-[width] duration-500" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  )
}

// La pieza característica: el recorrido de un mueble, de prospecto a entrega.
// Cada etapa es un tramo clickeable que filtra la tabla; el tono se oscurece a medida que avanza.
function Pipeline({ etapas, activa, onSelect, loading }) {
  const max = Math.max(1, ...etapas.map(e => e.n))
  return (
    <section className="surface p-2">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-[2px]" role="group" aria-label="Pipeline de proyectos">
        {etapas.map((e, i) => {
          const on = activa === e.id
          const dim = activa && !on
          const a = 0.18 + (i / (etapas.length - 1)) * 0.82
          return (
            <button key={e.id} onClick={() => onSelect(e)} aria-pressed={e.link ? undefined : on} title={e.link ? 'Abrir prospectos' : `Filtrar por ${e.label.toLowerCase()}`}
              className={`relative text-left rounded-lg px-4 pt-3 pb-4 transition-all ${on ? 'bg-z-primary/[0.07] ring-1 ring-z-primary/40' : 'hover:bg-z-subtle'} ${dim ? 'opacity-55' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold text-z-ink-2">{e.label}</span>
                {i < etapas.length - 1 && <Icon name="arrow_forward" size={14} color="var(--z-text-muted)" />}
                {e.link && <Icon name="open_in_new" size={14} color="var(--z-text-muted)" />}
              </div>
              {loading ? <div className="z-skeleton h-[26px] w-1/2" /> : <>
                <div className="flex items-baseline gap-2">
                  <span className="text-[26px] leading-none font-[650] text-z-ink tracking-[-0.02em]" style={{ fontStretch: '92%' }}>{e.n}</span>
                  <span className="text-[13px] text-z-ink-3">{moneyShort(e.total)}</span>
                </div>
                <div className="mt-3 h-[6px] rounded-full bg-z-inset overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${(e.n / max) * 100}%`, background: `rgb(var(--z-primary-c) / ${a})` }} />
                </div>
              </>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

const COLS = [
  { key: 'nombre',  label: 'Proyecto' },
  { key: 'etapa',   label: 'Etapa' },
  { key: 'valor',   label: 'Valor', right: true },
  { key: 'dias',    label: 'En la etapa', right: true },
  { key: 'entrega', label: 'Entrega' },
]

function ProyectosTabla({ filas, orden, setOrden, loading, onOpen }) {
  if (loading) return <div className="px-5 pb-5 grid gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="z-skeleton h-[38px]" />)}</div>
  if (!filas.length) return <EmptyState icon="view_kanban" title="No hay proyectos en esta etapa">Elegí otra etapa del pipeline o quitá el filtro.</EmptyState>
  const sort = key => setOrden(o => ({ key, dir: o.key === key ? -o.dir : (key === 'nombre' || key === 'entrega' ? 1 : -1) }))
  return (
    <div className="overflow-auto max-h-[420px] border-t border-z-line">
      <table>
        <thead className="sticky top-0 z-10">
          <tr>
            {COLS.map(c => (
              <th key={c.key} aria-sort={orden.key === c.key ? (orden.dir > 0 ? 'ascending' : 'descending') : 'none'}
                style={{ textAlign: c.right ? 'right' : 'left', padding: 0 }}>
                <button onClick={() => sort(c.key)}
                  className={`w-full h-[38px] px-[14px] inline-flex items-center gap-1 font-semibold hover:text-z-ink ${c.right ? 'justify-end' : ''} ${orden.key === c.key ? 'text-z-ink' : ''}`}>
                  {c.label}
                  <Icon name={orden.key === c.key ? (orden.dir > 0 ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'} size={14}
                    color={orden.key === c.key ? 'currentColor' : 'var(--z-text-muted)'} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(p => {
            const lento = p.estado === 'cotizado' && p._dias >= DIAS_ESTANCADO
            const vencida = p._vence != null && p._vence < 0
            return (
              <tr key={p.id} onClick={onOpen} className="cursor-pointer">
                <td style={{ maxWidth: 320 }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.clientes?.nombre || p.nombre} size={30} />
                    <div className="min-w-0">
                      <div className="font-semibold text-z-ink truncate">{p.nombre || 'Sin nombre'}</div>
                      <div className="text-[12.5px] text-z-ink-3 truncate">{p.clientes?.nombre || 'Sin cliente'}{p.tipo_trabajo ? ` · ${p.tipo_trabajo}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td><Badge value={p.estado} /></td>
                <td className="text-right font-semibold text-z-ink whitespace-nowrap">{p._valor ? money(p._valor) : '—'}</td>
                <td className="text-right whitespace-nowrap">
                  {p._dias == null ? <span className="text-z-ink-4">—</span> :
                    <span className={lento ? 'text-z-warning font-semibold inline-flex items-center gap-1' : 'text-z-ink-2'}>
                      {lento && <Icon name="hourglass_top" size={14} />}{p._dias} d
                    </span>}
                </td>
                <td className="whitespace-nowrap">
                  {p.fecha_entrega_estimada
                    ? <span className={vencida ? 'text-z-danger font-semibold inline-flex items-center gap-1' : 'text-z-ink-2'}>
                        {vencida && <Icon name="event_busy" size={14} />}
                        {new Date(p.fecha_entrega_estimada + 'T00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </span>
                    : <span className="text-z-ink-4">Sin fecha</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const TONE_CLS = {
  warning: 'bg-z-warning/[0.12] text-z-warning', danger: 'bg-z-danger/10 text-z-danger', info: 'bg-z-info/10 text-z-info',
}
function Atencion({ items, loading, navigate }) {
  const [visto, setVisto] = useState([])
  if (loading) return <div className="px-5 pb-5 grid gap-3">{[0, 1, 2].map(i => <div key={i} className="z-skeleton h-[52px]" />)}</div>
  const lista = items.filter(i => !visto.includes(i.id))
  if (!lista.length) return <EmptyState icon="task_alt" title="Todo al día">No hay cotizaciones frenadas, entregas vencidas ni seguimientos atrasados.</EmptyState>
  return (
    <ul className="px-2 pb-2 overflow-auto max-h-[420px]">
      {lista.slice(0, 8).map(it => (
        <li key={it.id} className="group relative flex items-center gap-3 rounded-lg px-3 py-[9px] hover:bg-z-subtle cursor-pointer"
          onClick={() => navigate(it.go)}>
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONE_CLS[it.tone]}`}><Icon name={it.icon} size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-z-ink truncate">{it.titulo}</div>
            <div className="text-[12.5px] text-z-ink-3 truncate">{it.texto}</div>
          </div>
          <button className="btn btn-quiet btn-sm btn-icon opacity-0 group-hover:opacity-100 focus:opacity-100" title="Ocultar" aria-label={`Ocultar ${it.titulo}`}
            onClick={e => { e.stopPropagation(); setVisto(v => [...v, it.id]) }}><Icon name="close" size={16} /></button>
          <span className="text-[12.5px] font-semibold text-z-primary whitespace-nowrap">{it.accion}</span>
        </li>
      ))}
      {lista.length > 8 && <li className="px-3 py-2 text-[12.5px] text-z-ink-3">y {lista.length - 8} más</li>}
    </ul>
  )
}

function BarChart({ data, loading }) {
  const [hover, setHover] = useState(null)
  if (loading) return <div className="z-skeleton h-[220px]" />
  const W = 640, H = 220, padL = 52, padB = 26, padT = 12
  const max = Math.max(...data.map(d => d.total), 1)
  const step = Math.pow(10, Math.floor(Math.log10(max)))
  const top = Math.ceil(max / step) * step
  const ticks = [0, 0.5, 1].map(t => t * top)
  const bw = (W - padL) / data.length
  const y = v => padT + (H - padT - padB) * (1 - v / top)
  const vacio = data.every(d => !d.total)
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img"
        aria-label={`Monto cotizado por mes: ${data.map(d => `${d.label} ${money(d.total)}`).join(', ')}`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="rgb(var(--z-line-c))" strokeDasharray={t ? '3 4' : undefined} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill="rgb(var(--z-ink-3-c))">{moneyShort(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * bw
          const h = Math.max(d.total ? 3 : 0, H - padB - y(d.total))
          const bx = x + bw * 0.24, bwid = bw * 0.52, by = H - padB - h
          const r = Math.min(4, h)
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={padT} width={bw} height={H - padT - padB} fill={hover === i ? 'rgb(var(--z-ink-c) / 0.04)' : 'transparent'} />
              {h > 0 && <path d={`M${bx},${by + h} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + bwid - r} Q${bx + bwid},${by} ${bx + bwid},${by + r} V${by + h} Z`}
                fill={`rgb(var(--z-primary-c) / ${i === data.length - 1 ? 1 : 0.55})`} />}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="rgb(var(--z-ink-3-c))" style={{ textTransform: 'capitalize' }}>{d.label}</text>
            </g>
          )
        })}
      </svg>
      {hover != null && (
        <div className="absolute pointer-events-none surface px-3 py-2 text-[12.5px] shadow-z-lg whitespace-nowrap"
          style={{ left: `${((padL + (hover + 0.5) * bw) / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}>
          <div className="font-semibold text-z-ink capitalize">{data[hover].label}</div>
          <div className="text-z-ink-2">{money(data[hover].total)} · {data[hover].n} {data[hover].n === 1 ? 'cotización' : 'cotizaciones'}</div>
        </div>
      )}
      {vacio && <div className="absolute inset-0 flex items-center justify-center text-[13px] text-z-ink-3">Sin cotizaciones en los últimos 6 meses</div>}
    </div>
  )
}

const CANAL_ICON = { instagram: 'photo_camera', tiktok: 'music_note', whatsapp: 'chat', facebook: 'thumb_up', web: 'language', referido: 'handshake' }
function Prospectos({ items, loading, navigate }) {
  if (loading) return <div className="px-5 pb-5 grid gap-3">{[0, 1, 2].map(i => <div key={i} className="z-skeleton h-[44px]" />)}</div>
  if (!items.length) return <EmptyState icon="person_search" title="Todavía no hay prospectos" action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/prospectos')}>Cargar prospecto</button>}>Cuando entren consultas por redes o WhatsApp van a aparecer acá.</EmptyState>
  return (
    <ul className="px-2 pb-2">
      {items.map(p => {
        const n = `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre'
        return (
          <li key={p.id}>
            <button onClick={() => navigate(`/prospectos/${p.id}`)} className="w-full flex items-center gap-3 rounded-lg px-3 py-[9px] text-left hover:bg-z-subtle">
              <Avatar name={n} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-z-ink truncate">{n}</div>
                <div className="text-[12.5px] text-z-ink-3 flex items-center gap-1 capitalize">
                  <Icon name={CANAL_ICON[p.canal_origen] || 'person'} size={14} />
                  {p.canal_origen || 'Directo'} · {new Date(p.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <Badge value={p.estado} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
