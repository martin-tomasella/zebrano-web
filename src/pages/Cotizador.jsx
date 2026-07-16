
import React, { useState, useRef, useEffect } from 'react'
import { supabase, N8N_COTIZADOR } from '../lib/supabase'
import { Layout, Topbar } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'

const MENSAJE_INICIAL = { role:'assistant', text:'Hola, soy el cotizador de Zebrano. Contame qué necesita el cliente — tipo de mueble, medidas, material — y te armo la cotización.' }

export default function Cotizador() {
  const { user } = useAuth()
  const [messages, setMessages]   = useState([MENSAJE_INICIAL])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const [sesionId, setSesionId]   = useState(null)
  const [sesiones, setSesiones]   = useState([])
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])
  useEffect(() => { loadSesiones() }, [])

  async function loadSesiones() {
    const { data } = await supabase
      .from('cotizacion_sesiones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setSesiones(data || [])
  }

  // Etiqueta de la sesion en el sidebar: nombre del cliente si la IA lo capturo,
  // si no el tipo de trabajo, y como ultimo recurso un identificador corto + fecha.
  // Antes siempre decia "Sin nombre" para casi todas las sesiones porque el nombre
  // del cliente solo se guarda si aparece explicitamente en la conversacion.
  function etiquetaSesion(s) {
    if (s.cliente_nombre) return s.cliente_nombre
    if (s.tipo_trabajo) return `${s.tipo_trabajo} · ${s.id.slice(0,8)}`
    return `Sesión ${s.id.slice(0,8)}`
  }

  // Carga los mensajes reales de una sesion pasada. Antes, hacer click en el
  // historial solo guardaba el sesionId pero nunca traia los mensajes, asi que
  // el chat se quedaba con lo que hubiera en pantalla (parecia que se "perdia"
  // el historico al navegar).
  async function loadMensajes(id) {
    setLoadingHist(true)
    const { data, error } = await supabase
      .from('cotizacion_mensajes')
      .select('rol, contenido, imagenes, created_at')
      .eq('sesion_id', id)
      .order('created_at', { ascending: true })
    if (error) console.error('Error cargando mensajes de la sesion:', error)
    if (data && data.length > 0) {
      setMessages(data.map(m => ({
        role: m.rol === 'user' ? 'user' : 'assistant',
        text: m.contenido || '(sin texto)',
      })))
    } else {
      setMessages([{ role:'assistant', text:'Esta sesión todavía no tiene mensajes.' }])
    }
    setLoadingHist(false)
  }

  function seleccionarSesion(id) {
    if (id === sesionId) return
    setSesionId(id)
    loadMensajes(id)
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
      } else if (newSesionId === sesionId) {
        loadSesiones()
      }
      setMessages(m => [...m, { role:'assistant', text: reply }])
    } catch (e) {
      setMessages(m => [...m, { role:'assistant', text:'❌ Error al conectar con el agente. Verificá que n8n esté activo.', error: true }])
    }
    setLoading(false)
  }

  function nuevaSesion() {
    setSesionId(null)
    setMessages([{ role:'assistant', text:'Nueva sesión iniciada. ¿Qué necesita cotizar el cliente?' }])
  }

  return (
    <Layout>
      <Topbar title="Cotizador AI" subtitle="Agente Zebrano · conectado a n8n" actions={
        <button onClick={nuevaSesion} style={{
          padding:'6px 14px', borderRadius:'var(--radius-md)', fontSize:12,
          background:'transparent', border:'0.5px solid var(--z-border)', cursor:'pointer', color:'var(--z-muted)'
        }}>+ Nueva sesión</button>
      } />

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Historial de sesiones */}
        <div style={{ width:200, borderRight:'0.5px solid var(--z-border)', overflowY:'auto', padding:'12px 0', background:'#fff' }}>
          <div style={{ padding:'0 12px 8px', fontSize:10, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Sesiones recientes</div>
          {sesiones.length === 0 && <div style={{ padding:'0 12px', fontSize:12, color:'var(--z-hint)' }}>Sin historial</div>}
          {sesiones.map(s => (
            <div key={s.id} onClick={() => seleccionarSesion(s.id)} style={{
              padding:'8px 12px', cursor:'pointer', fontSize:12,
              background: sesionId===s.id ? 'var(--z-green-lt)' : 'transparent',
              color: sesionId===s.id ? 'var(--z-green-dk)' : 'var(--z-muted)',
              borderLeft: sesionId===s.id ? '2px solid var(--z-green)' : '2px solid transparent',
            }}>
              <div style={{ fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textTransform:'capitalize' }}>
                {etiquetaSesion(s)}
              </div>
              <div style={{ fontSize:11, color:'var(--z-hint)', marginTop:1, display:'flex', justifyContent:'space-between', gap:6 }}>
                <span>{new Date(s.created_at).toLocaleDateString('es-AR')}</span>
                {s.estado==='aprobada' && <span title="Cotización aprobada">✓</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Chat */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
            {loadingHist && (
              <div style={{ textAlign:'center', fontSize:12, color:'var(--z-hint)' }}>Cargando historial...</div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', gap:10, flexDirection: m.role==='user' ? 'row-reverse' : 'row', alignItems:'flex-start' }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:500,
                  background: m.role==='user' ? '#B5D4F4' : '#E1F5EE',
                  color: m.role==='user' ? '#185FA5' : '#0F6E56',
                }}>
                  {m.role==='user' ? 'MN' : 'ZB'}
                </div>
                <div style={{
                  maxWidth:'72%', padding:'10px 14px', borderRadius:12, fontSize:13, lineHeight:1.6,
                  background: m.role==='user' ? '#1D9E75' : '#F7F6F2',
                  color: m.role==='user' ? '#fff' : m.error ? '#A32D2D' : 'var(--z-text)',
                  borderRadius: m.role==='user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  whiteSpace:'pre-wrap',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'#E1F5EE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'#0F6E56' }}>ZB</div>
                <div style={{ padding:'12px 16px', background:'#F7F6F2', borderRadius:'4px 12px 12px 12px' }}>
                  <div style={{ display:'flex', gap:4 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--z-hint)', animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
                  </div>
                  <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ padding:'12px 24px', borderTop:'0.5px solid var(--z-border)', background:'#fff', display:'flex', gap:10 }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ej: placard 3 cuerpos melamina blanco, 2,40m de frente, 2m alto..."
              rows={2}
              style={{
                flex:1, resize:'none', border:'0.5px solid var(--z-border)', borderRadius:'var(--radius-md)',
                padding:'8px 12px', fontSize:13, color:'var(--z-text)', background:'#fff', fontFamily:'inherit', outline:'none'
              }}
              onFocus={e => e.target.style.borderColor='var(--z-green)'}
              onBlur={e  => e.target.style.borderColor='var(--z-border)'}
            />
            <button onClick={send} disabled={loading || !input.trim()} style={{
              padding:'0 20px', background:'var(--z-green)', color:'#fff',
              border:'none', borderRadius:'var(--radius-md)', fontSize:13, fontWeight:500,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1
            }}>Enviar</button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
