import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Badge, Spinner, KpiCard } from '../components/ui'

const fmt  = n => n ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fmtM = n => n ? '$' + (Math.round(n/1000)).toLocaleString('es-AR') + 'k' : '—'

const ETAPAS = [
  { key:'lead',             label:'Lead',             color:'#F1EFE8' },
  { key:'contactado',       label:'Contactado',       color:'#FAEEDA' },
  { key:'cotizando',        label:'Cotizando',        color:'#E6F1FB' },
  { key:'propuesta_enviada',label:'Propuesta enviada',color:'#E1F5EE' },
  { key:'ganado',           label:'Ganado',           color:'#EAF3DE' },
]

export default function Ventas() {
  const navigate = useNavigate()
  const [opps, setOpps]     = useState([])
  const [loading, setLoading] = useState(true)
  const [seleccionada, setSeleccionada] = useState(null)
  const [interacciones, setInteracciones] = useState([])
  const [nuevaNota, setNuevaNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [iniciando, setIniciando] = useState(false)

  useEffect(() => { load() }, [])

  async function abrir(o) {
    setSeleccionada(o)
    const { data } = await supabase.from('roble_interacciones').select('*').eq('oportunidad_id', o.id).order('created_at', { ascending: false })
    setInteracciones(data || [])
  }

  async function cambiarEtapa(nuevoEstado) {
    if (!seleccionada) return
    const { error } = await supabase.from('oportunidades').update({ estado_funnel: nuevoEstado, ultimo_contacto_at: new Date().toISOString() }).eq('id', seleccionada.id)
    if (error) { alert('No se pudo cambiar la etapa: ' + error.message); return }
    setSeleccionada(s => ({ ...s, estado_funnel: nuevoEstado }))
    load()
  }

  async function agregarNota() {
    if (!nuevaNota.trim() || !seleccionada) return
    setGuardando(true)
    const { error } = await supabase.from('roble_interacciones').insert({
      oportunidad_id: seleccionada.id, cliente_id: seleccionada.cliente_id,
      canal: 'interno', tipo: 'nota', contenido: nuevaNota.trim(), resultado: null,
    })
    setGuardando(false)
    if (error) { alert('No se pudo guardar la nota: ' + error.message); return }
    setNuevaNota('')
    abrir(seleccionada)
  }

  async function iniciarCotizacion() {
    if (!seleccionada || iniciando) return
    setIniciando(true)
    try {
      const { data: ses, error } = await supabase.from('cotizacion_sesiones').insert({
        origen: 'app', canal: 'interno', estado: 'iniciada',
        cliente_id: seleccionada.cliente_id,
        cliente_nombre: seleccionada.nombre_prospecto || null,
        tipo_trabajo: seleccionada.tipo_trabajo || null,
        descripcion_raw: seleccionada.descripcion || null,
      }).select('id').single()
      if (error) { alert('No se pudo iniciar la cotización: ' + error.message); return }
      await supabase.from('oportunidades').update({ estado_funnel: 'cotizando', ultimo_contacto_at: new Date().toISOString() }).eq('id', seleccionada.id)
      navigate('/cotizador')
    } finally {
      setIniciando(false)
    }
  }

  async function load() {
    const { data } = await supabase
      .from('oportunidades')
      .select('*, clientes(nombre)')
      .order('valor_estimado', { ascending: false })
    setOpps(data || [])
    setLoading(false)
  }

  const pipeline = opps.filter(o => !['ganado','perdido'].includes(o.estado_funnel))
  const totalPipeline = pipeline.reduce((s,o) => s+(o.valor_estimado||0), 0)
  const totalGanado   = opps.filter(o=>o.estado_funnel==='ganado').reduce((s,o)=>s+(o.valor_estimado||0),0)

  return (
    <Layout>
      <Topbar title="Ventas" subtitle="Pipeline de oportunidades" />
      <PageContent>
        {loading ? <Spinner /> : <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:24 }}>
            <KpiCard label="Pipeline total"   value={fmtM(totalPipeline)} detail={`${pipeline.length} oportunidades`} accent />
            <KpiCard label="Ganado"           value={fmtM(totalGanado)}  detail="cerrado exitosamente" />
            <KpiCard label="Leads activos"    value={opps.filter(o=>o.estado_funnel==='lead').length} detail="sin contactar" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:`repeat(${ETAPAS.length},minmax(0,1fr))`, gap:12 }}>
            {ETAPAS.map(etapa => {
              const items = opps.filter(o => o.estado_funnel === etapa.key)
              const total = items.reduce((s,o) => s+(o.valor_estimado||0), 0)
              return (
                <div key={etapa.key}>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:500, color:'var(--z-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{etapa.label}</div>
                    <div style={{ fontSize:12, color:'var(--z-hint)', marginTop:2 }}>{fmtM(total)}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, minHeight:80 }}>
                    {items.map(o => (
                      <div key={o.id} onClick={() => abrir(o)} style={{
                        background:'#fff', border:'0.5px solid var(--z-border)',
                        borderRadius:'var(--radius-md)', padding:'10px 12px', cursor:'pointer',
                        borderLeft:`3px solid ${etapa.color === '#EAF3DE' ? '#3B6D11' : etapa.color === '#E1F5EE' ? '#1D9E75' : '#D3D1C7'}`,
                      }}>
                        <div style={{ fontWeight:500, fontSize:13 }}>{o.nombre_prospecto || o.clientes?.nombre || '—'}</div>
                        <div style={{ fontSize:12, color:'var(--z-muted)', marginTop:2 }}>{o.tipo_trabajo} · {fmt(o.valor_estimado)}</div>
                        <div style={{ marginTop:6, display:'flex', gap:4 }}>
                          <Badge value={o.temperatura} />
                          {o.origen && <Badge value={o.origen} />}
                        </div>
                        {o.fecha_seguimiento && (
                          <div style={{ fontSize:11, color:'var(--z-hint)', marginTop:6 }}>
                            Seguimiento: {o.fecha_seguimiento}
                          </div>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div style={{ fontSize:12, color:'var(--z-hint)', padding:'12px 0', textAlign:'center' }}>—</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>}
      </PageContent>
      {seleccionada && (
        <DetalleOportunidad
          o={seleccionada}
          interacciones={interacciones}
          nuevaNota={nuevaNota}
          setNuevaNota={setNuevaNota}
          guardando={guardando}
          iniciando={iniciando}
          onAgregarNota={agregarNota}
          onCambiarEtapa={cambiarEtapa}
          onIniciarCotizacion={iniciarCotizacion}
          onClose={() => setSeleccionada(null)}
        />
      )}
    </Layout>
  )
}

function DetalleOportunidad({ o, interacciones, nuevaNota, setNuevaNota, guardando, iniciando, onAgregarNota, onCambiarEtapa, onIniciarCotizacion, onClose }) {
  const etapas = ['lead','contactado','cotizando','propuesta_enviada','ganado','perdido']
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'var(--radius-lg)', padding:24, width:480, maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:600 }}>{o.nombre_prospecto || o.clientes?.nombre || 'Sin nombre'}</div>
            <div style={{ fontSize:12, color:'var(--z-muted)', marginTop:2 }}>{o.tipo_trabajo || 'sin tipo'} · {o.origen}{o.canal_detalle ? ` (${o.canal_detalle})` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>

        {o.descripcion && <div style={{ fontSize:13, color:'var(--z-text)', background:'var(--z-bg-2, #f5f5f0)', padding:10, borderRadius:8, marginBottom:14 }}>{o.descripcion}</div>}

        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
          {etapas.map(e => (
            <button key={e} onClick={() => onCambiarEtapa(e)} className={e === o.estado_funnel ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{ fontSize:11, textTransform:'capitalize' }}>
              {e.replace('_',' ')}
            </button>
          ))}
        </div>

        {o.proyecto_id ? (
          <div style={{ fontSize:12, color:'var(--z-success, #3B6D11)', marginBottom:14 }}>✓ Ya tiene proyecto vinculado en Proyectos.</div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onIniciarCotizacion} disabled={iniciando} style={{ marginBottom:16 }}>
            {iniciando ? 'Iniciando...' : 'Iniciar cotización con Nogal →'}
          </button>
        )}

        <div style={{ fontSize:11, color:'var(--z-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Notas y seguimiento</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10, maxHeight:180, overflowY:'auto' }}>
          {interacciones.length === 0 && <div style={{ fontSize:12, color:'var(--z-hint)' }}>Sin notas todavía.</div>}
          {interacciones.map(i => (
            <div key={i.id} style={{ fontSize:12, borderLeft:'2px solid var(--z-border)', paddingLeft:8 }}>
              <div style={{ color:'var(--z-hint)', fontSize:10 }}>{new Date(i.created_at).toLocaleString('es-AR')} · {i.canal}</div>
              <div>{i.contenido}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <input value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} placeholder="Agregar nota de seguimiento..." style={{ flex:1, fontSize:12 }} onKeyDown={e => e.key === 'Enter' && onAgregarNota()} />
          <button className="btn btn-primary btn-sm" onClick={onAgregarNota} disabled={guardando || !nuevaNota.trim()}>{guardando ? '...' : 'Agregar'}</button>
        </div>
      </div>
    </div>
  )
}
