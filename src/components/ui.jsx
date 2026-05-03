import React from 'react'

/* ── Badge ── */
const BADGE_STYLES = {
  en_produccion:    { bg:'#E1F5EE', color:'#0F6E56' },
  entregado:        { bg:'#EAF3DE', color:'#3B6D11' },
  propuesta_enviada:{ bg:'#E6F1FB', color:'#185FA5' },
  cotizando:        { bg:'#FAEEDA', color:'#854F0B' },
  aprobado:         { bg:'#E1F5EE', color:'#0F6E56' },
  borrador:         { bg:'#F1EFE8', color:'#5F5E5A' },
  cancelado:        { bg:'#FCEBEB', color:'#A32D2D' },
  lead:             { bg:'#F1EFE8', color:'#5F5E5A' },
  contactado:       { bg:'#FAEEDA', color:'#854F0B' },
  ganado:           { bg:'#EAF3DE', color:'#3B6D11' },
  perdido:          { bg:'#FCEBEB', color:'#A32D2D' },
  caliente:         { bg:'#FCEBEB', color:'#A32D2D' },
  tibio:            { bg:'#FAEEDA', color:'#854F0B' },
  frio:             { bg:'#E6F1FB', color:'#185FA5' },
  instagram:        { bg:'#FBEAF0', color:'#72243E' },
  tiktok:           { bg:'#E6F1FB', color:'#185FA5' },
  referido:         { bg:'#E1F5EE', color:'#0F6E56' },
  whatsapp:         { bg:'#EAF3DE', color:'#3B6D11' },
  otro:             { bg:'#F1EFE8', color:'#5F5E5A' },
}

const BADGE_LABELS = {
  en_produccion:'En producción', entregado:'Entregado', propuesta_enviada:'Propuesta enviada',
  cotizando:'Cotizando', aprobado:'Aprobado', borrador:'Borrador', cancelado:'Cancelado',
  lead:'Lead', contactado:'Contactado', ganado:'Ganado', perdido:'Perdido',
  caliente:'Caliente', tibio:'Tibio', frio:'Frío',
}

export function Badge({ value }) {
  const s = BADGE_STYLES[value] || { bg:'#F1EFE8', color:'#5F5E5A' }
  return (
    <span style={{
      display:'inline-block', padding:'2px 9px', borderRadius:99,
      fontSize:11, fontWeight:500, background:s.bg, color:s.color,
      whiteSpace:'nowrap'
    }}>
      {BADGE_LABELS[value] || value}
    </span>
  )
}

/* ── Avatar ── */
export function Avatar({ name, size = 32 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:'#E1F5EE', color:'#0F6E56',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.38, fontWeight:500, flexShrink:0
    }}>
      {initials}
    </div>
  )
}

/* ── Card ── */
export function Card({ children, style, padding = '16px 20px' }) {
  return (
    <div style={{
      background:'#fff', borderRadius:'var(--radius-lg)',
      border:'0.5px solid var(--z-border)', padding,
      boxShadow:'var(--shadow)', ...style
    }}>
      {children}
    </div>
  )
}

/* ── KPI Card ── */
export function KpiCard({ label, value, detail, accent }) {
  return (
    <div style={{
      background: accent ? '#1D9E75' : '#fff',
      borderRadius:'var(--radius-lg)', padding:'14px 18px',
      border:'0.5px solid var(--z-border)', boxShadow:'var(--shadow)'
    }}>
      <div style={{ fontSize:11, color: accent ? 'rgba(255,255,255,0.7)' : 'var(--z-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:500, color: accent ? '#fff' : 'var(--z-text)', marginTop:4, lineHeight:1 }}>{value}</div>
      {detail && <div style={{ fontSize:11, color: accent ? 'rgba(255,255,255,0.6)' : 'var(--z-hint)', marginTop:4 }}>{detail}</div>}
    </div>
  )
}

/* ── Section Title ── */
export function SectionTitle({ children, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
      <div style={{ fontSize:11, fontWeight:500, color:'var(--z-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{children}</div>
      {action}
    </div>
  )
}

/* ── Table ── */
export function Table({ cols, rows, empty = 'Sin datos' }) {
  return (
    <div style={{ border:'0.5px solid var(--z-border)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key || c.label} style={{
                background:'#F7F6F2', padding:'8px 12px', textAlign:'left',
                fontSize:11, fontWeight:500, color:'var(--z-muted)',
                textTransform:'uppercase', letterSpacing:'0.05em',
                borderBottom:'0.5px solid var(--z-border)'
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} style={{ textAlign:'center', padding:32, color:'var(--z-hint)', fontSize:13 }}>{empty}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} style={{ cursor: row._onClick ? 'pointer' : 'default' }}
                  onClick={row._onClick}
                  onMouseEnter={e => e.currentTarget.style.background='#F7F6F2'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                {cols.map(c => (
                  <td key={c.key || c.label} style={{ padding:'9px 12px', borderBottom: i < rows.length-1 ? '0.5px solid var(--z-border)' : 'none', verticalAlign:'middle' }}>
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

/* ── Spinner ── */
export function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:48 }}>
      <div style={{
        width:24, height:24, border:'2px solid var(--z-border)',
        borderTop:'2px solid var(--z-green)', borderRadius:'50%',
        animation:'spin 0.8s linear infinite'
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ── Btn ── */
export function Btn({ children, onClick, variant = 'primary', small, disabled, style }) {
  const base = {
    border:'none', borderRadius:'var(--radius-md)', fontWeight:500,
    padding: small ? '6px 14px' : '9px 18px',
    fontSize: small ? 12 : 13, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, transition:'opacity 0.15s, background 0.15s',
    ...style
  }
  const variants = {
    primary:  { background:'var(--z-green)', color:'#fff' },
    ghost:    { background:'transparent', color:'var(--z-muted)', border:'0.5px solid var(--z-border)' },
    danger:   { background:'var(--z-danger)', color:'#fff' },
  }
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>
}

/* ── Input ── */
export function Input({ label, type='text', value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:'block', fontSize:12, color:'var(--z-muted)', marginBottom:4 }}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        style={{
          width:'100%', padding:'8px 12px', borderRadius:'var(--radius-sm)',
          border:'0.5px solid var(--z-border)', background:'#fff',
          fontSize:13, color:'var(--z-text)', outline:'none',
        }}
        onFocus={e => e.target.style.borderColor='var(--z-green)'}
        onBlur={e => e.target.style.borderColor='var(--z-border)'}
      />
    </div>
  )
}
