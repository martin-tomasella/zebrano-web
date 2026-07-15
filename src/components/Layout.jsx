
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ─── Nav items con menú completo ──────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { path: '/', icon: 'grid', label: 'Dashboard' },
    ]
  },
  {
    label: 'Ventas',
    items: [
      { path: '/prospectos', icon: 'funnel', label: 'Prospectos' },
      { path: '/clientes',   icon: 'users',  label: 'Clientes' },
      { path: '/cotizador',  icon: 'spark',  label: 'Cotizador AI' },
      { path: '/proyectos',  icon: 'layers', label: 'Proyectos' },
      { path: '/metricas',   icon: 'chart',  label: 'Tiempos de ciclo' },
    ]
  },
  {
    label: 'Producción',
    items: [
      { path: '/produccion',    icon: 'gear',  label: 'Producción' },
      { path: '/horas-trabajo', icon: 'clock', label: 'Horas de trabajo' },
    ]
  },
  {
    label: 'Insumos',
    items: [
      { path: '/proveedores', icon: 'truck', label: 'Proveedores' },
      { path: '/materiales',  icon: 'box',   label: 'Materiales' },
    ]
  },
  {
    label: 'Administración',
    items: [
      { path: '/caja-chica', icon: 'wallet', label: 'Caja chica' },
      { path: '/usuarios',   icon: 'user',   label: 'Usuarios', adminOnly: true },
      { path: '/landing',    icon: 'globe',  label: 'Landing pública' },
    ]
  },
  {
    label: 'Marketing',
    items: [
      { path: '/tiktok',        icon: 'tiktok', label: 'TikTok' },
      { path: '/rrss',          icon: 'rrss',   label: 'Instagram / FB' },
      { path: '/rrss/importar', icon: 'upload', label: 'Importar fotos' },
    ]
  },
]

// ─── Iconos SVG ────────────────────────────────────────────────────────────────
function Icon({ name, size = 18, color = 'currentColor' }) {
  const icons = {
    grid: <><rect x="2" y="2" width="4" height="4" rx="1"/><rect x="8" y="2" width="4" height="4" rx="1"/><rect x="2" y="8" width="4" height="4" rx="1"/><rect x="8" y="8" width="4" height="4" rx="1"/></>,
    funnel: <path d="M3 4h10l-4 5v4l-2-1V9L3 4z" strokeLinejoin="round"/>,
    users: <><circle cx="5" cy="5" r="3"/><path d="M1 13c0-2.8 1.8-5 4-5s4 2.2 4 5"/><path d="M10 7c1.1 0 2 1 2 2.5"/><path d="M12 13c0-1.5-.8-2.8-2-3.5"/></>,
    spark: <path d="M3 12L5.5 3l2 4 2-2 3 7" strokeLinejoin="round"/>,
    layers: <><polygon points="8,2 14,5.5 14,10.5 8,14 2,10.5 2,5.5"/><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="5.5" x2="14" y2="5.5"/></>,
    gear: <><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4"/></>,
    tiktok: <path d="M10 2c0 2.5 1.8 3.5 3.5 3.5v2.3c-1.2 0-2.3-.3-3.5-1.2V12a4 4 0 11-3-3.9V10.5A2 2 0 107 12V2h3z" strokeLinejoin="round"/>,
    rrss: <><rect x="1" y="4" width="14" height="10" rx="1.5"/><circle cx="5" cy="5.5" r="1.2" fill={color}/><path d="M1 10l3-2 2 1.5 3-3 5 4" strokeLinejoin="round"/></>,
    upload: <><path d="M8 2v9M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 11v2a1 1 0 001 1h12a1 1 0 001-1v-2" strokeLinecap="round"/></>,
    globe: <><circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="2.5" ry="6"/><line x1="2" y1="8" x2="14" y2="8"/></>,
    user: <><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></>,
    logout: <><path d="M10 3h3a1 1 0 011 1v8a1 1 0 01-1 1h-3"/><path d="M7 11l3-3-3-3"/><line x1="10" y1="8" x2="2" y2="8"/></>,
    chevron: <path d="M6 4l4 4-4 4"/>,
    wallet: <><rect x="1.5" y="4" width="13" height="9" rx="1.5"/><path d="M1.5 6.5h13"/><circle cx="11" cy="10" r="1" fill={color}/></>,
    truck: <><rect x="1" y="5" width="8" height="6" rx="1"/><path d="M9 7h3l2 2v2h-5V7z"/><circle cx="4" cy="12.5" r="1.3"/><circle cx="11.5" cy="12.5" r="1.3"/></>,
    clock: <><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l3 1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    chart: <><path d="M2 13.5V2" strokeLinecap="round"/><path d="M2 13.5h12" strokeLinecap="round"/><path d="M4.5 11V8" strokeLinecap="round"/><path d="M8 11V5" strokeLinecap="round"/><path d="M11.5 11V6.5" strokeLinecap="round"/></>,
    box: <><path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" strokeLinejoin="round"/><path d="M2 5l6 3 6-3" strokeLinejoin="round"/><line x1="8" y1="8" x2="8" y2="14"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round">
      {icons[name]}
    </svg>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ label, children }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
          marginLeft: 10, zIndex: 1000,
          background: '#121810', border: '1px solid rgba(74,107,54,0.3)',
          color: '#E8DFD0', fontSize: 12, fontWeight: 500,
          padding: '5px 12px', borderRadius: 8, whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {label}
          <div style={{
            position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)',
            border: '5px solid transparent',
            borderRightColor: 'rgba(74,107,54,0.3)',
          }} />
        </div>
      )}
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name = '', size = 32 }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #4A6B36, #7AAE5A)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#E8DFD0',
      flexShrink: 0, letterSpacing: '-0.02em',
    }}>
      {initials || 'Z'}
    </div>
  )
}

