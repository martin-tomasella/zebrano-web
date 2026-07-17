
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, KpiCard, Btn, Badge } from '../components/ui'

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—'
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function diasRestantes(fecha) {
  if (!fecha) return null
  return Math.ceil((new Date(fecha) - new Date()) / 86400000)
}

function colorDias(dias) {
  if (dias === null) return 'var(--z-text-muted)'
  if (dias < 0)  return 'var(--z-error)'
  if (dias <= 5) return 'var(--z-warning)'
  return 'var(--z-success)'
}

// ─── Chip de riesgo (mismo lenguaje visual que Badge: dot + mono, sin tocar ui.jsx) ──
function RiskChip({ dias }) {
  if (dias === null) return null
  const conf = dias < 0
    ? { color: 'var(--z-error)',   bg: 'rgba(255,180,171,0.15)', border: 'rgba(255,180,171,0.3)', label: `${Math.abs(dias)}D RETRASO` }
    : dias <= 5
    ? { color: 'var(--z-warning)', bg: 'rgba(227,179,65,0.15)',  border: 'rgba(227,179,65,0.3)',  label: dias === 0 ? 'ENTREGA HOY' : `${dias}D · EN RIESGO` }
    : { color: 'var(--z-success)', bg: 'rgba(172,210,146,0.15)', border: 'rgba(172,210,146,0.3)', label: 'A TIEMPO' }
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 9px', borderRadius:99, fontSize:10,
      fontFamily:'var(--font-mono)', fontWeight:500, letterSpacing:'0.05em',
      textTransform:'uppercase',
      background:conf.bg, color:conf.color, border:`1px solid ${conf.border}`,
    }}>
      <span style={{ width:4, height:4, borderRadius:'50%', background:conf.color, display:'inline-block', flexShrink:0 }}/>
      {conf.label}
    </span>
  )
}

