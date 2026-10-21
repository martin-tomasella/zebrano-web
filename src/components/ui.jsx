import React from 'react'

// Tonos semánticos → canal de color del design system
const T = { neutral:'ink-3', primary:'primary', success:'success', warning:'warning', orange:'orange', gold:'gold', danger:'danger', info:'info', ai:'ai' }

// Estados del negocio → tono + etiqueta legible
const BADGE_MAP = {
  // proyectos.estado: prospecto → cotizado → sena_pagada → en_fabricacion → entregado / cancelado
  prospecto:        ['neutral', 'Prospecto'],
  cotizado:         ['orange',  'Cotizado'],
  sena_pagada:      ['gold',    'Seña pagada'],
  'seña pagada':    ['gold',    'Seña pagada'],
  en_fabricacion:   ['info',    'En fabricación'],
  entregado:        ['success', 'Entregado'],
  cancelado:        ['danger',  'Cancelado'],
  // legacy
  en_produccion:    ['info',    'En producción'],
  propuesta_enviada:['neutral', 'Propuesta enviada'],
  cotizando:        ['warning', 'Cotizando'],
  aprobado:         ['primary', 'Aprobado'],
  borrador:         ['neutral', 'Borrador'],
  // funnel prospectos
  nuevo:            ['info',    'Nuevo'],
  lead:             ['neutral', 'Lead'],
  contactado:       ['ai',      'Contactado'],
  calificado:       ['warning', 'Calificado'],
  negociacion:      ['gold',    'Negociación'],
  ganado:           ['success', 'Ganado'],
  perdido:          ['danger',  'Perdido'],
  dormido:          ['neutral', 'Dormido'],
  caliente:         ['danger',  'Caliente'],
  tibio:            ['warning', 'Tibio'],
  frio:             ['info',    'Frío'],
  // canal
  instagram:        ['ai',      'Instagram'],
  tiktok:           ['neutral', 'TikTok'],
  facebook:         ['info',    'Facebook'],
  web:              ['info',    'Web'],
  referido:         ['success', 'Referido'],
  whatsapp:         ['success', 'WhatsApp'],
  otro:             ['neutral', 'Otro'],
  // roles
  admin:              ['primary', 'Admin'],
  gestion:            ['info',    'Gestión'],
  carpintero_oficial: ['gold',    'Carpintero oficial'],
  carpintero:         ['gold',    'Carpintero'],
  ayudante:           ['ai',      'Ayudante'],
  taller:             ['gold',    'Taller'],
  ventas:             ['success', 'Ventas'],
  rrhh:               ['ai',      'RRHH'],
}

export const toneOf = value => BADGE_MAP[value]?.[0] || 'neutral'
export const labelOf = value => BADGE_MAP[value]?.[1] || (value ? String(value).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : '—')
export const toneColor = (tone, a) => a == null ? `rgb(var(--z-${T[tone] || T.neutral}-c))` : `rgb(var(--z-${T[tone] || T.neutral}-c) / ${a})`

export function Badge({ value, tone, children }) {
  const t = tone || toneOf(value)
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6, height:22,
      padding:'0 9px 0 8px', borderRadius:99, fontSize:12, fontWeight:600, lineHeight:1,
      whiteSpace:'nowrap', background:toneColor(t, 0.11), color:toneColor(t),
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor', flexShrink:0 }}/>
      {children || labelOf(value)}
    </span>
  )
}

// Color estable por nombre: el mismo cliente siempre tiene el mismo avatar
const AV_TONES = ['primary','info','ai','gold','orange','success']
export function Avatar({ name, size = 30, square }) {
  const n = (name || '?').trim()
  const initials = n.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,2)
  const tone = AV_TONES[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % AV_TONES.length]
  return (
    <div aria-hidden style={{
      width:size, height:size, borderRadius: square ? 'var(--radius-sm)' : '50%',
      background:toneColor(tone, 0.14), color:toneColor(tone),
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:Math.round(size*0.38), fontWeight:650, flexShrink:0,
    }}>
      {initials}
    </div>
  )
}

