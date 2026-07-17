

import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AgentBitacora from './AgentBitacora'

// ─── Nav items con menú completo ──────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: null,
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
      { path: '/finanzas',   icon: 'wallet', label: 'Finanzas' },
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

// ─── Iconos (Material Symbols Outlined — icon font, no SVG a mano) ────────────
// Mapeo name → símbolo Material. Se mantiene la misma API (name/size/color) que
// usaban los ~18 iconos hand-drawn anteriores, así ningún <Icon name="..."/>
// existente en el resto de la app necesita tocarse.
const ICON_MAP = {
  grid: 'dashboard',
  funnel: 'filter_alt',
  users: 'group',
  spark: 'auto_awesome',
  layers: 'layers',
  gear: 'settings',
  tiktok: 'music_note',
  rrss: 'photo_camera',
  upload: 'upload',
  globe: 'public',
  user: 'person',
  logout: 'logout',
  chevron: 'chevron_right',
  wallet: 'account_balance_wallet',
  truck: 'local_shipping',
  clock: 'schedule',
  chart: 'bar_chart',
  box: 'inventory_2',
}

function Icon({ name, size = 18, color = 'currentColor' }) {
  const symbol = ICON_MAP[name] || 'help'
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size, color, lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, flexShrink: 0,
      }}
    >
      {symbol}
    </span>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name = '', size = 32 }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--radius-sm)',
      background: 'var(--z-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: 'var(--z-on-primary)',
      flexShrink: 0, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)',
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
  const [bitacoraColapsada, setBitacoraColapsada] = useState(false)

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

        {/* Wordmark */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px',
          borderBottom: '1px solid var(--z-border)', flexShrink: 0,
          cursor: 'pointer',
        }} onClick={() => navigate('/')}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)', flexShrink: 0,
            background: 'var(--z-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--z-on-primary)', fontVariationSettings: "'FILL' 1" }}>factory</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--z-primary)', lineHeight: 1.15 }}>Zebrano ERP</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--z-text-3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 2 }}>Manufacturing Suite</div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 10px' }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginBottom: 4 }}>
              {section.label && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5, fontWeight: 500, color: 'var(--z-text-3)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  padding: '14px 10px 6px',
                }}>
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                if (item.adminOnly && profile?.rol !== 'admin') return null
                const active = isActive(item.path)
                return (
                  <div
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      height: 38, padding: '0 10px', margin: '1px 0',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      background: active ? 'var(--z-active-bg)' : 'transparent',
                      color: active ? 'var(--z-primary)' : 'var(--z-text-2)',
                      fontSize: 13.5, fontWeight: active ? 700 : 500,
                      transition: 'var(--z-transition)',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'var(--z-card-hover)'
                        e.currentTarget.style.color = 'var(--z-text)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--z-text-2)'
                      }
                    }}
                  >
                    <Icon name={item.icon} size={17} color="currentColor" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer del sidebar */}
        <div style={{
          borderTop: '1px solid var(--z-border)', padding: '10px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Avatar name={profile?.nombre || 'Admin'} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--z-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.nombre || 'Admin'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--z-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {profile?.rol || 'usuario'}
            </div>
          </div>
          <div
            onClick={signOut}
            title="Cerrar sesión"
            style={{
              width: 30, height: 30, borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--z-text-3)', transition: 'var(--z-transition)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--z-error)'; e.currentTarget.style.background = 'rgba(255,180,171,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--z-text-3)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon name="logout" size={16} color="currentColor" />
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {children}
      </main>

      {/* ── Bitácora de Zebrano (panel global) ──────────────────────────────── */}
      <AgentBitacora collapsed={bitacoraColapsada} onToggle={() => setBitacoraColapsada(c => !c)} />
    </div>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
export function Topbar({ title, subtitle, actions }) {
  return (
    <div style={{
      height: 56, padding: '0 24px', flexShrink: 0,
      borderBottom: '1px solid var(--z-border)',
      background: 'rgba(19,19,19,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--z-text)', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--z-text-3)', margin: 0, lineHeight: 1.3, letterSpacing: '0.03em' }}>{subtitle}</p>}
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

export { Avatar, Icon, NAV_SECTIONS }
