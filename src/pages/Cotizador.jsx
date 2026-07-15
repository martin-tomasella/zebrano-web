import React, { useState, useRef, useEffect } from 'react'
import { supabase, N8N_COTIZADOR } from '../lib/supabase'
import { Layout, Topbar } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'

export default function Cotizador() {
  const { user } = useAuth()
  const [messages, setMessages]   = useState([
    { role:'assistant', text:'Hola, soy el cotizador de Zebrano. Contame qué necesita el cliente — tipo de mueble, medidas, material — y te armo la cotización.' }
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [sesionId, setSesionId]   = useState(null)
  const [sesiones, setSesiones]   = useState([])
  const [diseno, setDiseno]       = useState(null)
  const [resumen, setResumen]     = useState(null)
  const [sesionEstado, setSesionEstado] = useState(null)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])
  useEffect(() => { loadSesiones() }, [])
  useEffect(() => { cargarEstado(sesionId) }, [sesionId])

  async function loadSesiones() {
    const { data } = await supabase
      .from('cotizacion_sesiones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setSesiones(data || [])
  }

  async function cargarEstado(sid) {
    if (!sid) { setDiseno(null); setResumen(null); setSesionEstado(null); return }
    const [{ data: d }, { data: r }, { data: s }] = await Promise.all([
      supabase.from('cotizacion_diseno').select('*').eq('sesion_id', sid).maybeSingle(),
      supabase.from('cotizacion_resumen').select('*').eq('sesion_id', sid).maybeSingle(),
      supabase.from('cotizacion_sesiones').select('estado').eq('id', sid).maybeSingle(),
    ])
    setDiseno(d || null)
    setResumen(r || null)
    setSesionEstado(s?.estado || null)
  }

  async function send() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setMessages(m => [...m, { role:'user', text }])
    setLoading(true)

    try {
      const body = { mensaje: text, sesion_id: sesionId, user_id: user?.id }
      const res  = await fetch(N8N_COTIZADOR, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
      })
      const data = await res.json()
      const reply = data.respuesta || data.mensaje || data.output || data.text || 'Sin respuesta del agente.'
      const newSesionId = data.sesion_id || sesionId
      if (newSesionId && newSesionId !== sesionId) {
        setSesionId(newSesionId)
        loadSesiones()
      }
      setMessages(m => [...m, { role:'assistant', text: reply }])
      if (newSesionId) await cargarEstado(newSesionId)
    } catch (e) {
      setMessages(m => [...m, { role:'assistant', text:'❌ Error al conectar con el agente. Verificá que n8n esté activo.', error: true }])
    }
    setLoading(false)
  }

  async function aprobarDiseno() {
    if (!sesionId || loading) return
    setLoading(true)
    try {
      const res = await fetch(N8N_COTIZADOR, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sesion_id: sesionId, aprobar_svg: true })
      })
      const data = await res.json()
      setMessages(m => [...m, { role:'assistant', text: data.respuesta || 'Render generado.', error: data.ok === false }])
      await cargarEstado(sesionId)
    } catch (e) {
      setMessages(m => [...m, { role:'assistant', text:'❌ Error al aprobar el diseño.', error: true }])
    }
    setLoading(false)
  }

  async function aprobarCotizacion() {
    if (!sesionId || loading) return
    setLoading(true)
    try {
      const res = await fetch(N8N_COTIZADOR, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sesion_id: sesionId, aprobar_cotizacion: true })
      })
      const data = await res.json()
      setMessages(m => [...m, { role:'assistant', text: data.respuesta || data.error || 'Cotización aprobada.', error: data.ok === false }])
      await cargarEstado(sesionId)
      loadSesiones()
    } catch (e) {
      setMessages(m => [...m, { role:'assistant', text:'❌ Error al aprobar la cotización.', error: true }])
    }
    setLoading(false)
  }

  function nuevaSesion() {
    setSesionId(null)
    setDiseno(null)
    setResumen(null)
    setSesionEstado(null)
    setMessages([{ role:'assistant', text:'Nueva sesión iniciada. ¿Qué necesita cotizar el cliente?' }])
  }

  return (
    <Layout>
      <Topbar title="Cotizador AI" subtitle="Agente Zebrano · conectado a n8n" actions={
        <button className="btn btn-ghost btn-sm" onClick={nuevaSesion}>+ Nueva sesión</button>
      } />

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Historial de sesiones */}
        <div style={{ width:200, borderRight:'1px solid var(--z-border)', overflowY:'auto', padding:'12px 0', background:'var(--z-sidebar-bg)' }}>
          <div style={{ padding:'0 12px 8px', fontSize:10, color:'var(--z-text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Sesiones recientes</div>
          {sesiones.length === 0 && <div style={{ padding:'0 12px', fontSize:12, color:'var(--z-text-muted)' }}>Sin historial</div>}
          {sesiones.map(s => (
            <div key={s.id} onClick={() => setSesionId(s.id)} style={{
              padding:'8px 12px', cursor:'pointer', fontSize:12,
              background: sesionId===s.id ? 'rgba(74,107,54,0.18)' : 'transparent',
              color: sesionId===s.id ? 'var(--z-text)' : 'var(--z-text-2)',
              borderLeft: sesionId===s.id ? '2px solid #7AAE5A' : '2px solid transparent',
            }}>
              <div style={{ fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {s.cliente_nombre || 'Sin nombre'}
              </div>
              <div style={{ fontSize:11, color:'var(--z-text-muted)', marginTop:1 }}>
                {new Date(s.created_at).toLocaleDateString('es-AR')}
              </div>
            </div>
          ))}
        </div>

        {/* Chat */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', gap:10, flexDirection: m.role==='user' ? 'row-reverse' : 'row', alignItems:'flex-start' }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:600,
                  background: m.role==='user' ? 'rgba(99,102,241,0.15)' : 'rgba(74,107,54,0.18)',
                  color: m.role==='user' ? '#a5b4fc' : '#7AAE5A',
                  border: m.role==='user' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(74,107,54,0.35)',
                }}>
                  {m.role==='user' ? 'MN' : 'ZB'}
                </div>
                <div style={{
                  maxWidth:'72%', padding:'10px 14px', borderRadius: m.role==='user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap',
                  background: m.role==='user' ? 'rgba(74,107,54,0.22)' : 'var(--z-card)',
                  border: '1px solid ' + (m.error ? 'rgba(160,64,42,0.4)' : 'var(--z-border)'),
                  color: m.error ? 'var(--z-error)' : 'var(--z-text)',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(74,107,54,0.18)', border:'1px solid rgba(74,107,54,0.35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'#7AAE5A' }}>ZB</div>
                <div style={{ padding:'12px 16px', background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'4px 12px 12px 12px' }}>
                  <div style={{ display:'flex', gap:4 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--z-text-muted)', animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
                  </div>
                  <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Panel de estado: plano, render y cotizacion con acciones de aprobacion */}
          {diseno && (diseno.svg_tecnico || diseno.render_fotorrealista_url || (resumen && resumen.precio_sugerido > 0) || sesionEstado === 'aprobada') && (
            <div style={{ margin:'0 24px 14px', padding:'14px 16px', background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:8, display:'flex', flexDirection:'column', gap:12 }}>
              {diseno.svg_tecnico && (
                <div>
                  <div style={{ fontSize:11, color:'var(--z-text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Plano técnico</div>
                  <div style={{ background:'#fff', borderRadius:6, padding:8, maxWidth:420, overflow:'hidden' }} dangerouslySetInnerHTML={{ __html: diseno.svg_tecnico }} />
                  {!diseno.svg_aprobado && (
                    <button className="btn btn-primary" style={{ marginTop:8 }} onClick={aprobarDiseno} disabled={loading}>
                      Aprobar diseño y generar render
                    </button>
                  )}
                </div>
              )}

              {diseno.render_fotorrealista_url && (
                <div>
                  <div style={{ fontSize:11, color:'var(--z-text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Render fotorrealista</div>
                  <img src={diseno.render_fotorrealista_url} alt="Render" style={{ maxWidth:420, width:'100%', borderRadius:6, border:'1px solid var(--z-border)' }} />
                </div>
              )}

              {resumen && Number(resumen.precio_sugerido) > 0 && sesionEstado !== 'aprobada' && (
                <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <div style={{ fontSize:15, fontWeight:600, color:'var(--z-text)' }}>
                    Precio sugerido: ${Number(resumen.precio_sugerido).toLocaleString('es-AR')}
                  </div>
                  <button className="btn btn-primary" onClick={aprobarCotizacion} disabled={loading}>
                    Aprobar cotización y crear OT
                  </button>
                </div>
              )}

              {sesionEstado === 'aprobada' && (
                <div style={{ fontSize:13, color:'#7AAE5A', fontWeight:600 }}>
                  ✓ Cotización aprobada — orden de trabajo creada.
                </div>
              )}
            </div>
          )}

          <div style={{ padding:'12px 24px', borderTop:'1px solid var(--z-border)', background:'var(--z-sidebar-bg)', display:'flex', gap:10 }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ej: placard 3 cuerpos melamina blanco, 2,40m de frente, 2m alto..."
              rows={2}
              style={{ flex:1, resize:'none', fontSize:13 }}
            />
            <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>Enviar</button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
