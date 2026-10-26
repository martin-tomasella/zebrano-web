import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AgentBitacora from './AgentBitacora'
import { tieneAcceso } from '../lib/permisos'
import { supabase } from '../lib/supabase'

// ─── Navegación ──────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { label: null, items: [
    { path: '/', icon: 'grid', label: 'Inicio', moduloKey: 'dashboard' },
  ]},
  { label: 'Ventas', items: [
    { path: '/prospectos', icon: 'funnel', label: 'Prospectos', moduloKey: 'prospectos' },
    { path: '/cotizador',  icon: 'spark',  label: 'Cotizador AI', moduloKey: 'cotizador' },
    { path: '/cotizar-modulos', icon: 'straighten', label: 'Cotizar por módulos', moduloKey: 'cotizador_modular' },
    { path: '/proyectos',  icon: 'layers', label: 'Proyectos', moduloKey: 'proyectos' },
  ]},
  { label: 'Clientes y mercado', items: [
    { path: '/clientes',   icon: 'users',  label: 'Clientes', moduloKey: 'clientes' },
    { path: '/mercado',    icon: 'storefront', label: 'Mercado', moduloKey: 'mercado' },
    { path: '/metricas',   icon: 'chart',  label: 'Tiempos de ciclo', moduloKey: 'metricas' },
  ]},
  { label: 'Producción', items: [
    { path: '/produccion',    icon: 'gear',  label: 'Taller', moduloKey: 'produccion' },
    { path: '/ordenes',       icon: 'content_cut', label: 'Órdenes y despiece', moduloKey: 'ordenes' },
    { path: '/horas-trabajo', icon: 'clock', label: 'Horas de trabajo', moduloKey: 'horas_trabajo' },
  ]},
  { label: 'Insumos', items: [
    { path: '/compras',     icon: 'receipt_long', label: 'Compras', moduloKey: 'compras' },
    { path: '/proveedores', icon: 'truck', label: 'Proveedores', moduloKey: 'proveedores' },
    { path: '/materiales',  icon: 'box',   label: 'Materiales', moduloKey: 'materiales' },
  ]},
  { label: 'Administración', items: [
    { path: '/personal',   icon: 'badge', label: 'Personal y estructura', moduloKey: 'personal' },
    { path: '/finanzas',   icon: 'wallet', label: 'Finanzas', moduloKey: 'finanzas' },
    { path: '/usuarios',   icon: 'user',   label: 'Usuarios', moduloKey: 'usuarios' },
  ]},
  { label: 'Marketing', items: [
    { path: '/landing',       icon: 'globe',  label: 'Landing pública', moduloKey: 'landing' },
    { path: '/tiktok',        icon: 'tiktok', label: 'TikTok', moduloKey: 'tiktok' },
    { path: '/rrss',          icon: 'rrss',   label: 'Instagram / FB', moduloKey: 'rrss' },
    { path: '/rrss/importar', icon: 'upload', label: 'Importar fotos', moduloKey: 'rrss_importar' },
  ]},
]

const ICON_MAP = {
  grid: 'space_dashboard', funnel: 'filter_alt', users: 'groups', spark: 'auto_awesome', layers: 'view_kanban',
  gear: 'carpenter', tiktok: 'music_note', rrss: 'photo_camera', upload: 'add_photo_alternate', globe: 'language',
  user: 'manage_accounts', logout: 'logout', chevron: 'chevron_right', wallet: 'account_balance',
  truck: 'local_shipping', clock: 'schedule', chart: 'monitoring', box: 'inventory_2',
}

function Icon({ name, size = 20, color = 'currentColor', fill }) {
  return (
    <span className="material-symbols-outlined" aria-hidden style={{
      fontSize: size, color, width: size, height: size, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontVariationSettings: fill ? "'FILL' 1" : undefined,
    }}>
      {ICON_MAP[name] || name}
    </span>
  )
}

// Marca: un taco de zebrano visto de canto — veta clara con rayas oscuras
export function BrandMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ flexShrink: 0 }}>
      <defs><clipPath id="zbm"><rect width="32" height="32" rx="8"/></clipPath></defs>
      <g clipPath="url(#zbm)">
        <rect width="32" height="32" fill="#D8B26E"/>
        {[-6, 2, 9, 15, 22, 29].map((x, i) => (
          <path key={i} d={`M${x} 34 C ${x + 4} 22, ${x + 2} 12, ${x + 8} -2`} stroke="#4B2F17"
            strokeWidth={i % 2 ? 2.6 : 1.4} fill="none" opacity={i % 2 ? 0.95 : 0.7}/>
        ))}
      </g>
    </svg>
  )
}

