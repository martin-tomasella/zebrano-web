
import React, { useState, useRef, useEffect } from 'react'
import { supabase, N8N_COTIZADOR } from '../lib/supabase'
import { Layout, Topbar } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'

const MENSAJE_INICIAL = { role:'assistant', text:'Hola, soy el cotizador de Zebrano. Contame qué necesita el cliente — tipo de mueble, medidas, material — y te armo la cotización.' }

const ETAPAS = [
  { key:'diseno',     label:'Diseño' },
  { key:'render',     label:'Render' },
  { key:'cotizacion', label:'Cotización' },
  { key:'aprobado',   label:'Aprobado' },
]

// Mapea el estado real de cotizacion_sesiones a un indice de etapa (0-3) para el
// stepper visual. No agrega estados nuevos en la base, solo interpreta lo existente.
function etapaActual(estado) {
  if (estado === 'aprobada') return 3
  if (estado === 'borrador') return 2
  return 0
}

export default function Cotizador() {
  const { user } = useAuth()
  const [messages, setMessages]   = useState([MENSAJE_INICIAL])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const [sesionId, setSesionId]   = useState(null)
  const [sesiones, setSesiones]   = useState([])
  const [diseno, setDiseno]       = useState(null)
  const [resumen, setResumen]     = useState(null)
  const [aprobando, setAprobando] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])
  useEffect(() => { loadSesiones() }, [])

  async function loadSesiones() {
    const { data, error } = await supabase
      .from('cotizacion_sesiones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) console.error('Error cargando sesiones:', error)
    setSesiones(data || [])
  }

  // Etiqueta de la sesion en el sidebar: nombre del cliente si la IA lo capturo,
  // si no el tipo de trabajo, y como ultimo recurso un identificador corto.
  function etiquetaSesion(s) {
    if (s.cliente_nombre) return s.cliente_nombre
    if (s.tipo_trabajo) return `${s.tipo_trabajo} · ${s.id.slice(0,8)}`
    return `Sesión ${s.id.slice(0,8)}`
  }

  // Carga los mensajes reales de una sesion pasada desde cotizacion_mensajes.
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

  async function cargarEstadoCotizacion(id) {
    const [{ data: d }, { data: r }] = await Promise.all([
      supabase.from('cotizacion_diseno').select('*').eq('sesion_id', id).maybeSingle(),
      supabase.from('cotizacion_resumen').select('*').eq('sesion_id', id).maybeSingle(),
    ])
    setDiseno(d || null)
    setResumen(r || null)
  }

  function seleccionarSesion(id) {
    if (id === sesionId) return
    setSesionId(id)
    loadMensajes(id)
    cargarEstadoCotizacion(id)
  }

  async function aprobarDiseno() {
    if (!sesionId || aprobando) return
    setAprobando(true)
    try {
      const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/zebrano-cotizador`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id: sesionId, aprobar_svg: true }),
      })
      const data = await res.json()
      if (!data.ok) { alert('No se pudo aprobar el diseño: ' + (data.error || 'error desconocido')); return }
      setMessages(m => [...m, { role: 'assistant', text: data.respuesta || 'Diseño aprobado.' }])
      await cargarEstadoCotizacion(sesionId)
    } catch (e) {
      alert('Error de conexión al aprobar el diseño.')
    } finally {
      setAprobando(false)
    }
  }

  async function aprobarCotizacionFinal() {
    if (!sesionId || aprobando) return
    if (!window.confirm('¿Aprobar esta cotización y crear el proyecto / orden de trabajo?')) return
    setAprobando(true)
    try {
      const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/zebrano-cotizador`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id: sesionId, aprobar_cotizacion: true }),
      })
      const data = await res.json()
      if (!data.ok) { alert('No se pudo aprobar la cotización: ' + (data.error || 'error desconocido')); return }
      setMessages(m => [...m, { role: 'assistant', text: data.respuesta || 'Cotización aprobada.' }])
      await loadSesiones()
      await cargarEstadoCotizacion(sesionId)
    } catch (e) {
      alert('Error de conexión al aprobar la cotización.')
    } finally {
      setAprobando(false)
    }
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
        cargarEstadoCotizacion(newSesionId)
      } else if (newSesionId === sesionId) {
        loadSesiones()
        cargarEstadoCotizacion(newSesionId)
      }
      setMessages(m => [...m, { role:'assistant', text: reply }])
    } catch (e) {
      setMessages(m => [...m, { role:'assistant', text:'❌ Error al conectar con el agente. Verificá que n8n esté activo.', error: true }])
    }
    setLoading(false)
  }

  function nuevaSesion() {
    setSesionId(null)
    setDiseno(null)
    setResumen(null)
    setMessages([{ role:'assistant', text:'Nueva sesión iniciada. ¿Qué necesita cotizar el cliente?' }])
  }

  const sesionActiva = sesiones.find(s => s.id === sesionId)
  const etapa = sesionActiva ? etapaActual(sesionActiva.estado) : null

  return (
    <Layout>
      <Topbar title="Cotizador AI" subtitle="Agente Zebrano · conectado a n8n" actions={
        <button className="btn btn-ghost btn-sm" onClick={nuevaSesion}>+ Nueva sesión</button>
      } />

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Historial de sesiones */}
        <div style={{ width:232, borderRight:'1px solid var(--z-border)', overflowY:'auto', padding:'16px 12px', background:'var(--z-sidebar-bg)', flexShrink:0 }}>
          <div style={{ padding:'0 4px 10px', fontSize:11, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>
            Sesiones recientes
          </div>
          {sesiones.length === 0 && (
            <div style={{ padding:'12px', fontSize:12.5, color:'var(--z-text-muted)' }}>Todavía no hay cotizaciones.</div>
          )}
          {sesiones.map(s => {
            const activa = sesionId === s.id
            return (
              <div key={s.id} onClick={() => seleccionarSesion(s.id)} style={{
                padding:'10px 12px', marginBottom:4, borderRadius:'var(--radius-md)', cursor:'pointer',
                background: activa ? 'var(--z-primary-glow)' : 'transparent',
                border: activa ? '1px solid rgba(74,107,54,0.3)' : '1px solid transparent',
                transition:'var(--z-transition)',
              }}
              onMouseEnter={e => { if(!activa) e.currentTarget.style.background = 'var(--z-card-hover)' }}
              onMouseLeave={e => { if(!activa) e.currentTarget.style.background = 'transparent' }}
              >
                <div className="truncate" style={{
                  fontSize:13, fontWeight:500, textTransform:'capitalize',
                  color: activa ? 'var(--z-primary-light)' : 'var(--z-text-2)',
                }}>
                  {etiquetaSesion(s)}
                </div>
                <div style={{ fontSize:11, color:'var(--z-text-muted)', marginTop:3, display:'flex', justifyContent:'space-between', gap:6 }}>
                  <span>{new Date(s.created_at).toLocaleDateString('es-AR')}</span>
                  {s.estado==='aprobada' && <span className="badge badge-success" style={{ padding:'1px 7px', fontSize:10 }}>✓ Aprobada</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Chat */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {sesionActiva && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 24px', borderBottom:'1px solid var(--z-border)' }}>
              {ETAPAS.map((e, i) => (
                <React.Fragment key={e.key}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{
                      width:18, height:18, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontWeight:600,
                      background: i <= etapa ? 'var(--z-primary)' : 'var(--z-bg-2)',
                      color: i <= etapa ? '#E8DFD0' : 'var(--z-text-muted)',
                      border: i <= etapa ? 'none' : '1px solid var(--z-border)',
                    }}>{i+1}</div>
                    <span style={{ fontSize:12, color: i <= etapa ? 'var(--z-text)' : 'var(--z-text-muted)', fontWeight: i===etapa ? 600 : 400 }}>
                      {e.label}
                    </span>
                  </div>
                  {i < ETAPAS.length-1 && <div style={{ flex:1, height:1, background: i < etapa ? 'var(--z-primary)' : 'var(--z-border)', maxWidth:40 }} />}
                </React.Fragment>
              ))}
            </div>
          )}

          {sesionId && (diseno?.svg_tecnico || resumen?.precio_sugerido > 0) && (
            <div style={{ padding:'12px 24px', borderBottom:'1px solid var(--z-border)', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
              {diseno?.svg_tecnico && (
                <a href={diseno.svg_tecnico} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--z-primary-light)' }}>Ver plano técnico</a>
              )}
              {diseno?.render_fotorrealista_url && (
                <a href={diseno.render_fotorrealista_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--z-primary-light)' }}>Ver render</a>
              )}
              {diseno?.svg_tecnico && !diseno?.svg_aprobado && (
                <button className="btn btn-primary btn-sm" onClick={aprobarDiseno} disabled={aprobando}>
                  {aprobando ? 'Procesando...' : 'Aprobar diseño y generar render'}
                </button>
              )}
              {resumen?.precio_sugerido > 0 && sesionActiva?.estado !== 'aprobada' && (
                <button className="btn btn-primary btn-sm" onClick={aprobarCotizacionFinal} disabled={aprobando}>
                  {aprobando ? 'Procesando...' : `Aprobar cotización ($${Math.round(resumen.precio_sugerido).toLocaleString('es-AR')}) → crear proyecto`}
                </button>
              )}
              {sesionActiva?.estado === 'aprobada' && (
                <span className="badge badge-success" style={{ fontSize:11 }}>✓ Cotización aprobada — proyecto creado</span>
              )}
            </div>
          )}

          <div style={{ flex:1, overflowY:'auto', padding:'22px 28px', display:'flex', flexDirection:'column', gap:16 }}>
            {loadingHist && (
              <div style={{ textAlign:'center', fontSize:12.5, color:'var(--z-text-muted)' }}>Cargando historial...</div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', gap:10, flexDirection: m.role==='user' ? 'row-reverse' : 'row', alignItems:'flex-start' }}>
                <div style={{
                  width:30, height:30, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:600,
                  background: m.role==='user' ? 'rgba(176,123,48,0.16)' : 'var(--z-primary-glow)',
                  color: m.role==='user' ? 'var(--z-secondary-light)' : 'var(--z-primary-light)',
                  border: m.role==='user' ? '1px solid rgba(176,123,48,0.3)' : '1px solid rgba(74,107,54,0.3)',
                }}>
                  {m.role==='user' ? 'MT' : 'ZB'}
                </div>
                <div style={{
                  maxWidth:'70%', padding:'11px 15px', fontSize:13.5, lineHeight:1.65,
                  background: m.role==='user' ? 'var(--z-primary)' : 'var(--z-card)',
                  color: m.role==='user' ? '#F2EEE4' : (m.error ? 'var(--z-error)' : 'var(--z-text)'),
                  border: m.role==='user' ? 'none' : '1px solid var(--z-border)',
                  borderRadius: m.role==='user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  whiteSpace:'pre-wrap',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--z-primary-glow)', border:'1px solid rgba(74,107,54,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'var(--z-primary-light)' }}>ZB</div>
                <div style={{ padding:'12px 16px', background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'4px 14px 14px 14px' }}>
                  <div style={{ display:'flex', gap:4 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--z-text-muted)', animation:`zbBounce 1.2s ${i*0.2}s infinite` }} />)}
                  </div>
                  <style>{`@keyframes zbBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ padding:'14px 24px', borderTop:'1px solid var(--z-border)', display:'flex', gap:10, alignItems:'flex-end' }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ej: placard 3 cuerpos melamina blanco, 2,40m de frente, 2m alto..."
              rows={2}
              style={{ flex:1, resize:'none' }}
            />
            <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
