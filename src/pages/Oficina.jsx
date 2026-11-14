import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authFetch as fetch } from '../lib/authFetch'
import { Layout, Topbar } from '../components/Layout'
import { AREAS, COLOR_ESTADO } from '../lib/oficina'
const Oficina3D = React.lazy(() => import('../components/Oficina3D'))

// Oficina virtual (14/11/2026): el equipo de agentes de Zebrano trabajando, con su bandeja.
// Lo que se aprueba acá se ejecuta igual que si se aprobara en Alfred, y Alfred queda avisado.
const FN_OFICINA = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/agente-zebrano/oficina/resolver`
const ESTADO_TXT = { trabajando: 'Trabajando', esperando: 'Esperando tu aprobación', trabado: 'Trabado', libre: 'Sin tareas' }
const hace = iso => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d` }

export default function Oficina() {
  const [datos, setDatos] = useState(null), [error, setError] = useState('')
  const [vista, setVista] = useState(''), [seguir, setSeguir] = useState('')
  const [sel, setSel] = useState(null)
  const [lista, setLista] = useState(() => window.innerWidth < 760)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('oficina_estado')
    if (error) setError(error.message); else { setDatos(data); setError('') }
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

  return (
    <Layout>
      <Topbar title="Oficina" subtitle="El equipo de agentes de Zebrano: qué hace cada uno, qué espera tu aprobación y qué está trabado" actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {!lista && <>
            <select value={vista} onChange={e => { setVista(e.target.value); setSeguir('') }} aria-label="Cámara">
              <option value="">Plano general</option>
              {Object.entries(AREAS).map(([k, a]) => <option key={k} value={k}>{a.label.charAt(0) + a.label.slice(1).toLowerCase()}</option>)}
            </select>
            <select value={seguir} onChange={e => setSeguir(e.target.value)} aria-label="Seguir a un agente">
              <option value="">Seguir a…</option>
              {agentes.map(a => <option key={a.slug} value={a.slug}>{a.nombre}</option>)}
            </select>
          </>}
          <button className="btn btn-ghost btn-sm" onClick={() => setLista(l => !l)}>{lista ? 'Ver oficina 3D' : 'Ver como lista'}</button>
        </div>
      } />
      {error && <div className="z-glass" style={{ padding: 12, color: 'var(--z-error)', marginBottom: 12 }}>No pude cargar la oficina: {error}</div>}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '3 1 560px', minWidth: 0 }}>
          {lista
            ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {agentes.map(a => <TarjetaAgente key={a.slug} a={a} activo={sel === a.slug} onClick={() => setSel(a.slug)} />)}
              </div>
            : <Suspense fallback={<div style={{ height: 560 }} />}>
                <Oficina3D datos={datos} vista={vista} seguir={seguir} onSelect={setSel} alto={Math.max(420, Math.min(640, window.innerHeight - 230))} />
              </Suspense>}
          <Leyenda />
        </div>
        <div style={{ flex: '1 1 340px', minWidth: 300, maxWidth: 520 }}>
          {agente ? <PanelAgente a={agente} onCerrar={() => setSel(null)} onCambio={cargar} />
            : <div className="z-glass" style={{ borderRadius: 'var(--radius-lg)', padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Tocá un agente</div>
                <div style={{ fontSize: 13, color: 'var(--z-text-2)', marginBottom: 12 }}>Vas a ver qué está haciendo, su historial y lo que propone para que lo apruebes, lo corrijas o lo descartes. También se puede aprobar desde Alfred: lo que se resuelve en un lado no se repite en el otro.</div>
                {(datos?.pases || []).length > 0 && <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--z-text-3)', textTransform: 'uppercase', margin: '8px 0 4px' }}>Pases recientes</div>
                  {datos.pases.map((p, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>{nombre(agentes, p.de)} → {nombre(agentes, p.a)}: {p.tarea} <span style={{ color: 'var(--z-text-3)' }}>{hace(p.at)}</span></div>)}
                </>}
              </div>}
        </div>
      </div>
    </Layout>
  )
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

function PanelAgente({ a, onCerrar, onCambio }) {
  const [act, setAct] = useState([]), [props, setProps] = useState([]), [cargando, setCargando] = useState(true)
  const traer = useCallback(async () => {
    const [{ data: ac }, { data: pr }] = await Promise.all([
      supabase.from('agentes_actividad').select('estado,tarea,hacia,created_at').eq('agente', a.slug).order('created_at', { ascending: false }).limit(15),
      supabase.from('agente_propuestas').select('id,tipo,titulo,descripcion,accion,estado,prioridad,created_at,error').eq('agente', a.slug).in('estado', ['pendiente', 'enviada', 'error_envio']).order('created_at', { ascending: false }).limit(30),
    ])
    setAct(ac || []); setProps(pr || []); setCargando(false)
  }, [a.slug])
  useEffect(() => { setCargando(true); traer() }, [traer, a.pendientes, a.ultima?.at])

  return <div className="z-glass" style={{ borderRadius: 'var(--radius-lg)', padding: 16 }} aria-label={`Panel de ${a.nombre}`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 34, height: 34, borderRadius: 17, background: a.color, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700 }}>{a.nombre[0]}</span>
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
      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>{props.map(p => <Propuesta key={p.id} p={p} onListo={() => { traer(); onCambio() }} />)}</div>}

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
