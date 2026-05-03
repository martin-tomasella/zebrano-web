import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './ui'

const NAV = [
  { section: 'Principal' },
  { path: '/',          label: 'Dashboard',    icon: '▦' },
  { section: 'Gestión' },
  { path: '/proyectos', label: 'Proyectos',    icon: '◫' },
  { path: '/clientes',  label: 'Clientes',     icon: '◎' },
  { path: '/ventas',    label: 'Ventas',       icon: '◈' },
  { path: '/produccion',label: 'Producción',   icon: '⚙' },
  { section: 'Herramientas' },
  { path: '/cotizador', label: 'Cotizador AI', icon: '✦' },
  { path: '/landing',   label: 'Landing pública', icon: '◉' },
]

export function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 210, minWidth: 210, background:'#fff', borderRight:'0.5px solid var(--z-border)',
        display:'flex', flexDirection:'column', height:'100vh'
      }}>
        {/* Logo */}
        <div style={{ padding:'18px 20px', borderBottom:'0.5px solid var(--z-border)' }}>
          <div style={{ fontSize:16, fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--z-text)' }}>Zebrano</div>
          <div style={{ fontSize:11, color:'var(--z-hint)', marginTop:2 }}>Carpintería a medida</div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {NAV.map((item, i) => {
            if (item.section) return (
              <div key={i} style={{ padding:'10px 20px 4px', fontSize:10, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                {item.section}
              </div>
            )
            const active = location.pathname === item.path
            return (
              <div key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'8px 20px', cursor:'pointer', fontSize:13,
                  color: active ? 'var(--z-text)' : 'var(--z-muted)',
                  fontWeight: active ? 500 : 400,
                  background: active ? 'var(--z-green-lt)' : 'transparent',
                  borderLeft: active ? '2px solid var(--z-green)' : '2px solid transparent',
                  transition:'all 0.12s',
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                }}
                onMouseEnter={e => { if(!active) e.currentTarget.style.background='#F7F6F2' }}
                onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent' }}
              >
                <span style={{ fontSize:14, width:16, textAlign:'center', opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
              </div>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding:'12px 16px', borderTop:'0.5px solid var(--z-border)', display:'flex', alignItems:'center', gap:10 }}>
          <Avatar name={profile?.nombre || 'Admin'} size={30} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:500, color:'var(--z-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {profile?.nombre || 'Administrador'}
            </div>
            <div style={{ fontSize:11, color:'var(--z-hint)' }}>{profile?.rol || 'admin'}</div>
          </div>
          <button onClick={signOut} title="Cerrar sesión" style={{ background:'none', border:'none', color:'var(--z-hint)', cursor:'pointer', fontSize:16, lineHeight:1 }}>⏻</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {children}
      </main>
    </div>
  )
}

/* Topbar reutilizable */
export function Topbar({ title, subtitle, actions }) {
  return (
    <div style={{
      padding:'14px 24px', borderBottom:'0.5px solid var(--z-border)',
      background:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between',
      minHeight:56
    }}>
      <div>
        <div style={{ fontSize:15, fontWeight:500, color:'var(--z-text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:'var(--z-hint)', marginTop:1 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display:'flex', gap:8 }}>{actions}</div>}
    </div>
  )
}

/* Scroll content wrapper */
export function PageContent({ children, pad = 24 }) {
  return (
    <div style={{ flex:1, overflowY:'auto', padding:pad }}>
      {children}
    </div>
  )
}
