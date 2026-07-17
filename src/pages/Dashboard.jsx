
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent } from '../components/Layout'

// ─── Módulos del sistema ───────────────────────────────────────────────────────
const MODULES = [
  {
    section: 'Ventas',
    color: '#4A6B36',
    items: [
      { path: '/prospectos', icon: 'filter_alt', label: 'Prospectos', desc: 'Pipeline de oportunidades y seguimiento' },
      { path: '/clientes',   icon: 'group',      label: 'Clientes',   desc: 'Base de clientes y historial de compras' },
      { path: '/cotizador',  icon: 'auto_awesome', label: 'Cotizador AI', desc: 'Generación de presupuestos con IA' },
    ]
  },
  {
    section: 'Producción',
    color: '#6366f1',
    items: [
      { path: '/proyectos',  icon: 'layers',   label: 'Proyectos',  desc: 'Estado y seguimiento de obras' },
      { path: '/produccion', icon: 'settings', label: 'Producción', desc: 'Órdenes de trabajo y carpinteros' },
    ]
  },
  {
    section: 'Marketing & RRSS',
    color: '#7AAE5A',
    items: [
      { path: '/tiktok',        icon: 'music_note',   label: 'TikTok',          desc: 'Publicaciones y gestión de cuenta @zebrano.ma' },
      { path: '/rrss',          icon: 'photo_camera', label: 'Instagram / FB',  desc: 'Borradores, aprobación y programación' },
      { path: '/rrss/importar', icon: 'upload',       label: 'Importar fotos',  desc: 'Clasificación con IA desde galería' },
    ]
  },
]

const QUICK_ACTIONS = [
  { label: '+ Nuevo prospecto', path: '/prospectos', color: '#4A6B36' },
  { label: '📸 Importar fotos', path: '/rrss/importar', color: '#7AAE5A' },
  { label: '🎵 Gestionar TikTok', path: '/tiktok', color: '#a78bfa' },
  { label: '💰 Ver publicaciones', path: '/rrss', color: '#6366f1' },
]

const CANAL_ICON = { instagram: 'photo_camera', tiktok: 'music_note', whatsapp: 'group', facebook: 'photo_camera', web: 'public', referido: 'group' }

const PROSPECTO_CHIP = {
  nuevo:      'bg-[#c3c8ba]/15 text-[#c3c8ba] border border-[#c3c8ba]/30',
  contactado: 'bg-[#a78bfa]/15 text-[#a78bfa] border border-[#a78bfa]/30',
  calificado: 'bg-[#e3b341]/15 text-[#e3b341] border border-[#e3b341]/30',
  cotizado:   'bg-[#fb923c]/15 text-[#fb923c] border border-[#fb923c]/30',
  ganado:     'bg-[#acd292]/15 text-[#acd292] border border-[#acd292]/30',
  perdido:    'bg-[#ffb4ab]/15 text-[#ffb4ab] border border-[#ffb4ab]/30',
}
const PROSPECTO_CHIP_DEFAULT = 'bg-[#8d9386]/15 text-[#8d9386] border border-[#8d9386]/30'

const PROYECTO_CHIP = {
  cotizado: 'bg-[#fb923c]/15 text-[#fb923c] border border-[#fb923c]/30',
  'seña pagada': 'bg-[#acd292]/15 text-[#acd292] border border-[#acd292]/30',
  entregado: 'bg-[#c7eeac]/15 text-[#c7eeac] border border-[#c7eeac]/30',
}
const PROYECTO_CHIP_DEFAULT = 'bg-[#8d9386]/15 text-[#8d9386] border border-[#8d9386]/30'

