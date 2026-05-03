import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './ui'

const NAV = [
  { section: 'Principal' },
  { path: '/',           label: 'Dashboard',       icon: 'M2 7L7 2l5 5' },
  { section: 'Gestión' },
  { path: '/proyectos',  label: 'Proyectos',       icon: 'rect' },
  { path: '/clientes',   label: 'Clientes',        icon: 'circle' },
  { path: '/ventas',     label: 'Ventas',          icon: 'trend' },
  { path: '/produccion', label: 'Producción',      icon: 'gear' },
  { section: 'Herramientas' },
  { path: '/cotizador',  label: 'Cotizador AI',    icon: 'spark' },
  { path: '/landing',    label: 'Landing pública', icon: 'globe' },
  { section: 'Administración' },
  { path: '/usuarios',   label: 'Usuarios',        icon: 'user', adminOnly: true },
]

function NavIcon({ type, active }) {
  const c = active ? '#7AAE5A' : '#2E4A22'
  const icons = {
    'M2 7L7 2l5 5': <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke={c} strokeWidth="1"/><rect x="8" y="1" width="5" height="5" rx="1" stroke={c} strokeWidth="1"/><rect x="1" y="8" width="5" height="5" rx="1" stroke={c} strokeWidth="1"/><rect x="8" y="8" width="5" height="5" rx="1" stroke={c} strokeWidth="1"/></svg>,
    rect:   <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke={c} strokeWidth="1"/><line x1="1" y1="5" x2="13" y2="5" stroke={c} strokeWidth="1"/></svg>,
    circle: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="3" stroke={c} strokeWidth="1"/><path d="M1 13c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c} strokeWidth="1"/></svg>,
    trend:  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><polyline points="1,10 4,6 7,8 10,3 13,5" stroke={c} strokeWidth="1" fill="none"/></svg>,
    gear:   <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke={c} strokeWidth="1"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke={c} strokeWidth="1"/></svg>,
    spark:  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 12L5 2l2 4 2-2 3 8" stroke={c} strokeWidth="1" strokeLinejoin="round"/></svg>,
    globe:  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke={c} strokeWidth="1"/><ellipse cx="7" cy="7" rx="2.5" ry="6" stroke={c} strokeWidth="1"/><line x1="1" y1="7" x2="13" y2="7" stroke={c} strokeWidth="1"/></svg>,
    user:   <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="4" r="3" stroke={c} strokeWidth="1"/><path d="M1 13c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c} strokeWidth="1"/></svg>,
  }
  return icons[type] || null
}

export function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#0A0D08' }}>
      <aside style={{
        width:200, minWidth:200,
        background:'#080B06',
        borderRight:'1px solid rgba(74,107,54,0.12)',
        display:'flex', flexDirection:'column', height:'100vh',
      }}>
        <div style={{ padding:'22px 18px 16px', borderBottom:'1px solid rgba(74,107,54,0.1)' }}>
          <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, fontWeight:300, fontStyle:'italic', color:'#E8DFD0', letterSpacing:'0.04em' }}>Zebrano</div>
          <div style={{ fontSize:9, color:'#2E4A22', letterSpacing:'0.18em', textTransform:'uppercase', marginTop:4 }}>mueblería a medida</div>
        </div>

        <nav style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
          {NAV.map((item, i) => {
            if (item.adminOnly && profile?.rol !== 'admin') return null
            if (item.section) return (
              <div key={i} style={{ padding:'12px 18px 4px', fontSize:9, color:'#1E3014', textTransform:'uppercase', letterSpacing:'0.14em' }}>
                {item.section}
              </div>
            )
            const active = location.pathname === item.path
            return (
              <div key={item.path} onClick={() => navigate(item.path)}
                style={{
                  display:'flex', alignItems:'center', gap:9,
                  padding:'7px 18px', cursor:'pointer', fontSize:12,
                  fontWeight:300, letterSpacing:'0.02em',
                  color: active ? '#C8D9B8' : '#3A5030',
                  background: active ? 'rgba(74,107,54,0.08)' : 'transparent',
                  borderLeft: active ? '2px solid #4A6B36' : '2px solid transparent',
                  transition:'all 0.12s',
                }}
                onMouseEnter={e => { if(!active) { e.currentTarget.style.background='rgba(74,107,54,0.04)'; e.currentTarget.style.color='#8A9E82' }}}
                onMouseLeave={e => { if(!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#3A5030' }}}
              >
                <NavIcon type={item.icon} active={active} />
                {item.label}
              </div>
            )
          })}
        </nav>

        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(74,107,54,0.1)', display:'flex', alignItems:'center', gap:10 }}>
          <Avatar name={profile?.nombre || 'Admin'} size={28} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:'#C8D9B8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {profile?.nombre || 'Administrador'}
            </div>
            <div style={{ fontSize:9, color:'#2E4A22', textTransform:'uppercase', letterSpacing:'0.08em' }}>{profile?.rol || 'admin'}</div>
          </div>
          <button onClick={signOut} title="Cerrar sesión"
            style={{ background:'none', border:'none', color:'#2E4A22', cursor:'pointer', fontSize:14, lineHeight:1, padding:2 }}
            onMouseEnter={e => e.target.style.color='#8A9E82'}
            onMouseLeave={e => e.target.style.color='#2E4A22'}>
            ⏻
          </button>
        </div>
      </aside>

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {children}
      </main>
    </div>
  )
}

export function Topbar({ title, subtitle, actions }) {
  return (
    <div style={{
      padding:'14px 24px',
      borderBottom:'1px solid rgba(74,107,54,0.1)',
      background:'#080B06',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      minHeight:54,
    }}>
      <div>
        <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:300, fontStyle:'italic', color:'#E8DFD0' }}>{title}</div>
        {subtitle && <div style={{ fontSize:10, color:'#2E4A22', marginTop:1, letterSpacing:'0.04em' }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display:'flex', gap:8 }}>{actions}</div>}
    </div>
  )
}

export function PageContent({ children, pad = 24 }) {
  return (
    <div style={{ flex:1, overflowY:'auto', padding:pad, background:'#0A0D08' }}>
      {children}
    </div>
  )
}