function Avatar({ name = '', size = 32 }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div aria-hidden style={{
      width: size, height: size, borderRadius: '50%', background: 'rgb(var(--z-primary-c) / 0.14)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 650, color: 'rgb(var(--z-primary-c))', flexShrink: 0,
    }}>
      {initials || 'Z'}
    </div>
  )
}

// ─── Tema y preferencias persistidas ─────────────────────────────────────────
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}
function initialTheme() {
  const t = store.get('z-theme', null)
  if (t) return t
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
// Se aplica al cargar el módulo para evitar el destello de tema
document.documentElement.dataset.theme = initialTheme()

function findNav(pathname) {
  let best = null
  for (const s of NAV_SECTIONS) for (const i of s.items) {
    const hit = i.path === '/' ? pathname === '/' : pathname.startsWith(i.path)
    if (hit && (!best || i.path.length > best.item.path.length)) best = { section: s.label, item: i }
  }
  return best
}

// ─── Búsqueda global (Ctrl/⌘ + K) ────────────────────────────────────────────
function CommandPalette({ open, onClose, rol, onTheme, onAgent }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [records, setRecords] = useState([])
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { if (open) { setQ(''); setRecords([]); setSel(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  useEffect(() => {
    const term = q.trim().replace(/[,()%]/g, ' ')
    if (!open || term.length < 2) { setRecords([]); return }
    let vivo = true
    const t = setTimeout(async () => {
      const like = `%${term}%`
      const none = Promise.resolve({ data: [] })
      const [cl, pr, ps] = await Promise.all([
        tieneAcceso(rol, 'clientes') ? supabase.from('clientes').select('id, nombre').ilike('nombre', like).limit(5) : none,
        tieneAcceso(rol, 'proyectos') ? supabase.from('proyectos').select('id, nombre, estado, clientes(nombre)').ilike('nombre', like).limit(5) : none,
        tieneAcceso(rol, 'prospectos') ? supabase.from('prospectos').select('id, nombre, apellido, estado').or(`nombre.ilike.${like},apellido.ilike.${like}`).limit(5) : none,
      ])
      if (!vivo) return
      setRecords([
        ...(pr.data || []).map(r => ({ group: 'Proyectos', icon: 'view_kanban', label: r.nombre || 'Sin nombre', hint: r.clientes?.nombre, go: () => navigate('/proyectos') })),
        ...(ps.data || []).map(r => ({ group: 'Prospectos', icon: 'filter_alt', label: `${r.nombre || ''} ${r.apellido || ''}`.trim() || 'Sin nombre', hint: r.estado, go: () => navigate(`/prospectos/${r.id}`) })),
        ...(cl.data || []).map(r => ({ group: 'Clientes', icon: 'person', label: r.nombre || 'Sin nombre', go: () => navigate('/clientes') })),
      ])
      setSel(0)
    }, 180)
    return () => { vivo = false; clearTimeout(t) }
  }, [q, open, rol, navigate])

  if (!open) return null

  const term = q.trim().toLowerCase()
  const acciones = [
    tieneAcceso(rol, 'cotizador') && { group: 'Acciones', icon: 'add', label: 'Nueva cotización', go: () => navigate('/cotizador') },
    tieneAcceso(rol, 'prospectos') && { group: 'Acciones', icon: 'person_add', label: 'Nuevo prospecto', go: () => navigate('/prospectos') },
    { group: 'Acciones', icon: 'smart_toy', label: 'Abrir Agent Zebrano', go: onAgent },
    { group: 'Acciones', icon: 'contrast', label: 'Cambiar tema claro / oscuro', go: onTheme },
  ].filter(Boolean)
  const paginas = NAV_SECTIONS.flatMap(s => s.items.filter(i => tieneAcceso(rol, i.moduloKey)).map(i => ({
    group: 'Ir a', icon: ICON_MAP[i.icon], label: i.label, hint: s.label, go: () => navigate(i.path),
  })))
  const match = x => !term || x.label.toLowerCase().includes(term) || (x.hint || '').toLowerCase().includes(term)
  const items = [...acciones.filter(match), ...records, ...paginas.filter(match)]

  const run = it => { onClose(); it?.go?.() }
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[sel]) }
    else if (e.key === 'Escape') onClose()
  }

  let lastGroup = null
  return (
    <div className="z-overlay" onMouseDown={onClose}>
      <div className="z-palette z-pop" role="dialog" aria-label="Buscar" onMouseDown={e => e.stopPropagation()}>
        <div className="z-palette-input">
          <Icon name="search" size={20} color="var(--z-text-3)" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Buscar proyectos, clientes, prospectos o páginas…" aria-label="Buscar" />
          <span className="kbd">Esc</span>
        </div>
        <div className="z-palette-list" role="listbox">
          {items.length === 0 && <div className="z-palette-empty">Nada coincide con “{q}”. Probá con otro nombre.</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null
            return (
              <React.Fragment key={i}>
                {head && <div className="z-palette-group">{head}</div>}
                <div role="option" aria-selected={i === sel} className={`z-palette-item${i === sel ? ' is-sel' : ''}`}
                  onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
                  <Icon name={it.icon} size={18} />
                  <span className="truncate" style={{ flex: 1 }}>{it.label}</span>
                  {it.hint && <span className="z-palette-hint">{String(it.hint).replace(/_/g, ' ')}</span>}
                </div>
              </React.Fragment>
            )
          })}
        </div>
        <div className="z-palette-foot">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> moverse</span>
          <span><span className="kbd">Enter</span> abrir</span>
        </div>
      </div>
    </div>
  )
}