export function Card({ children, style, padding = '18px 20px', onClick }) {
  return (
    <div onClick={onClick} className={onClick ? 'card-interactive' : undefined} style={{
      background:'var(--z-card)', borderRadius:'var(--radius-lg)',
      border:'1px solid var(--z-border)', padding, boxShadow:'var(--z-shadow-sm)',
      transition:'var(--z-transition)', ...style,
    }}>
      {children}
    </div>
  )
}

export function KpiCard({ label, value, detail, accent, icon, tone = 'primary', onClick }) {
  return (
    <Card padding="16px 18px" onClick={onClick} style={accent ? { borderColor:toneColor(tone, 0.35), background:`linear-gradient(180deg, ${toneColor(tone, 0.06)}, var(--z-card))` } : undefined}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        {icon && <span className="material-symbols-outlined" style={{ fontSize:18, color:toneColor(tone) }}>{icon}</span>}
        <span style={{ fontSize:13, fontWeight:500, color:'var(--z-text-3)' }}>{label}</span>
      </div>
      <div style={{ fontSize:26, fontWeight:650, color:'var(--z-text)', lineHeight:1, letterSpacing:'-0.02em', fontStretch:'92%' }}>{value}</div>
      {detail && <div style={{ fontSize:12.5, color:'var(--z-text-3)', marginTop:8 }}>{detail}</div>}
    </Card>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
      <h3 style={{ fontSize:15, fontWeight:600, color:'var(--z-text)', whiteSpace:'nowrap' }}>{children}</h3>
      <div style={{ flex:1 }}/>
      {action}
    </div>
  )
}

export function EmptyState({ icon = 'inbox', title, children, action }) {
  return (
    <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--z-text-3)' }}>
      <div style={{ width:44, height:44, borderRadius:12, margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--z-inset)' }}>
        <span className="material-symbols-outlined" style={{ fontSize:22, color:'var(--z-text-3)' }}>{icon}</span>
      </div>
      {title && <div style={{ fontSize:14, fontWeight:600, color:'var(--z-text)', marginBottom:4 }}>{title}</div>}
      {children && <div style={{ fontSize:13, maxWidth:320, margin:'0 auto' }}>{children}</div>}
      {action && <div style={{ marginTop:14 }}>{action}</div>}
    </div>
  )
}

export function Table({ cols, rows, empty = 'Sin datos' }) {
  return (
    <div style={{ border:'1px solid var(--z-border)', borderRadius:'var(--radius-lg)', overflow:'auto', background:'var(--z-card)', boxShadow:'var(--z-shadow-sm)' }}>
      <table style={{ width:'100%' }}>
        <thead>
          <tr>{cols.map(c => <th key={c.key || c.label}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length}><EmptyState title={empty} /></td></tr>
            : rows.map((row, i) => (
              <tr key={i} onClick={row._onClick} style={{ cursor: row._onClick ? 'pointer' : 'default' }}>
                {cols.map(c => (
                  <td key={c.key || c.label} style={{ verticalAlign:'middle', color:'var(--z-text-2)' }}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}

export function Spinner({ size = 20, pad = 60 }) {
  return (
    <div role="status" aria-label="Cargando" style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:pad }}>
      <div style={{
        width:size, height:size, border:'2px solid var(--z-border)', borderTopColor:'var(--z-primary)',
        borderRadius:'50%', animation:'spin 0.7s linear infinite',
      }}/>
    </div>
  )
}

export function Btn({ children, onClick, variant='primary', small, disabled, style, icon, type = 'button' }) {
  const cls = { primary:'btn-primary', ghost:'btn-ghost', secondary:'btn-secondary', quiet:'btn-quiet', danger:'btn-danger' }[variant] || 'btn-primary'
  return (
    <button type={type} className={`btn ${cls}${small ? ' btn-sm' : ''}`} style={style} onClick={onClick} disabled={disabled}>
      {icon && <span className="material-symbols-outlined">{icon}</span>}
      {children}
    </button>
  )
}

export function Input({ label, type='text', value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:'block', fontSize:13, fontWeight:500, color:'var(--z-text-2)', marginBottom:6 }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} />
    </div>
  )
}
