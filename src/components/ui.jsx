import React from 'react'

const BADGE_MAP = {
  en_produccion:    { bg:'rgba(74,107,54,0.15)', color:'#7AAE5A', border:'rgba(74,107,54,0.3)', label:'En producción' },
  entregado:        { bg:'rgba(46,74,34,0.2)',   color:'#4A6B36', border:'rgba(46,74,34,0.3)',  label:'Entregado' },
  propuesta_enviada:{ bg:'rgba(80,100,60,0.15)', color:'#8A9E82', border:'rgba(80,100,60,0.3)', label:'Propuesta enviada' },
  cotizando:        { bg:'rgba(139,94,60,0.15)', color:'#B07B30', border:'rgba(139,94,60,0.3)', label:'Cotizando' },
  aprobado:         { bg:'rgba(74,107,54,0.15)', color:'#7AAE5A', border:'rgba(74,107,54,0.3)', label:'Aprobado' },
  borrador:         { bg:'rgba(58,80,48,0.15)',  color:'#3A5030', border:'rgba(58,80,48,0.3)',  label:'Borrador' },
  cancelado:        { bg:'rgba(160,64,42,0.15)', color:'#A0402A', border:'rgba(160,64,42,0.3)', label:'Cancelado' },
  lead:             { bg:'rgba(58,80,48,0.12)',  color:'#3A5030', border:'rgba(58,80,48,0.25)', label:'Lead' },
  contactado:       { bg:'rgba(139,94,60,0.12)', color:'#8B5E3C', border:'rgba(139,94,60,0.25)',label:'Contactado' },
  ganado:           { bg:'rgba(74,107,54,0.15)', color:'#7AAE5A', border:'rgba(74,107,54,0.3)', label:'Ganado' },
  perdido:          { bg:'rgba(160,64,42,0.15)', color:'#A0402A', border:'rgba(160,64,42,0.3)', label:'Perdido' },
  caliente:         { bg:'rgba(160,64,42,0.12)', color:'#C0604A', border:'rgba(160,64,42,0.25)',label:'Caliente' },
  tibio:            { bg:'rgba(139,94,60,0.12)', color:'#B07B30', border:'rgba(139,94,60,0.25)',label:'Tibio' },
  frio:             { bg:'rgba(58,80,48,0.12)',  color:'#8A9E82', border:'rgba(58,80,48,0.25)', label:'Frío' },
  instagram:        { bg:'rgba(100,60,80,0.12)', color:'#907080', border:'rgba(100,60,80,0.25)',label:'Instagram' },
  referido:         { bg:'rgba(74,107,54,0.12)', color:'#4A6B36', border:'rgba(74,107,54,0.25)',label:'Referido' },
  whatsapp:         { bg:'rgba(46,74,34,0.12)',  color:'#4A6B36', border:'rgba(46,74,34,0.25)', label:'WhatsApp' },
  otro:             { bg:'rgba(58,80,48,0.12)',  color:'#3A5030', border:'rgba(58,80,48,0.25)', label:'Otro' },
  admin:            { bg:'rgba(74,107,54,0.15)', color:'#7AAE5A', border:'rgba(74,107,54,0.3)', label:'Admin' },
  taller:           { bg:'rgba(139,94,60,0.12)', color:'#B07B30', border:'rgba(139,94,60,0.25)',label:'Taller' },
  ventas:           { bg:'rgba(58,80,48,0.12)',  color:'#8A9E82', border:'rgba(58,80,48,0.25)', label:'Ventas' },
}

export function Badge({ value }) {
  const s = BADGE_MAP[value] || { bg:'rgba(58,80,48,0.12)', color:'#3A5030', border:'rgba(58,80,48,0.25)' }
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 9px', borderRadius:99, fontSize:10,
      fontWeight:400, letterSpacing:'0.05em',
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
      background:'rgba(74,107,54,0.15)',
      border:'1px solid rgba(74,107,54,0.25)',
      color:'#4A6B36', display:'flex', alignItems:'center',
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
      background:'#0D120A', borderRadius:'var(--radius-lg)',
      border:'1px solid rgba(74,107,54,0.14)', padding,
      ...style
    }}>
      {children}
    </div>
  )
}

export function KpiCard({ label, value, detail, accent }) {
  return (
    <div style={{
      background: accent ? '#4A6B36' : '#0D120A',
      borderRadius:'var(--radius-lg)', padding:'14px 18px',
      border: accent ? 'none' : '1px solid rgba(74,107,54,0.14)',
    }}>
      <div style={{ fontSize:9, color: accent ? 'rgba(232,223,208,0.6)' : 'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:300, color: accent ? '#E8DFD0' : 'var(--z-text)', lineHeight:1 }}>{value}</div>
      {detail && <div style={{ fontSize:9, color: accent ? 'rgba(232,223,208,0.45)' : 'var(--z-ghost)', marginTop:4, letterSpacing:'0.04em' }}>{detail}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
      <div style={{ fontSize:9, fontWeight:400, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', whiteSpace:'nowrap' }}>{children}</div>
      <div style={{ flex:1, height:1, background:'rgba(74,107,54,0.12)' }}/>
      {action}
    </div>
  )
}

export function Table({ cols, rows, empty = 'Sin datos' }) {
  return (
    <div style={{ border:'1px solid rgba(74,107,54,0.14)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key || c.label} style={{
                background:'#080B06', padding:'8px 14px', textAlign:'left',
                fontSize:9, fontWeight:400, color:'var(--z-hint)',
                textTransform:'uppercase', letterSpacing:'0.1em',
                borderBottom:'1px solid rgba(74,107,54,0.14)',
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
                style={{ cursor: row._onClick ? 'pointer' : 'default' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(74,107,54,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                {cols.map(c => (
                  <td key={c.key || c.label} style={{
                    padding:'9px 14px',
                    borderBottom: i < rows.length-1 ? '1px solid rgba(74,107,54,0.07)' : 'none',
                    verticalAlign:'middle', color:'var(--z-text2)',
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
        border:'1px solid rgba(74,107,54,0.2)',
        borderTop:'1px solid #4A6B36',
        borderRadius:'50%',
        animation:'zspin 0.8s linear infinite',
      }}/>
      <style>{`@keyframes zspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export function Btn({ children, onClick, variant='primary', small, disabled, style }) {
  const base = {
    border:'none', borderRadius:'var(--radius-md)',
    fontWeight:400, letterSpacing:'0.06em',
    padding: small ? '5px 14px' : '8px 18px',
    fontSize: small ? 11 : 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition:'opacity 0.15s, background 0.15s',
    fontFamily:'var(--font-body)',
    ...style,
  }
  const variants = {
    primary: { background:'#4A6B36', color:'#E8DFD0' },
    ghost:   { background:'transparent', color:'var(--z-muted)', border:'1px solid rgba(74,107,54,0.2)' },
    danger:  { background:'#A0402A', color:'#E8DFD0' },
  }
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>
}

export function Input({ label, type='text', value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        style={{
          width:'100%', padding:'8px 12px',
          borderRadius:'var(--radius-sm)',
          border:'1px solid rgba(74,107,54,0.2)',
          background:'#080B06', color:'var(--z-text)',
          fontSize:13, outline:'none', fontFamily:'var(--font-body)',
        }}
        onFocus={e => e.target.style.borderColor='#4A6B36'}
        onBlur={e  => e.target.style.borderColor='rgba(74,107,54,0.2)'}
      />
    </div>
  )
}