export default function Produccion() {
  const [tab, setTab] = useState('lista')
  const [proyectos, setProyectos] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mesCalendario, setMesCalendario] = useState(() => { const d = new Date(); d.setDate(1); return d })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: p, error: ep } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre, telefono, email)')
      .eq('estado', 'en_fabricacion')
      .order('fecha_entrega_estimada')
    if (ep) console.error('Error cargando produccion:', ep)
    const proyectosData = p || []
    setProyectos(proyectosData)

    if (proyectosData.length > 0) {
      const { data: o, error: eo } = await supabase
        .from('ordenes_trabajo')
        .select('proyecto_id, horas_fabricacion_estimadas, horas_instalacion_estimadas, tramos_instalacion')
        .in('proyecto_id', proyectosData.map(x => x.id))
      if (eo) console.error('Error cargando ordenes:', eo)
      setOrdenes(o || [])
    } else {
      setOrdenes([])
    }
    setLoading(false)
  }

  async function marcarEntregado(p) {
    setGuardando(true)
    const { error } = await supabase.from('proyectos').update({
      estado: 'entregado',
      fecha_entrega_real: new Date().toISOString().slice(0,10),
    }).eq('id', p.id)
    setGuardando(false)
    if (error) { alert('No se pudo marcar como entregado: ' + error.message); return }
    setSeleccionado(null)
    load()
  }

  const otPorProyecto = useMemo(() => {
    const map = {}
    for (const o of ordenes) { if (o.proyecto_id) map[o.proyecto_id] = o }
    return map
  }, [ordenes])

  const conRetraso = proyectos.filter(p => { const d = diasRestantes(p.fecha_entrega_estimada); return d !== null && d < 0 }).length
  const valorEnTaller = proyectos.reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0)
  const pctATiempo = proyectos.length > 0 ? Math.round(((proyectos.length - conRetraso) / proyectos.length) * 100) : 0

  // ── Proyecto más crítico (derivado de datos ya cargados, sin queries nuevas) ──
  const masCritico = useMemo(() => {
    let peor = null, peorDias = Infinity
    for (const p of proyectos) {
      const d = diasRestantes(p.fecha_entrega_estimada)
      if (d !== null && d < 0 && d < peorDias) { peorDias = d; peor = p }
    }
    return peor
  }, [proyectos])

  return (
    <Layout>
      <Topbar title="Producción" subtitle={`${proyectos.length} trabajos en taller${conRetraso > 0 ? ` · ${conRetraso} con retraso` : ''}`} />
      <PageContent>

        {/* ── Alerta crítica: proyectos con retraso (derivado de fecha_entrega_estimada) ── */}
        {!loading && conRetraso > 0 && masCritico && (
          <div style={{
            display:'flex', alignItems:'center', gap:14, padding:'14px 18px', marginBottom:20,
            background:'rgba(255,180,171,0.08)', border:'1px solid rgba(255,180,171,0.35)', borderRadius:'var(--radius-lg)',
          }}>
            <div style={{ width:34, height:34, borderRadius:'var(--radius-sm)', flexShrink:0, background:'var(--z-error)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize:18, color:'var(--z-on-error)' }}>warning</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:'var(--z-error)', textTransform:'uppercase', letterSpacing:'0.12em' }}>Alerta crítica</span>
              <p style={{ margin:'3px 0 0', fontSize:13, color:'var(--z-text)', lineHeight:1.5 }}>
                {conRetraso} proyecto{conRetraso !== 1 ? 's' : ''} con retraso en producción. El más urgente:{' '}
                <strong style={{ color:'var(--z-error)' }}>{masCritico.clientes?.nombre || 'Sin nombre'}</strong>
                {' '}— {Math.abs(diasRestantes(masCritico.fecha_entrega_estimada))}d de retraso sobre la entrega estimada ({fechaFmt(masCritico.fecha_entrega_estimada)}).
              </p>
            </div>
            <Btn small variant="ghost" onClick={() => setSeleccionado(masCritico)} style={{ color:'var(--z-error)', borderColor:'rgba(255,180,171,0.35)', flexShrink:0 }}>
              Ver detalle
            </Btn>
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {[['lista','Lista'],['gantt','Gantt'],['calendario','Calendario']].map(([v,l]) => (
            <Btn key={v} small variant={tab === v ? 'primary' : 'ghost'} onClick={() => setTab(v)}>{l}</Btn>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
        ) : proyectos.length === 0 ? (
          <div style={{ textAlign:'center', padding:64, border:'1px dashed var(--z-border)', borderRadius:'var(--z-radius-xl)', color:'var(--z-text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔨</div>
            <p>No hay trabajos en producción actualmente</p>
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:20 }}>
              <KpiCard label="En taller" value={proyectos.length} />
              <KpiCard label="Valor en producción" value={fmt(valorEnTaller)} accent />
              <KpiCard label="Con retraso" value={conRetraso} detail={conRetraso > 0 ? 'requieren atención' : 'todo en fecha'} />
            </div>

            {tab === 'lista' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
                {proyectos.map(p => {
                  const dias = diasRestantes(p.fecha_entrega_estimada)
                  return (
                    <Card key={p.id} style={{ cursor:'pointer', transition:'var(--z-transition)' }}>
                      <div onClick={() => setSeleccionado(p)}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                          <div>
                            <div style={{ fontWeight:600, fontSize:14.5, color:'var(--z-text)' }}>{p.clientes?.nombre || 'Sin nombre'}</div>
                            <div style={{ fontSize:12.5, color:'var(--z-text-2)', textTransform:'capitalize', marginTop:2 }}>{p.tipo_trabajo || p.descripcion || '—'}</div>
                          </div>
                          <Badge value="en_fabricacion" />
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
                          <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--z-success)' }}>{fmt(p.valor_final || p.valor_estimado)}</span>
                          <RiskChip dias={dias} />
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}

            {tab === 'gantt' && <GanttView proyectos={proyectos} otPorProyecto={otPorProyecto} onSeleccionar={setSeleccionado} />}
            {tab === 'calendario' && <CalendarioView proyectos={proyectos} mes={mesCalendario} setMes={setMesCalendario} onSeleccionar={setSeleccionado} />}

            {/* ── Footer stat strip: activas / a tiempo / con retraso (derivado, sin datos nuevos) ── */}
            <div style={{
              marginTop:24, padding:'14px 22px', display:'flex', gap:32, alignItems:'center', flexWrap:'wrap',
              background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:'var(--radius-lg)',
            }}>
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.12em' }}>Órdenes activas</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:700, color:'var(--z-text)' }}>{proyectos.length}</span>
              </div>
              <div style={{ width:1, height:28, background:'var(--z-border)' }} />
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.12em' }}>Tasa a tiempo</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:700, color: pctATiempo >= 80 ? 'var(--z-success)' : pctATiempo >= 50 ? 'var(--z-warning)' : 'var(--z-error)' }}>{pctATiempo}%</span>
              </div>
              <div style={{ width:1, height:28, background:'var(--z-border)' }} />
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.12em' }}>Con retraso</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:700, color: conRetraso > 0 ? 'var(--z-error)' : 'var(--z-text)' }}>{conRetraso}</span>
              </div>
            </div>
          </>
        )}
      </PageContent>

      {seleccionado && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }} onClick={() => setSeleccionado(null)}>
          <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-xl)', padding:28, width:440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
              <div>
                <h2 style={{ margin:0, fontSize:18 }}>{seleccionado.clientes?.nombre || 'Sin nombre'}</h2>
                <div style={{ fontSize:12, color:'var(--z-text-3)', textTransform:'capitalize', marginTop:2 }}>{seleccionado.tipo_trabajo || seleccionado.descripcion || '—'}</div>
              </div>
              <button onClick={() => setSeleccionado(null)} style={{ background:'none', border:'none', color:'var(--z-text-3)', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, margin:'14px 0 16px' }}>
              <KpiCard label="Valor" value={fmt(seleccionado.valor_final || seleccionado.valor_estimado)} />
              <KpiCard label="Entrega estimada" value={fechaFmt(seleccionado.fecha_entrega_estimada)} />
            </div>

            {(seleccionado.clientes?.telefono || seleccionado.clientes?.email) && (
              <div style={{ fontSize:12, color:'var(--z-text-2)', marginBottom:16, display:'flex', gap:14 }}>
                {seleccionado.clientes?.telefono && <span>📞 {seleccionado.clientes.telefono}</span>}
                {seleccionado.clientes?.email && <span>✉️ {seleccionado.clientes.email}</span>}
              </div>
            )}

            {seleccionado.fecha_inicio_fabricacion && (
              <div style={{ fontSize:12.5, color:'var(--z-text-2)', marginBottom:18 }}>
                En fabricación desde {fechaFmt(seleccionado.fecha_inicio_fabricacion)}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <Btn onClick={() => marcarEntregado(seleccionado)} disabled={guardando}>{guardando ? 'Guardando...' : 'Marcar entregado'}</Btn>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ─── Gantt ──────────────────────────────────────────────────────────────────
// Escala simple de 8 semanas. Cada fila es un proyecto: barra de fabricacion +
// tramos de instalacion al final (si estan cargados). Si no hay horas cargadas
// todavia, se muestra una barra unica de "en fabricacion" sin split.
// (Matemática de posicionamiento sin tocar — solo se agregan grid de fondo y
// marcador de "hoy" como capas puramente visuales sobre los mismos valores.)
function GanttView({ proyectos, otPorProyecto, onSeleccionar }) {
  const inicio = new Date(); inicio.setHours(0,0,0,0); inicio.setDate(inicio.getDate() - inicio.getDay() + 1)
  const totalDias = 56 // 8 semanas
  const fin = new Date(inicio); fin.setDate(fin.getDate() + totalDias)

  function pos(fecha) {
    const d = (new Date(fecha) - inicio) / 86400000
    return Math.max(0, Math.min(100, (d / totalDias) * 100))
  }

  const xHoy = pos(new Date())

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--z-text-muted)', marginBottom:8, padding:'0 4px' }}>
        <span>{inicio.toLocaleDateString('es-AR')}</span>
        <span>8 semanas →</span>
        <span>{fin.toLocaleDateString('es-AR')}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {proyectos.map(p => {
          const ot = otPorProyecto[p.id]
          const desde = p.fecha_inicio_fabricacion || new Date().toISOString().slice(0,10)
          const hasta = p.fecha_entrega_estimada || desde
          const hf = Number(ot?.horas_fabricacion_estimadas || 0)
          const hi = Number(ot?.horas_instalacion_estimadas || 0)
          const totalH = hf + hi
          const pctFab = totalH > 0 ? hf / totalH : 0.8
          const x1 = pos(desde), x2 = pos(hasta)
          const xSplit = x1 + (x2 - x1) * pctFab
          const tramos = ot?.tramos_instalacion
          return (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={() => onSeleccionar(p)}>
              <div style={{ width:150, flexShrink:0, fontSize:12.5, color:'var(--z-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {p.clientes?.nombre || 'Sin nombre'}
              </div>
              <div style={{
                flex:1, position:'relative', height:22, background:'var(--z-bg-2)', borderRadius:6, border:'1px solid var(--z-border)',
                backgroundImage:'repeating-linear-gradient(to right, var(--z-border) 0, var(--z-border) 1px, transparent 1px, transparent 12.5%)',
              }}>
                <div style={{ position:'absolute', left:`${xHoy}%`, top:-2, bottom:-2, width:1, background:'var(--z-primary)', boxShadow:'0 0 6px rgba(172,210,146,0.5)' }} />
                <div title={`Fabricación: ${hf || '—'}h`} style={{
                  position:'absolute', left:`${x1}%`, width:`${Math.max(1,xSplit-x1)}%`, top:2, bottom:2,
                  background:'var(--z-primary)', borderRadius:4,
                }} />
                <div title={`Instalación: ${hi || '—'}h${tramos ? ` en ${tramos.length} tramos` : ''}`} style={{
                  position:'absolute', left:`${xSplit}%`, width:`${Math.max(1,x2-xSplit)}%`, top:2, bottom:2,
                  background:'var(--z-secondary)', borderRadius:4,
                }} />
              </div>
              <div style={{ width:70, flexShrink:0, fontSize:11, fontFamily:'var(--font-mono)', color:'var(--z-text-muted)', textAlign:'right' }}>{fechaFmt(hasta)}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:16, marginTop:16, fontSize:11, color:'var(--z-text-muted)' }}>
        <span><span style={{ display:'inline-block', width:10, height:10, background:'var(--z-primary)', borderRadius:2, marginRight:5 }} />Fabricación</span>
        <span><span style={{ display:'inline-block', width:10, height:10, background:'var(--z-secondary)', borderRadius:2, marginRight:5 }} />Instalación</span>
        <span><span style={{ display:'inline-block', width:2, height:10, background:'var(--z-primary)', marginRight:5, verticalAlign:'middle' }} />Hoy</span>
        <span>Sin horas cargadas todavía: la barra usa una proporción por defecto (80/20).</span>
      </div>
    </div>
  )
}

// ─── Calendario ─────────────────────────────────────────────────────────────
function CalendarioView({ proyectos, mes, setMes, onSeleccionar }) {
  const anio = mes.getFullYear(), mesIdx = mes.getMonth()
  const primerDia = new Date(anio, mesIdx, 1)
  const ultimoDia = new Date(anio, mesIdx + 1, 0)
  const offset = (primerDia.getDay() + 6) % 7 // lunes=0
  const dias = []
  for (let i = 0; i < offset; i++) dias.push(null)
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(anio, mesIdx, d))

  const porDia = useMemo(() => {
    const map = {}
    for (const p of proyectos) {
      if (!p.fecha_entrega_estimada) continue
      const key = p.fecha_entrega_estimada.slice(0,10)
      ;(map[key] ||= []).push(p)
    }
    return map
  }, [proyectos])

  function cambiarMes(delta) {
    const d = new Date(mes); d.setMonth(d.getMonth() + delta); setMes(d)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:14 }}>
        <button onClick={() => cambiarMes(-1)} style={{ background:'none', border:'1px solid var(--z-border)', borderRadius:8, color:'var(--z-text-2)', cursor:'pointer', padding:'4px 10px' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--z-text)', minWidth:160, textAlign:'center' }}>{MESES[mesIdx]} {anio}</div>
        <button onClick={() => cambiarMes(1)} style={{ background:'none', border:'1px solid var(--z-border)', borderRadius:8, color:'var(--z-text-2)', cursor:'pointer', padding:'4px 10px' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginBottom:6 }}>
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--z-text-muted)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.06em' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
        {dias.map((d, i) => {
          if (!d) return <div key={i} />
          const key = d.toISOString().slice(0,10)
          const entregas = porDia[key] || []
          const hoy = key === new Date().toISOString().slice(0,10)
          return (
            <div key={i} style={{
              minHeight:74, borderRadius:8, border: hoy ? '1px solid var(--z-primary)' : '1px solid var(--z-border)',
              background: entregas.length > 0 ? 'var(--z-primary-glow)' : 'var(--z-card)', padding:6,
            }}>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color: hoy ? 'var(--z-primary-light)' : 'var(--z-text-muted)', marginBottom:4 }}>{d.getDate()}</div>
              {entregas.slice(0,2).map(p => (
                <div key={p.id} onClick={() => onSeleccionar(p)} style={{
                  fontSize:10, color:'var(--z-text)', background:'var(--z-card)', borderRadius:4, padding:'2px 5px',
                  marginBottom:2, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>
                  {p.clientes?.nombre || 'Sin nombre'}
                </div>
              ))}
              {entregas.length > 2 && <div style={{ fontSize:9, color:'var(--z-text-muted)' }}>+{entregas.length-2} más</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