// ─── Layout principal ─────────────────────────────────────────────────────────
export function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--z-bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 'var(--z-sidebar-w)', minWidth: 'var(--z-sidebar-w)',
        background: 'var(--z-sidebar-bg)',
        borderRight: '1px solid var(--z-border)',
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden',
        zIndex: 100,
      }}>

        {/* Logo */}
        <div style={{
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: '1px solid var(--z-border)', flexShrink: 0,
        }}>
          <Tooltip label="Zebrano ERP">
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #4A6B36, #7AAE5A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 0 16px rgba(74,107,54,0.28)',
            }} onClick={() => navigate('/')}>
              <span style={{ color: '#E8DFD0', fontWeight: 800, fontSize: 16 }}>Z</span>
            </div>
          </Tooltip>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0', overflowX: 'hidden' }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {/* Separador de sección */}
              {si > 0 && (
                <div style={{
                  height: 1, background: 'var(--z-border)',
                  margin: '6px 10px',
                }} />
              )}
              {section.items.map((item) => {
                if (item.adminOnly && profile?.rol !== 'admin') return null
                const active = isActive(item.path)
                return (
                  <Tooltip key={item.path} label={item.label}>
                    <div
                      onClick={() => navigate(item.path)}
                      style={{
                        width: 40, height: 40, margin: '2px 8px',
                        borderRadius: 10, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: active ? 'rgba(74,107,54,0.18)' : 'transparent',
                        border: active ? '1px solid rgba(74,107,54,0.35)' : '1px solid transparent',
                        color: active ? '#7AAE5A' : 'var(--z-text-3)',
                        transition: 'var(--z-transition)',
                        position: 'relative',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'rgba(74,107,54,0.08)'
                          e.currentTarget.style.color = 'var(--z-text-2)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--z-text-3)'
                        }
                      }}
                    >
                      <Icon name={item.icon} size={17} color="currentColor" />
                      {/* Dot activo */}
                      {active && (
                        <div style={{
                          position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
                          width: 3, height: 20, borderRadius: 2,
                          background: 'linear-gradient(180deg, #4A6B36, #7AAE5A)',
                        }} />
                      )}
                    </div>
                  </Tooltip>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer del sidebar */}
        <div style={{
          borderTop: '1px solid var(--z-border)', padding: '8px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <Tooltip label={profile?.nombre || 'Admin'}>
            <div style={{ display: 'flex', justifyContent: 'center', cursor: 'default' }}>
              <Avatar name={profile?.nombre || 'Admin'} size={36} />
            </div>
          </Tooltip>
          <Tooltip label="Cerrar sesión">
            <div
              onClick={signOut}
              style={{
                width: 40, height: 36, margin: '0 auto',
                borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--z-text-3)', transition: 'var(--z-transition)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--z-error)'; e.currentTarget.style.background = 'rgba(160,64,42,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--z-text-3)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon name="logout" size={16} color="currentColor" />
            </div>
          </Tooltip>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {children}
      </main>
    </div>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
export function Topbar({ title, subtitle, actions }) {
  return (
    <div style={{
      height: 56, padding: '0 24px', flexShrink: 0,
      borderBottom: '1px solid var(--z-border)',
      background: 'rgba(7,10,5,0.82)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--z-text)', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--z-text-3)', margin: 0, lineHeight: 1.2 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}

// ─── PageContent ──────────────────────────────────────────────────────────────
export function PageContent({ children, pad = 24 }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: pad }}>
      {children}
    </div>
  )
}

export { Avatar, Icon }