const DIAS_ESTANCADO = 7

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [actividades, setActividades] = useState([])
  const [estancados, setEstancados] = useState([])
  const [resumenSemana, setResumenSemana] = useState(null)
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [p, c, pr, pub, pros, proyectosData] = await Promise.all([
        supabase.from('proyectos').select('id', { count: 'exact', head: true }),
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('roble_publicaciones').select('id', { count: 'exact', head: true }).eq('estado', 'borrador'),
        supabase.from('roble_publicaciones').select('id', { count: 'exact', head: true }).eq('estado', 'publicado'),
        supabase.from('prospectos').select('id', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('proyectos').select('id, nombre, estado, fecha_cotizado, fecha_entrega_real, valor_final, valor_estimado, clientes(nombre)'),
      ])
      setStats({
        proyectos: p.count ?? 0,
        clientes: c.count ?? 0,
        borradores: pr.count ?? 0,
        publicados: pub.count ?? 0,
        prospectos: pros.count ?? 0,
      })

      // ── Proactivo #1: proyectos "Cotizado" que llevan mas de DIAS_ESTANCADO sin pasar a "Seña pagada" ──
      const proyectosList = proyectosData.data || []
      setProyectos(proyectosList)
      const hoy = new Date()
      const estanc = proyectosList.filter(pr => {
        if (pr.estado !== 'cotizado' || !pr.fecha_cotizado) return false
        const dias = Math.floor((hoy - new Date(pr.fecha_cotizado)) / 86400000)
        return dias >= DIAS_ESTANCADO
      }).map(pr => ({ ...pr, dias: Math.floor((hoy - new Date(pr.fecha_cotizado)) / 86400000) }))
        .sort((a,b) => b.dias - a.dias)
      setEstancados(estanc)

      // ── Proactivo #2: resumen de la semana, sin que nadie lo pida ──
      const inicioSemana = new Date(); inicioSemana.setHours(0,0,0,0); inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1)
      const entregadosSemana = proyectosList.filter(pr => pr.estado === 'entregado' && pr.fecha_entrega_real && new Date(pr.fecha_entrega_real) >= inicioSemana)
      const cotizadosSemana = proyectosList.filter(pr => pr.fecha_cotizado && new Date(pr.fecha_cotizado) >= inicioSemana)
      const valorCotizadoSemana = cotizadosSemana.reduce((s,pr) => s + Number(pr.valor_final || pr.valor_estimado || 0), 0)
      setResumenSemana({
        entregados: entregadosSemana.length,
        cotizados: cotizadosSemana.length,
        valorCotizado: valorCotizadoSemana,
      })

      // Actividad reciente
      const { data: acts } = await supabase
        .from('prospectos')
        .select('id, nombre, apellido, canal_origen, estado, created_at')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(5)
      setActividades(acts || [])
      setLoading(false)
    }
    load()
  }, [])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = profile?.nombre?.split(' ')[0] || 'Martín'
  const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'

  const tieneInsight = !loading && (estancados.length > 0 || (resumenSemana && (resumenSemana.entregados > 0 || resumenSemana.cotizados > 0)))

  const proyectosActivos = proyectos.filter(p => p.estado !== 'entregado')
  const valoresProyectos = proyectos.map(p => Number(p.valor_final || p.valor_estimado || 0)).filter(v => v > 0)
  const avgTicket = valoresProyectos.length ? valoresProyectos.reduce((s, v) => s + v, 0) / valoresProyectos.length : null

  return (
    <Layout>
      <Topbar title={`${saludo}, ${nombre}`} subtitle={fechaHoy} />
      <PageContent>
        {/* ── Header row: título + CTA (equivalente a "Operations Overview" del mock) ── */}
        <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-[32px] leading-[40px] font-semibold tracking-[-0.02em] text-[#e5e2e1] mb-1">
              Resumen de Operación
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8d9386]">{fechaHoy}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/cotizador')}
              className="bg-[#4a6b36] text-[#c3eaa8] px-4 py-2 rounded font-mono text-xs uppercase tracking-wide flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nueva cotización
            </button>
          </div>
        </div>

        {/* ── Agent Zebrano Insights ──────────────────────────────────────────── */}
        {tieneInsight && (
          <div className="bg-[#1c1b1b]/80 backdrop-blur-sm border border-[#2d2d2d] border-l-4 border-l-[#acd292] rounded-xl p-6 mb-8 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none">
              <span className="material-symbols-outlined text-[160px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div className="flex items-start gap-4 relative z-10">
              <div className="w-10 h-10 rounded-lg bg-[#895072] flex items-center justify-center text-[#ffd3e9] shadow-lg flex-shrink-0">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <h3 className="font-mono text-[10px] text-[#f8b2d9] uppercase tracking-widest">Agent Zebrano Insights</h3>

                {estancados.length > 0 && (
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-sm font-semibold text-[#e3b341] mb-1">
                        {estancados.length} proyecto{estancados.length !== 1 ? 's' : ''} estancado{estancados.length !== 1 ? 's' : ''} en "Cotizado"
                      </p>
                      <p className="text-xs text-[#c3c8ba] leading-relaxed">
                        {estancados.slice(0,3).map(e => `${e.clientes?.nombre || 'Sin nombre'} (${e.dias}d)`).join(' · ')}
                        {estancados.length > 3 && ` y ${estancados.length - 3} más`}
                        {' — '}sin pasar a "Seña pagada" hace más de {DIAS_ESTANCADO} días.
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/proyectos')}
                      className="border border-[#e3b341]/40 text-[#e3b341] text-[10px] font-mono uppercase tracking-wide px-3 py-1.5 rounded hover:bg-[#e3b341]/10 transition-colors flex-shrink-0 whitespace-nowrap"
                    >
                      Ver proyectos
                    </button>
                  </div>
                )}

                {resumenSemana && (resumenSemana.entregados > 0 || resumenSemana.cotizados > 0) && (
                  <div>
                    <p className="text-sm font-semibold text-[#c7eeac] mb-1">Resumen de la semana</p>
                    <p className="text-xs text-[#c3c8ba] leading-relaxed">
                      {resumenSemana.entregados} entregado{resumenSemana.entregados !== 1 ? 's' : ''} · {resumenSemana.cotizados} cotización{resumenSemana.cotizados !== 1 ? 'es' : ''} nueva{resumenSemana.cotizados !== 1 ? 's' : ''} ({fmt(resumenSemana.valorCotizado)})
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── KPI row ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[#8d9386] font-mono text-[10px] uppercase tracking-widest">Cotizado esta semana</span>
              <span className="material-symbols-outlined text-[#acd292] text-lg">trending_up</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[32px] text-[#e5e2e1] font-bold">{loading ? '—' : fmt(resumenSemana?.valorCotizado)}</span>
            </div>
            <p className="mt-4 text-[10px] font-mono text-[#8d9386]">
              {resumenSemana?.cotizados ?? 0} cotización{(resumenSemana?.cotizados ?? 0) !== 1 ? 'es' : ''} nueva{(resumenSemana?.cotizados ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[#8d9386] font-mono text-[10px] uppercase tracking-widest">Proyectos activos</span>
              <span className="material-symbols-outlined text-[#acd292] text-lg">factory</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[32px] text-[#e5e2e1] font-bold">{loading ? '—' : proyectosActivos.length}</span>
              <span className="text-[#8d9386] font-mono text-[10px]">/ {proyectos.length} totales</span>
            </div>
            <p className="mt-4 text-[10px] font-mono text-[#8d9386]">En curso, sin entregar</p>
          </div>

          <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[#8d9386] font-mono text-[10px] uppercase tracking-widest">Ticket promedio</span>
              <span className="material-symbols-outlined text-[#b0d09c] text-lg">payments</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[32px] text-[#e5e2e1] font-bold">{loading ? '—' : fmt(avgTicket)}</span>
            </div>
            <p className="mt-4 text-[10px] font-mono text-[#8d9386]">Por proyecto cotizado</p>
          </div>
        </div>

        {/* ── Dos columnas: Proyectos activos + Módulos / Prospectos recientes ── */}
        <div className="grid grid-cols-12 gap-8">

          {/* Columna izquierda: Proyectos activos + módulos del sistema */}
          <div className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#e5e2e1]">Proyectos activos</h3>
              <button onClick={() => navigate('/proyectos')} className="text-[#acd292] font-mono text-[10px] uppercase tracking-wide hover:underline">
                Ver todos los proyectos
              </button>
            </div>

            {loading ? (
              <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded p-8 text-center text-[#43483e] text-sm">Cargando...</div>
            ) : proyectosActivos.length === 0 ? (
              <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded p-8 text-center text-[#43483e] text-sm">No hay proyectos activos</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {proyectosActivos.slice(0, 4).map(p => (
                  <div
                    key={p.id}
                    onClick={() => navigate('/proyectos')}
                    className="bg-[#1c1b1b] border border-[#2d2d2d] rounded overflow-hidden group cursor-pointer hover:border-[#acd292] transition-colors duration-300"
                  >
                    <div className="h-24 relative overflow-hidden bg-gradient-to-br from-[#201f1f] to-[#0e0e0e] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#43483e] text-4xl group-hover:text-[#acd292]/40 transition-colors">layers</span>
                      <div className="absolute top-3 left-3 px-2 py-1 rounded bg-[#131313]/80 backdrop-blur border border-[#2d2d2d] font-mono text-[10px] text-[#e5e2e1]">
                        PRJ-{p.id}
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="text-base font-semibold text-[#e5e2e1] group-hover:text-[#acd292] transition-colors truncate">
                        {p.nombre || 'Sin nombre'}
                      </h4>
                      <p className="text-[#8d9386] text-xs mb-3 truncate">{p.clientes?.nombre || 'Sin cliente'}</p>
                      <span className={`inline-block px-2 py-1 rounded font-mono text-[10px] uppercase ${PROYECTO_CHIP[p.estado] || PROYECTO_CHIP_DEFAULT}`}>
                        {p.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Módulos del sistema */}
            {MODULES.map(section => (
              <div key={section.section} className="mt-8">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-[3px] h-4 rounded" style={{ background: section.color }} />
                  <span className="text-[11px] font-semibold text-[#8d9386] uppercase tracking-wider">{section.section}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {section.items.map(item => (
                    <div
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="flex items-center gap-3.5 bg-[#1c1b1b] border border-[#2d2d2d] rounded-lg px-4 py-3 cursor-pointer hover:border-[#acd292]/50 transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                        style={{ background: section.color + '18', border: `1px solid ${section.color}33`, color: section.color }}
                      >
                        <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#e5e2e1]">{item.label}</div>
                        <div className="text-[11px] text-[#8d9386] leading-snug">{item.desc}</div>
                      </div>
                      <span className="material-symbols-outlined text-[#43483e] text-sm flex-shrink-0">chevron_right</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Columna derecha: Prospectos recientes + Acciones rápidas */}
          <div className="col-span-12 lg:col-span-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#e5e2e1]">Prospectos recientes</h3>
            </div>
            <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded p-4 space-y-4">
              {loading ? (
                <p className="text-center text-[#43483e] text-sm py-8">Cargando...</p>
              ) : actividades.length === 0 ? (
                <div className="text-center text-[#43483e] py-8">
                  <div className="text-2xl mb-2">📭</div>
                  <p className="text-sm">Sin prospectos aún</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actividades.map(p => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/prospectos/${p.id}`)}
                      className="flex items-start gap-3 p-3 rounded bg-[#161616] border border-[#2d2d2d] cursor-pointer hover:border-[#acd292]/40 transition-colors"
                    >
                      <div className="mt-0.5 w-8 h-8 rounded bg-[#acd292]/10 flex items-center justify-center text-[#acd292] flex-shrink-0">
                        <span className="material-symbols-outlined text-sm">{CANAL_ICON[p.canal_origen] || 'group'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h5 className="font-mono text-sm text-[#e5e2e1] truncate">{p.nombre || 'Sin nombre'} {p.apellido || ''}</h5>
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${PROSPECTO_CHIP[p.estado] || PROSPECTO_CHIP_DEFAULT}`}>
                            {p.estado}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#8d9386] font-mono uppercase mt-1">{p.canal_origen || 'directo'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => navigate('/prospectos')}
                className="w-full py-2 border border-[#2d2d2d] rounded font-mono text-[10px] uppercase tracking-wide text-[#8d9386] hover:bg-[#201f1f] hover:text-[#e5e2e1] transition-colors"
              >
                Ver todos los prospectos
              </button>
            </div>

            {/* Acciones rápidas */}
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-[#e5e2e1] mb-4">Acciones rápidas</h3>
              <div className="flex flex-col gap-2">
                {QUICK_ACTIONS.map(a => (
                  <button
                    key={a.path}
                    onClick={() => navigate(a.path)}
                    className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: a.color + '10', border: `1px solid ${a.color}25`, color: a.color }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageContent>
    </Layout>
  )
}