// ─── Layout principal ────────────────────────────────────────────────────────
export function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => store.get('z-nav-collapsed', false))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentCount, setAgentCount] = useState(0)
  const [palette, setPalette] = useState(false)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const [userMenu, setUserMenu] = useState(false)
  // Secciones del menú: arrancan contraídas; se abre la de la página actual y las que el usuario abra.
  const [abiertas, setAbiertas] = useState(() => store.get('z-nav-abiertas', {}))
  useEffect(() => { store.set('z-nav-abiertas', abiertas) }, [abiertas])

  useEffect(() => { document.documentElement.dataset.theme = theme; store.set('z-theme', theme) }, [theme])
  useEffect(() => { store.set('z-nav-collapsed', collapsed) }, [collapsed])
  useEffect(() => { setMobileOpen(false); setUserMenu(false) }, [location.pathname])
  useEffect(() => {
    const k = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), [])
  const toggleAgent = useCallback(() => setAgentOpen(o => !o), [])
  const isActive = path => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  const current = findNav(location.pathname)
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

  return (
    <div className={`z-shell${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="z-nav" aria-label="Navegación principal">
        <a className="z-nav-brand" href="/" onClick={e => { e.preventDefault(); navigate('/') }}>
          <BrandMark size={32} />
          <div className="z-nav-label">
            <div className="z-nav-brand-name">Zebrano</div>
            <div className="z-nav-brand-sub">Muebles a medida</div>
          </div>
        </a>

        <nav className="z-nav-scroll">
          {NAV_SECTIONS.map((section, si) => {
            const visibles = section.items.filter(item => tieneAcceso(profile?.rol, item.moduloKey))
            if (!visibles.length) return null
            const tieneActiva = visibles.some(i => current?.item.path === i.path)
            const abierta = !section.label || tieneActiva || !!abiertas[section.label]
            return (
              <div key={si} className="z-nav-section">
                {section.label && (
                  <button type="button" className="z-nav-heading flex w-full items-center justify-between bg-transparent border-0 cursor-pointer text-left"
                    aria-expanded={abierta} onClick={() => setAbiertas(o => ({ ...o, [section.label]: !abierta }))}>
                    <span>{section.label}</span>
                    <span className="material-symbols-outlined z-nav-label" aria-hidden style={{ fontSize: 16 }}>{abierta ? 'expand_less' : 'expand_more'}</span>
                  </button>
                )}
                {(abierta || collapsed) && visibles.map(item => {
                  const active = current?.item.path === item.path
                  return (
                    <a key={item.path} href={item.path} title={collapsed ? item.label : undefined}
                      className={`z-nav-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}
                      onClick={e => { e.preventDefault(); navigate(item.path) }}>
                      <Icon name={item.icon} size={20} fill={active} />
                      <span className="z-nav-label truncate">{item.label}</span>
                    </a>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <button className="z-nav-collapse" onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Expandir menú' : undefined}>
          <Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} size={20} />
          <span className="z-nav-label">Contraer menú</span>
        </button>
      </aside>
      <div className="z-nav-scrim" onClick={() => setMobileOpen(false)} />

      {/* ── Columna principal ── */}
      <div className="z-main">
        <header className="z-topbar">
          <button className="btn btn-quiet btn-icon z-only-mobile" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Icon name="menu" />
          </button>

          <div className="z-crumbs z-hide-mobile">
            {current?.section && <><span>{current.section}</span><Icon name="chevron_right" size={16} color="var(--z-text-muted)" /></>}
            <span className="z-crumbs-current">{current?.item.label || 'Zebrano'}</span>
          </div>

          <button className="z-search" onClick={() => setPalette(true)}>
            <Icon name="search" size={18} />
            <span className="truncate" style={{ flex: 1, textAlign: 'left' }}>Buscar en Zebrano…</span>
            <span className="kbd z-hide-mobile">{isMac ? '⌘' : 'Ctrl'} K</span>
          </button>

          <div className="z-topbar-actions">
            {tieneAcceso(profile?.rol, 'cotizador') && (
              <button className="btn btn-primary btn-sm z-hide-mobile" onClick={() => navigate('/cotizador')}>
                <Icon name="add" size={18} /> Cotizar
              </button>
            )}
            <button className={`btn btn-quiet btn-icon${agentOpen ? ' is-on' : ''}`} onClick={toggleAgent}
              aria-label="Agent Zebrano" aria-pressed={agentOpen} title="Agent Zebrano" style={{ position: 'relative' }}>
              <Icon name="smart_toy" fill={agentOpen} color={agentOpen ? 'rgb(var(--z-ai-c))' : undefined} />
              {agentCount > 0 && <span className="z-dot-count">{agentCount}</span>}
            </button>
            <button className="btn btn-quiet btn-icon" onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
              <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>

            <div style={{ position: 'relative' }}>
              <button className="z-user" onClick={() => setUserMenu(m => !m)} aria-haspopup="menu" aria-expanded={userMenu}>
                <Avatar name={profile?.nombre || 'Admin'} size={30} />
                <span className="z-hide-mobile" style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--z-text)' }}>{profile?.nombre?.split(' ')[0] || 'Usuario'}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--z-text-3)', textTransform: 'capitalize' }}>{(profile?.rol || 'usuario').replace(/_/g, ' ')}</span>
                </span>
                <Icon name="expand_more" size={18} color="var(--z-text-3)" />
              </button>
              {userMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 89 }} onClick={() => setUserMenu(false)} />
                  <div className="z-menu z-pop" role="menu">
                    <div style={{ padding: '10px 12px 8px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--z-text)' }}>{profile?.nombre || 'Usuario'}</div>
                      <div style={{ fontSize: 12, color: 'var(--z-text-3)' }}>{profile?.email || ''}</div>
                    </div>
                    <div className="z-menu-sep" />
                    <button role="menuitem" className="z-menu-item" onClick={toggleTheme}><Icon name="contrast" size={18} /> Tema {theme === 'dark' ? 'claro' : 'oscuro'}</button>
                    {tieneAcceso(profile?.rol, 'usuarios') && <button role="menuitem" className="z-menu-item" onClick={() => navigate('/usuarios')}><Icon name="manage_accounts" size={18} /> Usuarios y permisos</button>}
                    <div className="z-menu-sep" />
                    <button role="menuitem" className="z-menu-item is-danger" onClick={signOut}><Icon name="logout" size={18} /> Cerrar sesión</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="z-content">{children}</main>
      </div>

      <AgentBitacora collapsed={!agentOpen} onToggle={toggleAgent} onCount={setAgentCount} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} rol={profile?.rol}
        onTheme={toggleTheme} onAgent={() => setAgentOpen(true)} />
    </div>
  )
}

// ─── Encabezado de página ────────────────────────────────────────────────────
export function Topbar({ title, subtitle, actions }) {
  return (
    <div className="z-page-head">
      <div style={{ minWidth: 0 }}>
        <h1 className="z-page-title">{title}</h1>
        {subtitle && <p className="z-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="z-page-actions">{actions}</div>}
    </div>
  )
}

export function PageContent({ children, pad = 24 }) {
  return <div className="z-page-body" style={pad === 24 ? undefined : { padding: pad }}>{children}</div>
}

export { Avatar, Icon, NAV_SECTIONS }
