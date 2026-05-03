import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'

/* Esta página muestra una preview de la landing pública.
   La landing real vive en /public/index.html y se puede deployar por separado. */

export default function LandingPreview() {
  return (
    <Layout>
      <Topbar title="Landing pública" subtitle="Vista previa de la página de Zebrano" />
      <PageContent pad={0}>
        <div style={{ background:'var(--z-bg)', padding:24 }}>
          <div style={{ background:'#fff', border:'0.5px solid var(--z-border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            <LandingContent />
          </div>
        </div>
      </PageContent>
    </Layout>
  )
}

export function LandingContent() {
  const [form, setForm]       = useState({ nombre:'', telefono:'', tipo:'', mensaje:'' })
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('oportunidades').insert({
      nombre_prospecto: form.nombre,
      tipo_trabajo: form.tipo || 'custom',
      descripcion: `Tel: ${form.telefono} — ${form.mensaje}`,
      estado_funnel: 'lead',
      temperatura: 'tibio',
      origen: 'otro',
      fecha_ingreso: new Date().toISOString().slice(0,10),
    })
    setSent(true)
    setLoading(false)
  }

  const TRABAJOS = ['Cocina','Placard / Vestidor','Vanitory','Biblioteca','Dormitorio','Otro']

  return (
    <div style={{ fontFamily:'DM Sans, sans-serif' }}>
      {/* Hero */}
      <div style={{ background:'#1A1A18', color:'#fff', padding:'60px 48px 48px' }}>
        <div style={{ fontSize:13, letterSpacing:'0.15em', textTransform:'uppercase', color:'#1D9E75', marginBottom:12 }}>Carpintería a medida · CABA</div>
        <h1 style={{ fontSize:42, fontWeight:300, lineHeight:1.15, maxWidth:600, marginBottom:20 }}>
          Muebles que se adaptan<br/><em style={{ fontStyle:'italic', color:'#E1F5EE' }}>a tu espacio.</em>
        </h1>
        <p style={{ fontSize:15, color:'rgba(255,255,255,0.55)', maxWidth:480, lineHeight:1.7 }}>
          Diseñamos y fabricamos mobiliario premium a medida. Cocinas, placards, vestidores, vanitorios y más. Anticipo 50%, saldo contra entrega.
        </p>
        <div style={{ display:'flex', gap:12, marginTop:28 }}>
          <a href="#contacto" style={{ background:'#1D9E75', color:'#fff', padding:'11px 24px', borderRadius:8, fontSize:13, fontWeight:500, textDecoration:'none' }}>Pedir cotización</a>
          <a href="https://wa.me/5491130643696" target="_blank" rel="noreferrer" style={{ border:'1px solid rgba(255,255,255,0.2)', color:'#fff', padding:'11px 24px', borderRadius:8, fontSize:13, textDecoration:'none' }}>WhatsApp</a>
        </div>
      </div>

      {/* Servicios */}
      <div style={{ padding:'48px', borderBottom:'0.5px solid var(--z-border)' }}>
        <div style={{ fontSize:11, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:24 }}>Qué hacemos</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {[
            { icon:'▦', title:'Cocinas',       desc:'Bajomesadas, alacenas, torres. Melamina o laqueado.' },
            { icon:'◫', title:'Placards',      desc:'Interiores completos, frentes corredizos o a batir.' },
            { icon:'◎', title:'Vanitorios',    desc:'Muebles bajo mesada con cajones y estantes.' },
            { icon:'◈', title:'Bibliotecas',   desc:'Módulos a medida, estantes flotantes, cubos.' },
            { icon:'◉', title:'Dormitorios',   desc:'Camas con almacenamiento, mesas de luz, cómodas.' },
            { icon:'✦', title:'Proyectos completos', desc:'Integral de un ambiente, desde el diseño.' },
          ].map(s => (
            <div key={s.title} style={{ padding:'16px', border:'0.5px solid var(--z-border)', borderRadius:10 }}>
              <div style={{ fontSize:20, marginBottom:8 }}>{s.icon}</div>
              <div style={{ fontWeight:500, marginBottom:4 }}>{s.title}</div>
              <div style={{ fontSize:12, color:'var(--z-muted)', lineHeight:1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contacto */}
      <div id="contacto" style={{ padding:'48px' }}>
        <div style={{ fontSize:11, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Contacto</div>
        <h2 style={{ fontSize:24, fontWeight:400, marginBottom:24 }}>Pedí tu cotización</h2>

        {sent ? (
          <div style={{ background:'#E1F5EE', color:'#0F6E56', padding:'20px 24px', borderRadius:10, fontSize:14 }}>
            ✓ Recibimos tu consulta. Te contactamos en las próximas 24 horas.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth:500 }}>
            {[
              { label:'Nombre', key:'nombre', type:'text', placeholder:'Tu nombre' },
              { label:'Teléfono / WhatsApp', key:'telefono', type:'tel', placeholder:'+54 9 11...' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, color:'var(--z-muted)', marginBottom:4 }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm({...form, [f.key]:e.target.value})}
                  placeholder={f.placeholder} required
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'0.5px solid var(--z-border)', fontSize:13, outline:'none' }}
                />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, color:'var(--z-muted)', marginBottom:4 }}>Tipo de trabajo</label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo:e.target.value})}
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'0.5px solid var(--z-border)', fontSize:13, background:'#fff' }}>
                <option value="">Seleccioná...</option>
                {TRABAJOS.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:12, color:'var(--z-muted)', marginBottom:4 }}>Contanos qué necesitás</label>
              <textarea value={form.mensaje} onChange={e => setForm({...form, mensaje:e.target.value})}
                placeholder="Medidas aproximadas, ambiente, estilo..." rows={3}
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'0.5px solid var(--z-border)', fontSize:13, resize:'vertical', fontFamily:'inherit' }}
              />
            </div>
            <button type="submit" disabled={loading} style={{
              background:'#1D9E75', color:'#fff', border:'none', padding:'11px 28px',
              borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer'
            }}>
              {loading ? 'Enviando...' : 'Enviar consulta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
