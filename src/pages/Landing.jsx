
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'

export default function Landing() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [form, setForm] = useState({
    titulo: 'Muebles que se adaptan a tu espacio.',
    subtitulo: 'Diseñamos y fabricamos mobiliario premium a medida. Cocinas, placards, vestidores, vanitorios y más. Anticipo 50%, saldo contra entrega.',
    whatsapp: '',
    instagram: '',
    tiktok: '',
    ciudad: 'Buenos Aires, Argentina',
    activa: true,
  })

  useEffect(() => {
    const load = async () => {
      const { data: d } = await supabase.from('landing_config').select('*').limit(1).single()
      if (d) { setData(d); setForm(f => ({...f, ...d})) }
      setLoading(false)
    }
    load()
  }, [])

  const guardar = async () => {
    setSaving(true)
    if (data?.id) {
      await supabase.from('landing_config').update(form).eq('id', data.id)
    } else {
      await supabase.from('landing_config').insert(form)
    }
    setSaving(false)
    setMsg('Guardado ✓')
    setTimeout(() => setMsg(null), 3000)
  }

  const flash = (texto, tipo='ok') => { setMsg({texto,tipo}); setTimeout(()=>setMsg(null),3000); }

  const campos = [
    { key:'titulo', label:'Título principal', ph:'Muebles que se adaptan a tu espacio.' },
    { key:'subtitulo', label:'Subtítulo / descripción', ph:'Describí tu propuesta de valor', rows:3 },
    { key:'ciudad', label:'Ciudad', ph:'Buenos Aires, Argentina' },
    { key:'whatsapp', label:'WhatsApp (con código de país)', ph:'+541123456789' },
    { key:'instagram', label:'Instagram (@usuario)', ph:'@zebrano.ma' },
    { key:'tiktok', label:'TikTok (@usuario)', ph:'@zebrano.ma' },
  ]

  return (
    <Layout>
      <Topbar
        title="Landing pública"
        subtitle="Vista previa de la página de Zebrano"
        actions={
          <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : '💾 Guardar cambios'}
          </button>
        }
      />
      <PageContent>
        {msg && (
          <div style={{ padding:'10px 16px', borderRadius:8, marginBottom:16, fontSize:13, background:'rgba(74,222,128,0.08)', color:'var(--z-success)', border:'1px solid rgba(74,222,128,0.2)' }}>
            {typeof msg === 'string' ? msg : msg.texto}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, maxWidth:1100 }}>
          {/* Formulario */}
          <div>
            <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:3, height:16, borderRadius:2, background:'var(--z-primary)' }} />
              <span style={{ fontSize:11, fontWeight:600, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Configuración</span>
            </div>
            {loading ? (
              <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {campos.map(c => (
                  <div key={c.key}>
                    <label style={{ fontSize:11, color:'var(--z-text-3)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>{c.label}</label>
                    {c.rows
                      ? <textarea rows={c.rows} style={{ resize:'vertical', fontSize:14 }} value={form[c.key]||''} onChange={e=>setForm(f=>({...f,[c.key]:e.target.value}))} placeholder={c.ph} />
                      : <input style={{ fontSize:14 }} value={form[c.key]||''} onChange={e=>setForm(f=>({...f,[c.key]:e.target.value}))} placeholder={c.ph} />
                    }
                  </div>
                ))}
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0' }}>
                  <label style={{ fontSize:13, color:'var(--z-text-2)', flex:1 }}>Landing activa (visible públicamente)</label>
                  <div onClick={() => setForm(f=>({...f,activa:!f.activa}))} style={{ width:44,height:24,borderRadius:12,background:form.activa?'var(--z-primary)':'rgba(74,107,54,0.1)',border:`1px solid ${form.activa?'var(--z-primary)':'var(--z-border)'}`,cursor:'pointer',position:'relative',transition:'var(--z-transition)' }}>
                    <div style={{ position:'absolute',top:3,left:form.activa?22:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'var(--z-transition)' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:3, height:16, borderRadius:2, background:'var(--z-secondary)' }} />
              <span style={{ fontSize:11, fontWeight:600, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Vista previa</span>
            </div>
            <div style={{ background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', overflow:'hidden' }}>
              {/* Hero */}
              <div style={{ padding:'28px 24px', background:'linear-gradient(135deg, rgba(74,107,54,0.08) 0%, rgba(223,83,254,0.04) 100%)', borderBottom:'1px solid var(--z-border)' }}>
                <div style={{ fontSize:11, color:'var(--z-primary-light)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:10, fontWeight:600 }}>
                  CARPINTERÍA A MEDIDA · {form.ciudad}
                </div>
                <h2 style={{ fontSize:22, fontWeight:700, color:'var(--z-text)', marginBottom:10, lineHeight:1.3 }}>{form.titulo}</h2>
                <p style={{ fontSize:13, color:'var(--z-text-2)', lineHeight:1.6, marginBottom:18, maxWidth:400 }}>{form.subtitulo}</p>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-primary btn-sm">Pedir cotización</button>
                  {form.whatsapp && <button className="btn btn-ghost btn-sm">💬 WhatsApp</button>}
                </div>
              </div>

              {/* Servicios */}
              <div style={{ padding:'20px 24px' }}>
                <div style={{ fontSize:11, color:'var(--z-text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14, fontWeight:600 }}>QUÉ HACEMOS</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  {[
                    { icon:'🍳', name:'Cocinas', desc:'Equipadas, abiertas, lineal, moderno y laqueado' },
                    { icon:'🚪', name:'Placards', desc:'Abatibles, corredizas, Frentes a medida' },
                    { icon:'🛁', name:'Vanitorios', desc:'Muebles bajo mesada con sobre y bacha' },
                    { icon:'📚', name:'Bibliotecas', desc:'Módulos a medida, infinite batiente, cubos' },
                    { icon:'🛋️', name:'Dormitorios', desc:'Cajones con amortiguador, tornés de luz, chifonier' },
                    { icon:'✨', name:'Proyectos llave', desc:'Integral de tu espacio, todas las áreas' },
                  ].map(s => (
                    <div key={s.name} style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius)', padding:'12px 10px' }}>
                      <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--z-text)', marginBottom:3 }}>{s.name}</div>
                      <div style={{ fontSize:10, color:'var(--z-text-3)', lineHeight:1.4 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA contacto */}
              <div style={{ padding:'16px 24px', borderTop:'1px solid var(--z-border)', background:'rgba(74,107,54,0.04)' }}>
                <div style={{ fontSize:11, color:'var(--z-text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8, fontWeight:600 }}>CONTACTO</div>
                <p style={{ fontSize:13, color:'var(--z-text-2)', marginBottom:12 }}>Pedí tu cotización sin compromiso</p>
                <div style={{ display:'flex', gap:8, fontSize:12, color:'var(--z-text-3)' }}>
                  {form.whatsapp && <span>📱 {form.whatsapp}</span>}
                  {form.instagram && <span>📸 {form.instagram}</span>}
                  {form.tiktok && <span>🎵 {form.tiktok}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContent>
    </Layout>
  )
}
