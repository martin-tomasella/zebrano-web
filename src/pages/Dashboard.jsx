
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent, Icon } from '../components/Layout'

// ─── Módulos del sistema ───────────────────────────────────────────────────────
const MODULES = [
  {
    section: 'Ventas',
    color: '#4A6B36',
    items: [
      { path: '/prospectos', icon: 'funnel', label: 'Prospectos', desc: 'Pipeline de oportunidades y seguimiento', stat_key: 'prospectos' },
      { path: '/clientes',   icon: 'users',  label: 'Clientes',   desc: 'Base de clientes y historial de compras', stat_key: 'clientes' },
      { path: '/cotizador',  icon: 'spark',  label: 'Cotizador AI', desc: 'Generación de presupuestos con IA', stat_key: null },
    ]
  },
  {
    section: 'Producción',
    color: '#6366f1',
    items: [
      { path: '/proyectos',  icon: 'layers', label: 'Proyectos',  desc: 'Estado y seguimiento de obras', stat_key: 'proyectos' },
      { path: '/produccion', icon: 'gear',   label: 'Producción', desc: 'Órdenes de trabajo y carpinteros', stat_key: null },
    ]
  },
  {
    section: 'Marketing & RRSS',
    color: '#7AAE5A',
    items: [
      { path: '/tiktok',        icon: 'tiktok',  label: 'TikTok',          desc: 'Publicaciones y gestión de cuenta @zebrano.ma', stat_key: null },
      { path: '/rrss',          icon: 'rrss',    label: 'Instagram / FB',  desc: 'Borradores, aprobación y programación', stat_key: 'publicaciones' },
      { path: '/rrss/importar', icon: 'upload',  label: 'Importar fotos',  desc: 'Clasificación con IA desde galería', stat_key: null },
    ]
  },
]

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, delta }) {
  return (
    <div style={{
      background: 'var(--z-card)', border: '1px solid var(--z-border)',
      borderRadius: 'var(--z-radius-lg)', padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'var(--z-transition)',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--z-border-hover)'; e.currentTarget.style.boxShadow = 'var(--z-shadow-primary)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--z-border)'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: `${color}22`, border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        <Icon name={icon} size={20} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--z-text)', lineHeight: 1.2 }}>{value ?? '—'}</div>
        <div style={{ fontSize: 12, color: 'var(--z-text-3)', marginTop: 2 }}>{label}</div>
      </div>
      {delta !== undefined && (
        <span style={{ fontSize: 11, color: delta >= 0 ? 'var(--z-success)' : 'var(--z-error)', fontWeight: 600 }}>
          {delta >= 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  )
}

// ─── Module card ──────────────────────────────────────────────────────────────
function ModuleCard({ item, color, navigate }) {
  return (
    <div
      onClick={() => navigate(item.path)}
      style={{
        background: 'var(--z-card)', border: '1px solid var(--z-border)',
        borderRadius: 'var(--z-radius-lg)', padding: '16px 18px',
        cursor: 'pointer', transition: 'var(--z-transition)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color + '55'
        e.currentTarget.style.background = color + '08'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}20`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--z-border)'
        e.currentTarget.style.background = 'var(--z-card)'
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: color + '18', border: `1px solid ${color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        <Icon name={item.icon} size={18} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--z-text)', marginBottom: 2 }}>{item.label}</div>
        <div style={{ fontSize: 11, color: 'var(--z-text-3)', lineHeight: 1.4 }}>{item.desc}</div>
      </div>
      <div style={{ color: 'var(--z-text-muted)', flexShrink: 0 }}>
        <Icon name="chevron" size={14} color="currentColor" />
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [p, c, pr, pub, pros] = await Promise.all([
        supabase.from('proyectos').select('id', { count: 'exact', head: true }),
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('roble_publicaciones').select('id', { count: 'exact', head: true }).eq('estado', 'borrador'),
        supabase.from('roble_publicaciones').select('id', { count: 'exact', head: true }).eq('estado', 'publicado'),
        supabase.from('prospectos').select('id', { count: 'exact', head: true }).eq('activo', true),
      ])
      setStats({
        proyectos: p.count ?? 0,
        clientes: c.count ?? 0,
        borradores: pr.count ?? 0,
        publicados: pub.count ?? 0,
        prospectos: pros.count ?? 0,
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

  const CANAL_ICON = { instagram:'rrss', tiktok:'tiktok', whatsapp:'users', facebook:'rrss', web:'globe', referido:'users' }
  const ESTADO_COLOR = { nuevo:'var(--z-info)', contactado:'#a78bfa', calificado:'var(--z-warning)', cotizado:'#fb923c', ganado:'var(--z-success)', perdido:'var(--z-error)' }

  return (
    <Layout>
      <Topbar
        title={`${saludo}, ${nombre}`}
        subtitle={new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
      />
      <PageContent>
        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
          <StatCard label="Prospectos activos" value={stats.prospectos} icon="funnel" color="#4A6B36" />
          <StatCard label="Clientes"           value={stats.clientes}   icon="users"  color="#6366f1" />
          <StatCard label="Proyectos"          value={stats.proyectos}  icon="layers" color="#7AAE5A" />
          <StatCard label="Borradores RRSS"    value={stats.borradores} icon="rrss"   color="#fbbf24" />
          <StatCard label="Publicaciones"      value={stats.publicados} icon="tiktok" color="#4ade80" />
        </div>

        {/* ── Dos columnas ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

          {/* Módulos del sistema */}
          <div>
            {MODULES.map((section) => (
              <div key={section.section} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 3, height: 16, borderRadius: 2, background: section.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--z-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {section.section}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {section.items.map(item => (
                    <ModuleCard key={item.path} item={item} color={section.color} navigate={navigate} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Panel lateral: actividad reciente */}
          <div>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: '#4A6B36' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--z-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Prospectos recientes
              </span>
            </div>

            <div style={{ background: 'var(--z-card)', border: '1px solid var(--z-border)', borderRadius: 'var(--z-radius-lg)', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--z-text-muted)' }}>Cargando...</div>
              ) : actividades.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--z-text-muted)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                  <p style={{ fontSize: 13 }}>Sin prospectos aún</p>
                </div>
              ) : (
                actividades.map((p, i) => (
                  <div key={p.id}
                    onClick={() => navigate(`/prospectos/${p.id}`)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: i < actividades.length - 1 ? '1px solid var(--z-border)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'var(--z-transition)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,107,54,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(74,107,54,0.1)', border: '1px solid rgba(74,107,54,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#4A6B36',
                    }}>
                      <Icon name={CANAL_ICON[p.canal_origen] || 'users'} size={15} color="currentColor" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--z-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nombre || 'Sin nombre'} {p.apellido || ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--z-text-3)', marginTop: 1, textTransform: 'capitalize' }}>
                        {p.canal_origen || 'directo'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                      background: (ESTADO_COLOR[p.estado] || 'var(--z-text-muted)') + '18',
                      color: ESTADO_COLOR[p.estado] || 'var(--z-text-muted)',
                      border: `1px solid ${(ESTADO_COLOR[p.estado] || 'var(--z-text-muted)')}33`,
                      textTransform: 'capitalize',
                    }}>{p.estado}</span>
                  </div>
                ))
              )}
              {actividades.length > 0 && (
                <div
                  onClick={() => navigate('/prospectos')}
                  style={{
                    padding: '10px 16px', cursor: 'pointer', textAlign: 'center',
                    fontSize: 12, color: '#4A6B36', fontWeight: 500,
                    borderTop: '1px solid var(--z-border)',
                    transition: 'var(--z-transition)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,107,54,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Ver todos los prospectos →
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div style={{ marginTop: 20 }}>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: '#7AAE5A' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--z-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Acciones rápidas
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: '+ Nuevo prospecto', path: '/prospectos', color: '#4A6B36' },
                  { label: '📸 Importar fotos',  path: '/rrss/importar', color: '#7AAE5A' },
                  { label: '🎵 Gestionar TikTok', path: '/tiktok', color: '#a78bfa' },
                  { label: '💰 Ver publicaciones', path: '/rrss', color: '#6366f1' },
                ].map(a => (
                  <button key={a.path}
                    onClick={() => navigate(a.path)}
                    style={{
                      width: '100%', padding: '10px 16px', borderRadius: 10,
                      background: a.color + '10', border: `1px solid ${a.color}25`,
                      color: a.color, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      textAlign: 'left', transition: 'var(--z-transition)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = a.color + '20'; e.currentTarget.style.borderColor = a.color + '50'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = a.color + '10'; e.currentTarget.style.borderColor = a.color + '25'; }}
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
