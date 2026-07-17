import React from 'react'

const BADGE_MAP = {
  // — Estados de OT / proyectos.estado (flujo actual: prospecto → cotizado → sena_pagada → en_fabricacion → entregado / cancelado) —
  prospecto:        { bg:'rgba(141,147,134,0.15)', color:'#8d9386', border:'rgba(141,147,134,0.3)', label:'Prospecto' },
  cotizado:         { bg:'rgba(227,179,65,0.15)',   color:'#e3b341', border:'rgba(227,179,65,0.3)',  label:'Cotizado' },
  sena_pagada:      { bg:'rgba(176,208,156,0.15)',  color:'#b0d09c', border:'rgba(176,208,156,0.3)', label:'Seña pagada' },
  en_fabricacion:   { bg:'rgba(172,210,146,0.15)',  color:'#acd292', border:'rgba(172,210,146,0.3)', label:'En fabricación' },
  entregado:        { bg:'rgba(111,174,90,0.18)',   color:'#6fae5a', border:'rgba(111,174,90,0.32)', label:'Entregado' },
  cancelado:        { bg:'rgba(255,180,171,0.15)',  color:'#ffb4ab', border:'rgba(255,180,171,0.3)', label:'Cancelado' },

  // — Estados legacy (oportunidades.estado_funnel u otros flujos que aún los usan) —
  en_produccion:    { bg:'rgba(172,210,146,0.15)', color:'#acd292', border:'rgba(172,210,146,0.3)', label:'En producción' },
  propuesta_enviada:{ bg:'rgba(141,147,134,0.15)', color:'#8d9386', border:'rgba(141,147,134,0.3)', label:'Propuesta enviada' },
  cotizando:        { bg:'rgba(227,179,65,0.15)',  color:'#e3b341', border:'rgba(227,179,65,0.3)',  label:'Cotizando' },
  aprobado:         { bg:'rgba(172,210,146,0.15)', color:'#acd292', border:'rgba(172,210,146,0.3)', label:'Aprobado' },
  borrador:         { bg:'rgba(111,117,104,0.15)', color:'#6f7568', border:'rgba(111,117,104,0.3)', label:'Borrador' },

  // — Funnel de prospectos/oportunidades —
  lead:             { bg:'rgba(141,147,134,0.15)', color:'#8d9386', border:'rgba(141,147,134,0.3)', label:'Lead' },
  contactado:       { bg:'rgba(227,179,65,0.15)',  color:'#e3b341', border:'rgba(227,179,65,0.3)',  label:'Contactado' },
  ganado:           { bg:'rgba(172,210,146,0.15)', color:'#acd292', border:'rgba(172,210,146,0.3)', label:'Ganado' },
  perdido:          { bg:'rgba(255,180,171,0.15)', color:'#ffb4ab', border:'rgba(255,180,171,0.3)', label:'Perdido' },
  caliente:         { bg:'rgba(248,178,217,0.15)', color:'#f8b2d9', border:'rgba(248,178,217,0.3)', label:'Caliente' },
  tibio:            { bg:'rgba(227,179,65,0.15)',  color:'#e3b341', border:'rgba(227,179,65,0.3)',  label:'Tibio' },
  frio:             { bg:'rgba(141,147,134,0.15)', color:'#8d9386', border:'rgba(141,147,134,0.3)', label:'Frío' },

  // — Origen / canal —
  instagram:        { bg:'rgba(248,178,217,0.15)', color:'#f8b2d9', border:'rgba(248,178,217,0.3)', label:'Instagram' },
  referido:         { bg:'rgba(172,210,146,0.15)', color:'#acd292', border:'rgba(172,210,146,0.3)', label:'Referido' },
  whatsapp:         { bg:'rgba(172,210,146,0.15)', color:'#acd292', border:'rgba(172,210,146,0.3)', label:'WhatsApp' },
  otro:             { bg:'rgba(141,147,134,0.15)', color:'#8d9386', border:'rgba(141,147,134,0.3)', label:'Otro' },

  // — Roles —
  admin:            { bg:'rgba(172,210,146,0.15)', color:'#acd292', border:'rgba(172,210,146,0.3)', label:'Admin' },
  taller:           { bg:'rgba(227,179,65,0.15)',  color:'#e3b341', border:'rgba(227,179,65,0.3)',  label:'Taller' },
  ventas:           { bg:'rgba(176,208,156,0.15)', color:'#b0d09c', border:'rgba(176,208,156,0.3)', label:'Ventas' },
  rrhh:             { bg:'rgba(248,178,217,0.15)', color:'#f8b2d9', border:'rgba(248,178,217,0.3)', label:'RRHH' },
}

