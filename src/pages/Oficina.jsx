import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authFetch as fetch } from '../lib/authFetch'
import { Layout, Topbar } from '../components/Layout'
import { AREAS, COLOR_ESTADO, ETAPAS } from '../lib/oficina'
const Oficina3D = React.lazy(() => import('../components/Oficina3D'))

// Oficina virtual (14/11/2026): el equipo de agentes de Zebrano trabajando, con su bandeja.
// Lo que se aprueba acá se ejecuta igual que si se aprobara en Alfred, y Alfred queda avisado.
// Escritorio: indicadores + oficina 3D con las decisiones al lado + tablero por etapas. Celular: sin 3D (no se carga three.js).
const FN_OFICINA = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/agente-zebrano/oficina/resolver`
const ESTADO_TXT = { trabajando: 'Trabajando', esperando: 'Esperando tu aprobación', trabado: 'Trabado', libre: 'Sin tareas' }
const hace = iso => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d` }
const money = n => '$' + Math.round(n || 0).toLocaleString('es-AR')
const titulo = { fontSize: 12, fontWeight: 700, color: 'var(--z-text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }

function useAncho() {
  const [w, setW] = useState(window.innerWidth)
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return w
}

export default function Oficina() {
  const [datos, setDatos] = useState(null), [error, setError] = useState('')
  const [actividad, setActividad] = useState([])
  const [vista, setVista] = useState(''), [seguir, setSeguir] = useState('')
  const [sel, setSel] = useState(null)
  const ancho = useAncho(), movil = ancho < 900

  const cargar = useCallback(async () => {
    const [{ data, error }, { data: act }] = await Promise.all([
      supabase.rpc('oficina_estado'),
      supabase.from('agentes_actividad').select('agente,estado,tarea,hacia,created_at').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('created_at', { ascending: false }).limit(80),
    ])
    if (error) setError(error.message); else { setDatos(data); setError('') }
    setActividad(act || [])
  }, [])
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30000)
    const ch = supabase.channel('oficina')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agentes_actividad' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agente_propuestas' }, cargar)
      .subscribe()
    return () => { clearInterval(t); supabase.removeChannel(ch) }
  }, [cargar])

  const agentes = datos?.agentes || []
  const agente = agentes.find(a => a.slug === sel)
  const tb = datos?.tablero || {}
  const alto3d = Math.max(420, Math.min(600, window.innerHeight - 300))

  return (
    <Layout>
      <Topbar title="Oficina" subtitle="El equipo de agentes de Zebrano: qué hace cada uno y qué espera tu decisión" actions={!movil &&
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ width: 'auto' }} value={vista} onChange={e => { setVista(e.target.value); setSeguir('') }} aria-label="Cámara">
            <option value="">Plano general</option>
            {Object.entries(AREAS).map(([k, a]) => <option key={k} value={k}>{a.label.charAt(0) + a.label.slice(1).toLowerCase()}</option>)}
          </select>
          <select style={{ width: 'auto' }} value={seguir} onChange={e => setSeguir(e.target.value)} aria-label="Seguir a un agente">
            <option value="">Seguir a…</option>
            {agentes.map(a => <option key={a.slug} value={a.slug}>{a.nombre}</option>)}
          </select>
        </div>
      } />
      {error && <div className="z-glass" style={{ padding: 12, color: 'var(--z-error)', marginBottom: 12 }}>No pude cargar la oficina: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Kpi label="Por aprobar" valor={tb.por_aprobar} color="var(--z-warning)" />
        <Kpi label="Consultas · 7 d" valor={tb.consultas_7d} />
        <Kpi label="Cotizaciones · 7 d" valor={tb.cotizaciones_7d} nota={tb.monto_7d ? money(tb.monto_7d) : ''} />
        <Kpi label="Aprobadas · 30 d" valor={tb.aprobadas_30d} />
        <Kpi label="Aprendidos" valor={tb.aprendizajes} color="var(--z-primary)" />
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: movil ? 'wrap' : 'nowrap' }}>
        {!movil && <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <Suspense fallback={<div style={{ height: alto3d }} />}>
            <Oficina3D datos={datos} vista={vista} seguir={seguir} onSelect={setSel} alto={alto3d} />
          </Suspense>
          <Leyenda />
        </div>}
        <div style={{ flex: movil ? '1 1 100%' : '0 0 360px', minWidth: 0 }}>
          {agente ? <PanelAgente a={agente} onCerrar={() => setSel(null)} onCambio={cargar} alto={movil ? undefined : alto3d} />
            : <Decisiones agentes={agentes} actividad={actividad} onSel={setSel} alto={movil ? undefined : alto3d} />}
        </div>
      </div>

      {movil && <div style={{ marginTop: 16 }}>
        <div style={{ ...titulo, marginBottom: 8 }}>Equipo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {agentes.map(a => <TarjetaAgente key={a.slug} a={a} activo={sel === a.slug} onClick={() => { setSel(a.slug); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />)}
        </div>
      </div>}

      <Etapas agentes={agentes} actividad={actividad} onSel={a => { setSel(a); if (movil) window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
    </Layout>
  )
}

function Kpi({ label, valor, nota, color }) {
  return <div className="z-glass" style={{ borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: color || 'var(--z-text)' }}>{valor ?? '—'}</span>
    <span style={{ fontSize: 12.5, color: 'var(--z-text-2)' }}>{label}{nota && <> · {nota}</>}</span>
  </div>
}

function Avatar({ a, tam = 34 }) {
  return <span style={{ flexShrink: 0, width: tam, height: tam, borderRadius: tam / 2, background: a.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: tam * 0.42, boxShadow: `0 0 0 2px var(--z-card), 0 0 0 4px ${COLOR_ESTADO[a.estado]}` }}>{a.nombre[0]}</span>
}

// Lo que hoy depende de Martín: bandejas con pendientes y agentes trabados. Abajo, lo último que pasó.
function Decisiones({ agentes, actividad, onSel, alto }) {
  const temas = [...agentes.filter(a => a.pendientes > 0).sort((x, y) => y.pendientes - x.pendientes), ...agentes.filter(a => a.estado === 'trabado' && !a.pendientes)]
  return <div className="z-glass" style={{ borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, height: alto, boxSizing: 'border-box', overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <strong style={{ fontSize: 15.5 }}>Necesita tu decisión</strong>
      <span style={{ fontSize: 12.5, color: 'var(--z-text-3)' }}>{temas.length ? `${temas.length} tema${temas.length > 1 ? 's' : ''}` : ''}</span>
    </div>
    {temas.length === 0 && <div style={{ fontSize: 13, color: 'var(--z-text-3)' }}>Nada espera tu decisión.</div>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flexShrink: 1, minHeight: 0 }}>
      {temas.map(a => {
        const trabado = a.estado === 'trabado' && !a.pendientes
        return <button key={a.slug} onClick={() => onSel(a.slug)} style={{ textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: 'var(--z-card)', border: `1px solid ${trabado ? 'rgb(229 72 77 / .45)' : 'rgb(242 176 30 / .45)'}` }}>
          <Avatar a={a} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 650, fontSize: 14 }}>{trabado ? `${a.nombre} está trabado` : `${a.pendientes} por aprobar · ${a.nombre}`}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--z-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trabado ? a.bloqueo : a.ultima?.tarea || a.puesto}</span>
          </span>
          <span className="btn btn-ghost btn-sm" aria-hidden="true">{trabado ? 'Ver' : 'Revisar'}</span>
        </button>
      })}
    </div>
    <div style={{ ...titulo, marginTop: 6 }}>En vivo</div>
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 60, flex: 1 }}>
      {actividad.length === 0 && <div style={{ fontSize: 13, color: 'var(--z-text-3)' }}>Sin movimiento esta semana.</div>}
      {actividad.slice(0, 12).map((x, i) => {
        const de = agentes.find(a => a.slug === x.agente), hacia = agentes.find(a => a.slug === x.hacia)
        return <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--z-border)', fontSize: 13 }}>
          <span><strong style={{ color: de?.color }}>{de?.nombre || x.agente}{hacia && <> → {hacia.nombre}</>}</strong> <span style={{ color: 'var(--z-text-2)' }}>{x.tarea}</span></span>
          <span style={{ color: 'var(--z-text-3)', whiteSpace: 'nowrap', fontSize: 12 }}>{hace(x.created_at)}</span>
        </div>
      })}
    </div>
  </div>
}

