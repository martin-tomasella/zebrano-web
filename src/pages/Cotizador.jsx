
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
const Vista3D = React.lazy(() => import('../components/Vista3D'))
import { supabase } from '../lib/supabase'
import { authFetch as fetch } from '../lib/authFetch'
import { Layout, Topbar } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'

const MENSAJE_INICIAL = { role:'assistant', text:'Hola, soy el cotizador de Zebrano. Contame qué necesita el cliente — tipo de mueble, medidas, material — o adjuntá fotos, un PDF o un plano, y te armo diseño, render, cotización y despiece.' }
const FN_COTIZADOR = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/zebrano-cotizador`
const MAX_LADO = 1600

// Imagen → JPEG base64 reducido (para no mandar fotos de 10 MB al modelo)
export function imagenAJpeg(src) {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, MAX_LADO / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height)
      ok(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => mal(new Error('No se pudo leer la imagen'))
    img.src = src
  })
}
// PDF / plano → una imagen por página (hasta 4) con pdf.js
// Gira 90° en sentido horario una imagen (data URL).
export function girar(src) {
  return new Promise(ok => {
    const img = new Image()
    img.onload = () => { const c = document.createElement('canvas'); c.width = img.height; c.height = img.width; const x = c.getContext('2d'); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(img, 0, 0); ok(c.toDataURL('image/jpeg', 0.85)) }
    img.src = src
  })
}

export async function pdfAJpegs(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf')
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const out = []
  for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
    const page = await doc.getPage(i)
    const v0 = page.getViewport({ scale: 1 })
    // Los planos traen cotas chicas: los PDF se renderizan más grandes que las fotos.
    const vp = page.getViewport({ scale: 2200 / Math.max(v0.width, v0.height) })
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    out.push(c.toDataURL('image/jpeg', 0.85))
  }
  return out
}

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
  const [estadoFactura, setEstadoFactura] = useState(null)
  const [messages, setMessages]   = useState([MENSAJE_INICIAL])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const [sesionId, setSesionId]   = useState(null)
  const [sesiones, setSesiones]   = useState([])
  const [diseno, setDiseno]       = useState(null)
  const [resumen, setResumen]     = useState(null)
  const [aprobando, setAprobando] = useState(false)
  const [adjuntos, setAdjuntos] = useState([]) // [{ nombre, dataUrl }]
  const [leyendo, setLeyendo] = useState(false)
  const [vistaKey, setVistaKey] = useState(null)
  const [ampliar, setAmpliar] = useState(null)
  const visor3d = useRef(null)
  const fileRef = useRef(null)
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
        imgs: (m.imagenes || []).filter(u => typeof u === 'string' && !u.startsWith('data:')),
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

  // Presupuesto y hoja de taller viven en el bucket privado "documentos": se abren con un link firmado de 10 minutos.
  async function abrirDoc(path) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 600)
    if (error || !data?.signedUrl) { alert('No se pudo abrir el documento.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
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
        body: JSON.stringify({ sesion_id: sesionId, aprobar_svg: true, base_3d: visor3d.current?.captura() || undefined }),
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

  async function agregarArchivos(files) {
    setLeyendo(true)
    const nuevos = []
    for (const f of Array.from(files || [])) {
      try {
        if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
          const pags = await pdfAJpegs(f)
          pags.forEach((dataUrl, i) => nuevos.push({ nombre: `${f.name} · pág. ${i + 1}`, dataUrl }))
        } else if (f.type.startsWith('image/')) {
          nuevos.push({ nombre: f.name, dataUrl: await imagenAJpeg(URL.createObjectURL(f)) })
        } else {
          setMessages(m => [...m, { role:'assistant', text:`No puedo leer "${f.name}". Subí fotos (JPG/PNG) o PDF. Un plano .dwg exportalo a PDF primero.`, error:true }])
        }
      } catch (e) { setMessages(m => [...m, { role:'assistant', text:`No pude leer "${f.name}": ${e.message}`, error:true }]) }
    }
    setAdjuntos(a => [...a, ...nuevos].slice(0, 6))
    setLeyendo(false)
  }

  async function send() {
    if ((!input.trim() && adjuntos.length === 0) || loading) return
    const text = input.trim() || 'Te adjunto el material del cliente: interpretalo, armá el diseño y cotizá.'
    const imgs = adjuntos.map(a => a.dataUrl)
    setInput(''); setAdjuntos([])
    setMessages(m => [...m, { role:'user', text, imgs }])
    setLoading(true)

    try {
      const body = { mensaje: text, sesion_id: sesionId, user_id: user?.id, imagenes_base64: imgs.map(u => u.split(',')[1]) }
      const res  = await fetch(FN_COTIZADOR, {
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
      setMessages(m => [...m, { role:'assistant', text:'❌ Error al conectar con el agente. Probá de nuevo en un momento.', error: true }])
    }
    setLoading(false)
  }

  function nuevaSesion() {
    setSesionId(null)
    setDiseno(null)
    setResumen(null)
    setMessages([{ role:'assistant', text:'Nueva sesión iniciada. ¿Qué necesita cotizar el cliente?' }])
  }

  // Facturas de compra desde el cotizador: mismo circuito que Compras (Storage privado + lectura con zebrano-facturas).
  // Quedan "por revisar" en Compras; al confirmarlas, sus precios pasan a ser los vigentes para cotizar.
  async function subirFacturas(files) {
    files = [...(files || [])]; if (!files.length) return
    let ok = 0; const errores = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setEstadoFactura(`Leyendo factura ${i + 1} de ${files.length}…`)
      const path = `erp/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`
      const { error: eUp } = await supabase.storage.from('facturas').upload(path, file, { contentType: file.type })
      if (eUp) { errores.push(`${file.name}: ${eUp.message}`); continue }
      const { data, error } = await supabase.functions.invoke('zebrano-facturas', { body: { archivo_path: path } })
      if (error || !data?.ok) errores.push(`${file.name}: ${data?.error || error?.message}`); else ok++
    }
    setEstadoFactura(errores.length ? `Error: ${errores.join(' · ')}` : `${ok} factura(s) leída(s): revisalas y confirmalas en Compras para actualizar precios.`)
  }

  const sesionActiva = sesiones.find(s => s.id === sesionId)
  const etapa = sesionActiva ? etapaActual(sesionActiva.estado) : null

  // Lo que se muestra en el panel: render, plano técnico y el último plano o foto que subió el usuario.
  const renderUrl = diseno?.render_fotorrealista_url || resumen?.render_url
  const subidos = [...messages].reverse().find(m => m.role === 'user' && m.imgs?.length)?.imgs || []
  // Diseño estructurado (módulos con puertas, cajones y estantes): se puede ver en 3D y el render parte de esa vista.
  const mods3d = (diseno?.modulos || []).filter(m => m && m.puertas !== undefined && +m.ancho_mm > 0)
  const vistas = !sesionId ? [] : [
    mods3d.length > 0 && { key: '3d', label: '3D' },
    renderUrl && { key: 'render', label: 'Render', src: renderUrl },
    diseno?.svg_tecnico && { key: 'plano', label: 'Plano técnico', src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diseno.svg_tecnico)}`, blanco: true },
    ...subidos.map((u, i) => ({ key: 'subido' + i, label: subidos.length > 1 ? `Plano subido ${i + 1}` : 'Plano subido', src: u, blanco: true })),
  ].filter(Boolean)
  const vista = vistas.find(v => v.key === vistaKey) || vistas.find(v => v.key === 'render') || vistas[0]

  return (
    <Layout>
      <Topbar title="Cotizador AI" subtitle="Texto, fotos, PDF o planos → diseño, render, cotización y despiece" actions={
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {estadoFactura && <span style={{ fontSize:12, color:'var(--z-text-3)' }}>{estadoFactura}</span>}
          <label className="btn btn-ghost btn-sm" style={{ cursor:'pointer' }} title="La factura se lee y, al confirmarla en Compras, actualiza los precios que usa el cotizador">
            Subir factura de compra
            <input type="file" accept="application/pdf,image/*" multiple hidden onChange={e => { subirFacturas(e.target.files); e.target.value = '' }} />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={nuevaSesion}>+ Nueva sesión</button>
        </div>
      } />

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Historial de sesiones */}
        <div style={{ width:232, borderRight:'1px solid var(--z-border)', overflowY:'auto', padding:'16px 12px', background:'var(--z-subtle)', flexShrink:0 }}>
          <div style={{ padding:'0 4px 10px', fontSize:11, color:'var(--z-text-3)', fontWeight:600 }}>
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
                border: activa ? '1px solid rgb(var(--z-primary-c) / 0.3)' : '1px solid transparent',
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
                  {s.estado==='aprobada' && <span className="badge badge-success" style={{ padding:'1px 7px', fontSize:11.5 }}>✓ Aprobada</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Chat */}
        <div style={{ flex: vistas.length ? '1 1 380px' : 1, minWidth: 340, maxWidth: vistas.length ? 620 : 'none', display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {sesionActiva && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 24px', borderBottom:'1px solid var(--z-border)' }}>
              {ETAPAS.map((e, i) => (
                <React.Fragment key={e.key}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{
                      width:18, height:18, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11.5, fontWeight:600,
                      background: i <= etapa ? 'var(--z-primary)' : 'var(--z-bg-2)',
                      color: i <= etapa ? 'var(--z-on-primary)' : 'var(--z-text-muted)',
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
              {vistas.length > 0 && (
                <button className="btn btn-ghost btn-sm z-cot-solo-angosto" onClick={() => setAmpliar(vistas[0])}>Ver diseño</button>
              )}
              {resumen?.pdf_presupuesto_url && (
                <button className="btn btn-sm" onClick={() => abrirDoc(resumen.pdf_presupuesto_url)}>Presupuesto (PDF)</button>
              )}
              {resumen?.pdf_ot_url && (
                <button className="btn btn-sm" onClick={() => abrirDoc(resumen.pdf_ot_url)}>Hoja de taller (PDF)</button>
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
                  background: m.role==='user' ? 'rgb(var(--z-gold-c) / 0.16)' : 'var(--z-primary-glow)',
                  color: m.role==='user' ? 'var(--z-secondary-light)' : 'var(--z-primary-light)',
                  border: m.role==='user' ? '1px solid rgb(var(--z-gold-c) / 0.3)' : '1px solid rgb(var(--z-primary-c) / 0.3)',
                }}>
                  {m.role==='user' ? 'MT' : 'ZB'}
                </div>
                <div style={{
                  maxWidth:'70%', padding:'11px 15px', fontSize:13.5, lineHeight:1.65,
                  background: m.role==='user' ? 'var(--z-primary)' : 'var(--z-card)',
                  color: m.role==='user' ? 'var(--z-on-primary)' : (m.error ? 'var(--z-error)' : 'var(--z-text)'),
                  border: m.role==='user' ? 'none' : '1px solid var(--z-border)',
                  borderRadius: m.role==='user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  whiteSpace:'pre-wrap',
                }}>
                  {String(m.text ?? '').split(/(https?:\/\/\S+)/g).map((t, j) => /^https?:\/\//.test(t)
                    ? <a key={j} href={t} target="_blank" rel="noreferrer" style={{ color:'inherit', textDecoration:'underline' }}>{/\/documentos\/ot\//.test(t) ? 'Abrir hoja de taller' : /\/documentos\//.test(t) ? 'Abrir presupuesto' : 'Abrir link'}</a>
                    : t)}
                  {m.imgs?.length > 0 && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                      {m.imgs.map((u, j) => <a key={j} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Adjunto" style={{ height:72, borderRadius:6, border:'1px solid var(--z-border)', background:'#fff' }} /></a>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--z-primary-glow)', border:'1px solid rgb(var(--z-primary-c) / 0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'var(--z-primary-light)' }}>ZB</div>
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

          {adjuntos.length > 0 && (
            <div style={{ padding:'10px 24px 0', display:'flex', gap:8, flexWrap:'wrap' }}>
              {adjuntos.map((a, i) => (
                <div key={i} style={{ position:'relative' }} title={a.nombre}>
                  <img src={a.dataUrl} alt={a.nombre} style={{ height:56, borderRadius:6, border:'1px solid var(--z-border)', background:'#fff' }} />
                  <button className="btn btn-quiet btn-icon" aria-label={`Quitar ${a.nombre}`} onClick={() => setAdjuntos(x => x.filter((_, j) => j !== i))}
                    style={{ position:'absolute', top:-8, right:-8, width:22, height:22, minHeight:0, padding:0, borderRadius:'50%', background:'var(--z-card)', border:'1px solid var(--z-border)', fontSize:12 }}>✕</button>
                  <button className="btn btn-quiet btn-icon" title="Girar 90°" aria-label={`Girar ${a.nombre}`} onClick={() => girar(a.dataUrl).then(g => setAdjuntos(x => x.map((y, j) => j === i ? { ...y, dataUrl: g } : y)))}
                    style={{ position:'absolute', bottom:-8, right:-8, width:22, height:22, minHeight:0, padding:0, borderRadius:'50%', background:'var(--z-card)', border:'1px solid var(--z-border)', fontSize:12 }}>↻</button>
                </div>
              ))}
              <span style={{ alignSelf:'center', fontSize:12, color:'var(--z-text-3)' }}>Si un plano está de costado, giralo con ↻ hasta que los textos se lean derechos.</span>
            </div>
          )}
          <div style={{ padding:'14px 24px', borderTop: adjuntos.length ? 'none' : '1px solid var(--z-border)', display:'flex', gap:10, alignItems:'flex-end' }}
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); agregarArchivos(e.dataTransfer.files) }}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={e => { agregarArchivos(e.target.files); e.target.value = '' }} />
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={loading || leyendo} title="Adjuntar fotos, PDF o plano" aria-label="Adjuntar archivos">
              {leyendo ? 'Leyendo…' : '📎'}
            </button>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ej: placard 3 cuerpos melamina blanco, 2,40m de frente, 2m alto… o adjuntá fotos / PDF / plano (también podés arrastrarlos acá)"
              rows={2}
              style={{ flex:1, resize:'none' }}
            />
            <button className="btn btn-primary" onClick={send} disabled={loading || leyendo || (!input.trim() && adjuntos.length === 0)}>
              Enviar
            </button>
          </div>
        </div>

        {/* Vista previa: lo que generó Zebrano, al lado del chat */}
        {vistas.length > 0 && (
          <aside className="z-cot-prev" aria-label="Vista previa del diseño">
            <div className="z-seg" role="tablist" aria-label="Vista">
              {vistas.map(v => <button key={v.key} role="tab" aria-pressed={vista?.key === v.key} aria-selected={vista?.key === v.key} onClick={() => setVistaKey(v.key)}>{v.label}</button>)}
            </div>
            {/* El 3D queda montado (oculto en las otras pestañas) para poder sacarle la foto base del render. */}
            {mods3d.length > 0 && (
              <div style={{ display: vista?.key === '3d' ? 'block' : 'none' }}>
                <React.Suspense fallback={null}><Vista3D ref={visor3d} modulos={mods3d} alto={380} /></React.Suspense>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:6, fontSize:12, color:'var(--z-text-3)' }}>
                  <span style={{ flex:1 }}>Arrastrá para girar. El render parte de esta vista: dejala en el ángulo que quieras mostrar.</span>
                  <Link className="btn btn-secondary btn-sm" to={`/cotizador/nuevo?sesion=${sesionId}`}>Editar módulos</Link>
                </div>
              </div>
            )}
            {vista && vista.key !== '3d' && (
              <button className="z-cot-prev-img" onClick={() => setAmpliar(vista)} title="Ampliar" aria-label={`Ampliar ${vista.label}`}>
                <img src={vista.src} alt={vista.label} />
                <span className="z-cot-prev-zoom"><span className="material-symbols-outlined">zoom_in</span> Ampliar</span>
              </button>
            )}
            {resumen?.precio_sugerido > 0 && <ResumenOrden r={resumen} />}
          </aside>
        )}
      </div>

      {ampliar && createPortal(<Visor vista={ampliar} vistas={vistas} onCambiar={setAmpliar} onCerrar={() => setAmpliar(null)} />, document.body)}
    </Layout>
  )
}

// Visor a pantalla completa: ajustar a la ventana o ver al 100–300% y moverse con scroll (diseños de muchos módulos).
function Visor({ vista, vistas, onCambiar, onCerrar }) {
  const [zoom, setZoom] = useState(0) // 0 = ajustar a la ventana
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onCerrar(); if (e.key === '+' || e.key === '=') setZoom(z => Math.min(3, (z || 1) + 0.5)); if (e.key === '-') setZoom(z => (z <= 1 ? 0 : z - 0.5)) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onCerrar])
  return (
    <div className="z-visor" role="dialog" aria-modal="true" aria-label={vista.label} onMouseDown={onCerrar}>
      <div className="z-visor-barra" onMouseDown={e => e.stopPropagation()}>
        <div className="z-seg" role="group" aria-label="Vista">{vistas.map(v => <button key={v.key} aria-pressed={v.key === vista.key} onClick={() => { onCambiar(v); setZoom(0) }}>{v.label}</button>)}</div>
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          <button className="btn btn-secondary btn-sm" aria-pressed={zoom === 0} onClick={() => setZoom(0)}>Ajustar</button>
          {[1, 2, 3].map(z => <button key={z} className="btn btn-secondary btn-sm" aria-pressed={zoom === z} onClick={() => setZoom(z)}>{z * 100}%</button>)}
          <a className="btn btn-secondary btn-sm" href={vista.src} target="_blank" rel="noreferrer" download={vista.key === 'plano' ? 'plano-tecnico.svg' : undefined}>Abrir aparte</a>
          <button className="btn btn-primary btn-sm" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
      </div>
      <div className="z-visor-lienzo" style={zoom ? { display: "block", textAlign: "center" } : undefined} onMouseDown={e => e.stopPropagation()}>
        <img src={vista.src} alt={vista.label} style={zoom ? { width: `${zoom * 100}%`, maxWidth: 'none', background: vista.blanco ? '#fff' : undefined } : { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: vista.blanco ? '#fff' : undefined }} />
      </div>
    </div>
  )
}

// Resumen rápido de la orden (11/11/2026). v73: con el desglose del cotizador (r.desglose) muestra la terminación por insumo,
// los gastos de venta (impuesto bancario y flete) fuera de la utilidad, el % de utilidad y el precio con factura.
export function ResumenOrden({ r }) {
  const $ = v => '$' + Math.round(Number(v) || 0).toLocaleString('es-AR')
  const d = r.desglose
  const horas = d ? d.horas : r.dias_produccion_est ? Math.round(r.dias_produccion_est * 7 * 10) / 10 : null
  const hp = d ? d.horas_persona : r.horas_totales_est
  const tiempo = ['Tiempo aprox.', horas ? `${horas} h de taller${hp ? ` (${Math.round(hp)} h-persona)` : ''}` : (hp ? `${Math.round(hp)} h-persona` : '—')]
  const usd = d?.precio_usd ?? r.precio_usd
  let filas
  if (d) {
    filas = [['Costo materiales', $(d.costo_materiales)],
      ...(d.terminacion_lineas?.length ? d.terminacion_lineas.map(l => [`· ${l.nombre} (${l.cant} ${l.unidad})`, l.precio ? $(l.subtotal) : 'sin precio', 'sub']) : []),
      ['Costo MO', $(d.costo_mo)],
      ['Precio de venta', `${$(d.precio)} sin factura${usd ? ` · USD ${Math.round(usd).toLocaleString('es-AR')}` : ''}`, 'total'],
      [`− Impuesto bancario ${d.pct_bancario}%`, $(d.gasto_bancario), 'sub'],
      [`− Flete ${d.pct_flete}%`, $(d.gasto_flete), 'sub'],
      ['Utilidad', `${$(d.utilidad)} (${d.utilidad_pct}%)`, 'fuerte'],
      [`Con factura (+${d.pct_factura}%)`, $(d.precio_factura)],
      tiempo]
  } else {
    const mat = (+r.costo_materiales || 0) + (+r.costo_herrajes || 0) + (+r.costo_laqueado || 0)
    const util = (+r.precio_sugerido || 0) - (+r.costo_total_interno || 0)
    filas = [['Costo materiales', $(mat)], ['Costo MO', $(r.costo_mano_obra)], ['Utilidad', `${$(util)}${r.precio_sugerido ? ` (${Math.round(util / r.precio_sugerido * 100)}%)` : ''}`],
      ['Precio de venta', `${$(r.precio_sugerido)} sin IVA${usd ? ` · USD ${Math.round(usd).toLocaleString('es-AR')}` : ''}`, 'total'], tiempo]
  }
  return (
    <div className="z-glass" style={{ borderRadius:'var(--radius-lg)', padding:'12px 14px' }} aria-label="Resumen de la orden">
      <div style={{ fontSize:12, fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase', color:'var(--z-text-3)', marginBottom:6 }}>Resumen de la orden</div>
      {filas.map(([k, v, t]) => <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:12, padding: t === 'sub' ? '1px 0 1px 10px' : '3px 0', fontSize: t === 'sub' ? 12 : undefined, borderTop: t === 'total' ? '1px solid var(--z-border)' : undefined, fontWeight: t === 'total' || t === 'fuerte' ? 700 : 400 }}><span style={{ color:'var(--z-text-2)' }}>{k}</span><span style={{ fontVariantNumeric:'tabular-nums', textAlign:'right', whiteSpace:'nowrap' }}>{v}</span></div>)}
    </div>
  )
}