export function Badge({ value }) {
  const s = BADGE_MAP[value] || { bg:'rgba(141,147,134,0.15)', color:'#8d9386', border:'rgba(141,147,134,0.3)' }
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 9px', borderRadius:99, fontSize:10,
      fontFamily:'var(--font-mono)', fontWeight:500, letterSpacing:'0.05em',
      textTransform:'uppercase',
      background:s.bg, color:s.color, border:`1px solid ${s.border}`,
    }}>
      <span style={{ width:4, height:4, borderRadius:'50%', background:s.color, display:'inline-block', flexShrink:0 }}/>
      {s.label || value}
    </span>
  )
}

export function Avatar({ name, size = 30 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:'rgba(172,210,146,0.15)',
      border:'1px solid rgba(172,210,146,0.3)',
      color:'var(--z-primary)', display:'flex', alignItems:'center',
      justifyContent:'center', fontSize:size*0.35,
      fontWeight:500, flexShrink:0, fontFamily:'var(--font-body)',
    }}>
      {initials}
    </div>
  )
}

export function Card({ children, style, padding = '16px 20px' }) {
  return (
    <div style={{
      background:'var(--z-card)', borderRadius:'var(--radius-lg)',
      border:'1px solid var(--z-border)', padding,
      transition:'var(--z-transition)',
      ...style
    }}>
      {children}
    </div>
  )
}

export function KpiCard({ label, value, detail, accent }) {
  return (
    <div style={{
      background: accent ? 'var(--z-primary)' : 'var(--z-card)',
      borderRadius:'var(--radius-lg)', padding:'14px 18px',
      border: accent ? 'none' : '1px solid var(--z-border)',
    }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color: accent ? 'rgba(25,55,8,0.65)' : 'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:24, fontWeight:700, color: accent ? 'var(--z-on-primary)' : 'var(--z-text)', lineHeight:1 }}>{value}</div>
      {detail && <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color: accent ? 'rgba(25,55,8,0.5)' : 'var(--z-ghost)', marginTop:4, letterSpacing:'0.04em' }}>{detail}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:500, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', whiteSpace:'nowrap' }}>{children}</div>
      <div style={{ flex:1, height:1, background:'var(--z-border)' }}/>
      {action}
    </div>
  )
}

export function Table({ cols, rows, empty = 'Sin datos' }) {
  return (
    <div style={{ border:'1px solid var(--z-border)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key || c.label} style={{
                background:'var(--z-bg-2)', padding:'8px 14px', textAlign:'left',
                fontFamily:'var(--font-mono)', fontSize:9, fontWeight:500, color:'var(--z-hint)',
                textTransform:'uppercase', letterSpacing:'0.1em',
                borderBottom:'1px solid var(--z-border)',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} style={{ textAlign:'center', padding:36, color:'var(--z-ghost)', fontSize:12 }}>{empty}</td></tr>
            : rows.map((row, i) => (
              <tr key={i}
                onClick={row._onClick}
                style={{ cursor: row._onClick ? 'pointer' : 'default', background: i % 2 === 1 ? 'var(--z-zebra)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(172,210,146,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'var(--z-zebra)' : 'transparent'}>
                {cols.map(c => (
                  <td key={c.key || c.label} style={{
                    padding:'9px 14px',
                    borderBottom: i < rows.length-1 ? '1px solid var(--z-border)' : 'none',
                    verticalAlign:'middle', color:'var(--z-text-2)',
                  }}>
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

export function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
      <div style={{
        width:20, height:20,
        border:'1px solid var(--z-border)',
        borderTop:'1px solid var(--z-primary)',
        borderRadius:'50%',
        animation:'zspin 0.8s linear infinite',
      }}/>
      <style>{`@keyframes zspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export function Btn({ children, onClick, variant='primary', small, disabled, style }) {
  const base = {
    border:'none', borderRadius:'var(--radius-sm)',
    fontWeight:500, letterSpacing:'0.03em',
    padding: small ? '5px 14px' : '8px 18px',
    fontSize: small ? 11 : 12.5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition:'opacity 0.15s, background 0.15s, filter 0.15s',
    fontFamily:'var(--font-body)',
    ...style,
  }
  const variants = {
    primary: { background:'var(--z-primary)', color:'var(--z-on-primary)' },
    ghost:   { background:'transparent', color:'var(--z-text-2)', border:'1px solid var(--z-border)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em' },
    danger:  { background:'var(--z-error)', color:'var(--z-on-error)' },
  }
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>
}

export function Input({ label, type='text', value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        style={{
          width:'100%', padding:'8px 12px',
          borderRadius:'var(--radius-sm)',
          border:'1px solid var(--z-border)',
          background:'var(--z-bg-2)', color:'var(--z-text)',
          fontSize:13, outline:'none', fontFamily:'var(--font-mono)',
        }}
        onFocus={e => e.target.style.borderColor='var(--z-primary)'}
        onBlur={e  => e.target.style.borderColor='var(--z-border)'}
      />
    </div>
  )
}