// Tablero "del contacto al taller": una columna por etapa, con su agente, lo pendiente y lo que hizo en la semana.
function Etapas({ agentes, actividad, onSel }) {
  const jefe = agentes.find(a => !ETAPAS.some(e => e.agentes.includes(a.slug)))
  return <section style={{ marginTop: 18 }} aria-label="Del contacto al taller">
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
      <strong style={{ fontSize: 16 }}>Del contacto al taller</strong>
      {jefe && <button onClick={() => onSel(jefe.slug)} className="btn btn-quiet btn-sm" style={{ fontSize: 12.5 }}>{jefe.nombre} coordina · {jefe.ultima?.tarea || jefe.puesto}{jefe.ultima?.at ? ` · ${hace(jefe.ultima.at)}` : ''}</button>}
    </div>
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ETAPAS.length}, minmax(210px, 1fr))`, gap: 10, minWidth: ETAPAS.length * 220 }}>
        {ETAPAS.map((e, n) => {
          const suyos = e.agentes.map(s => agentes.find(a => a.slug === s)).filter(Boolean)
          const hechos = actividad.filter(x => e.agentes.includes(x.agente)).slice(0, 4)
          return <div key={e.k} style={{ background: 'var(--z-bg-2)', border: '1px solid var(--z-border)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--z-text)', color: 'var(--z-bg)', fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{n + 1}</span>
              <strong style={{ fontSize: 14.5 }}>{e.nombre}</strong>
            </div>
            {suyos.map(a => <button key={a.slug} onClick={() => onSel(a.slug)} style={{ font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 10, border: '1px solid var(--z-border)', background: 'var(--z-card)' }}>
              <Avatar a={a} tam={28} />
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontWeight: 650, fontSize: 13.5 }}>{a.nombre}</span><span style={{ display: 'block', fontSize: 11.5, color: 'var(--z-text-2)' }}>{ESTADO_TXT[a.estado]}</span></span>
            </button>)}
            {suyos.filter(a => a.pendientes > 0).map(a => <Tarjeta key={'p' + a.slug} tag="Por aprobar" tono="warning" texto={`${a.pendientes} propuesta${a.pendientes > 1 ? 's' : ''} de ${a.nombre}`} accion="Revisar" onClick={() => onSel(a.slug)} />)}
            {suyos.filter(a => a.estado === 'trabado').map(a => <Tarjeta key={'t' + a.slug} tag="Trabado" tono="error" texto={a.bloqueo || `${a.nombre} no puede seguir`} accion="Ver" onClick={() => onSel(a.slug)} />)}
            {hechos.map((x, i) => {
              const hacia = agentes.find(a => a.slug === x.hacia)
              return <Tarjeta key={i} tag={hacia ? `Pase a ${hacia.nombre}` : x.estado === 'trabajando' ? 'En curso' : 'Hecho'} tono={hacia ? 'primary' : x.estado === 'trabajando' ? 'success' : ''} texto={x.tarea} meta={hace(x.created_at)} />
            })}
            {hechos.length === 0 && !suyos.some(a => a.pendientes > 0 || a.estado === 'trabado') && <div style={{ fontSize: 12.5, color: 'var(--z-text-3)', textAlign: 'center', padding: 14, border: '1.5px dashed var(--z-border)', borderRadius: 10 }}>Sin movimiento esta semana</div>}
          </div>
        })}
      </div>
    </div>
  </section>
}

const TONOS = { warning: 'var(--z-warning)', error: 'var(--z-error)', primary: 'var(--z-primary)', success: 'var(--z-success)', '': 'var(--z-text-3)' }
function Tarjeta({ tag, tono = '', texto, meta, accion, onClick }) {
  return <div style={{ background: 'var(--z-card)', border: '1px solid var(--z-border)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: TONOS[tono] }}>{tag}</span>
    <span style={{ fontSize: 13, lineHeight: 1.35 }}>{texto}</span>
    {(meta || accion) && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {meta && <span style={{ fontSize: 11.5, color: 'var(--z-text-3)' }}>{meta}</span>}
      {accion && <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={onClick}>{accion}</button>}
    </div>}
  </div>
}
const nombre = (ag, s) => ag.find(a => a.slug === s)?.nombre || s

function Leyenda() {
  return <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--z-text-2)', marginTop: 8 }}>
    {Object.entries(ESTADO_TXT).map(([k, t]) => <span key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 10, height: 10, borderRadius: 5, background: COLOR_ESTADO[k] }} />{t}</span>)}
    <span>· El número al lado del nombre es lo que espera tu aprobación.</span>
  </div>
}

function TarjetaAgente({ a, activo, onClick }) {
  return <button onClick={onClick} className="z-glass" style={{ textAlign: 'left', borderRadius: 'var(--radius-lg)', padding: 12, border: activo ? '1px solid var(--z-primary)' : '1px solid var(--z-border)', cursor: 'pointer', color: 'inherit', background: undefined }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: COLOR_ESTADO[a.estado], flexShrink: 0 }} />
      <strong>{a.nombre}</strong><span style={{ fontSize: 12, color: 'var(--z-text-3)' }}>{a.puesto}</span>
      {a.pendientes > 0 && <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>{a.pendientes}</span>}
    </div>
    <div style={{ fontSize: 12.5, color: 'var(--z-text-2)', marginTop: 6 }}>{a.estado === 'trabado' ? a.bloqueo : a.ultima?.tarea || a.descripcion}</div>
    {a.ultima?.at && <div style={{ fontSize: 11.5, color: 'var(--z-text-3)', marginTop: 4 }}>{hace(a.ultima.at)}</div>}
  </button>
}

function PanelAgente({ a, onCerrar, onCambio, alto }) {
  const [act, setAct] = useState([]), [props, setProps] = useState([]), [cargando, setCargando] = useState(true)
  const traer = useCallback(async () => {
    const [{ data: ac }, { data: pr }] = await Promise.all([
      supabase.from('agentes_actividad').select('estado,tarea,hacia,created_at').eq('agente', a.slug).order('created_at', { ascending: false }).limit(15),
      supabase.from('agente_propuestas').select('id,tipo,titulo,descripcion,accion,estado,prioridad,created_at,error').eq('agente', a.slug).in('estado', ['nueva', 'enviada', 'error_envio']).order('created_at', { ascending: false }).limit(30),
    ])
    setAct(ac || []); setProps(pr || []); setCargando(false)
  }, [a.slug])
  useEffect(() => { setCargando(true); traer() }, [traer, a.pendientes, a.ultima?.at])

  return <div className="z-glass" style={{ borderRadius: 16, padding: 16, height: alto, boxSizing: 'border-box', overflowY: 'auto' }} aria-label={`Panel de ${a.nombre}`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar a={a} tam={40} />
      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{a.nombre}</div><div style={{ fontSize: 12.5, color: 'var(--z-text-3)' }}>{a.puesto}</div></div>
      <button className="btn btn-quiet btn-sm" onClick={onCerrar} aria-label="Cerrar">✕</button>
    </div>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
      <span style={{ width: 10, height: 10, borderRadius: 5, background: COLOR_ESTADO[a.estado] }} /><strong>{ESTADO_TXT[a.estado]}</strong>
      {a.pagina && <Link to={a.pagina} style={{ marginLeft: 'auto', fontSize: 12.5 }}>Abrir su página →</Link>}
    </div>
    {a.bloqueo && <div style={{ marginTop: 8, fontSize: 13, padding: '8px 10px', borderRadius: 8, background: 'rgb(229 72 77 / 0.1)', color: 'var(--z-error)' }}>{a.bloqueo}</div>}
    <p style={{ fontSize: 13, color: 'var(--z-text-2)', margin: '10px 0' }}>{a.descripcion}</p>

    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--z-text-3)', textTransform: 'uppercase', margin: '12px 0 6px' }}>Bandeja · {props.length}</div>
    {cargando ? <div style={{ fontSize: 13 }}>Cargando…</div> : props.length === 0 ? <div style={{ fontSize: 13, color: 'var(--z-text-3)' }}>Nada para aprobar.</div>
      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8,  }}>{props.map(p => <Propuesta key={p.id} p={p} onListo={() => { traer(); onCambio() }} />)}</div>}

    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--z-text-3)', textTransform: 'uppercase', margin: '14px 0 6px' }}>Qué hizo</div>
    {act.length === 0 ? <div style={{ fontSize: 13, color: 'var(--z-text-3)' }}>Todavía sin actividad registrada.</div>
      : act.map((x, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0', display: 'flex', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: COLOR_ESTADO[x.estado === 'hecho' ? 'libre' : x.estado] || '#999', marginTop: 6, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{x.tarea}</span><span style={{ color: 'var(--z-text-3)', whiteSpace: 'nowrap' }}>{hace(x.created_at)}</span></div>)}
  </div>
}

function Propuesta({ p, onListo }) {
  const textoBase = p.accion?.texto || ''
  const [abierta, setAbierta] = useState(false), [texto, setTexto] = useState(textoBase), [ocupado, setOcupado] = useState(false), [res, setRes] = useState('')
  async function resolver(decision) {
    setOcupado(true); setRes('')
    try {
      const r = await fetch(FN_OFICINA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propuesta_id: p.id, decision, texto_final: texto !== textoBase ? texto : undefined }) })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || 'error')
      setRes(d.resultado || 'Listo.'); setTimeout(onListo, 1200)
    } catch (e) { setRes('No se pudo: ' + e.message) }
    setOcupado(false)
  }
  return <div style={{ border: '1px solid var(--z-border)', borderRadius: 10, padding: 10, fontSize: 13 }}>
    <div style={{ display: 'flex', gap: 6 }}><strong style={{ flex: 1 }}>{p.titulo || p.tipo}</strong>{p.prioridad === 'alta' && <span className="badge badge-warning">alta</span>}</div>
    {p.descripcion && <div style={{ color: 'var(--z-text-2)', marginTop: 4 }}>{p.descripcion}</div>}
    {p.estado === 'enviada' && <div style={{ fontSize: 11.5, color: 'var(--z-text-3)', marginTop: 4 }}>También está en la cola de Alfred.</div>}
    {textoBase && <>
      <button className="btn btn-quiet btn-sm" style={{ padding: 0, marginTop: 4 }} onClick={() => setAbierta(x => !x)}>{abierta ? 'Ocultar texto' : 'Ver y corregir el texto'}</button>
      {abierta && <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} style={{ width: '100%', marginTop: 6, fontSize: 13 }} aria-label="Texto a enviar" />}
    </>}
    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className="btn btn-primary btn-sm" disabled={ocupado} onClick={() => resolver('aprobar')}>{texto !== textoBase ? 'Aprobar con la corrección' : 'Aprobar'}</button>
      <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => resolver('descartar')}>Descartar</button>
      {res && <span style={{ fontSize: 12.5, color: res.startsWith('No se pudo') ? 'var(--z-error)' : 'var(--z-text-2)' }}>{res}</span>}
    </div>
  </div>
}
