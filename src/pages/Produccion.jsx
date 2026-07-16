
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, KpiCard, Btn, Badge } from '../components/ui'

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—'

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

export default function Produccion() {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre, telefono, email)')
      .eq('estado', 'en_fabricacion')
      .order('fecha_entrega_estimada')
    if (error) console.error('Error cargando produccion:', error)
    setProyectos(data || [])
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

  const conRetraso = proyectos.filter(p => { const d = diasRestantes(p.fecha_entrega_estimada); return d !== null && d < 0 }).length
  const valorEnTaller = proyectos.reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0)

  return (
    <Layout>
      <Topbar title="Producción" subtitle={`${proyectos.length} trabajos en taller${conRetraso > 0 ? ` · ${conRetraso} con retraso` : ''}`} />
      <PageContent>
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
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
              {proyectos.map(p => {
                const dias = diasRestantes(p.fecha_entrega_estimada)
                const color = colorDias(dias)
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
                        <span style={{ fontSize:12, color:'var(--z-success)' }}>{fmt(p.valor_final || p.valor_estimado)}</span>
                        {dias !== null && (
                          <span style={{ fontSize:11.5, fontWeight:600, color }}>
                            {dias < 0 ? `${Math.abs(dias)}d retraso` : dias === 0 ? 'Entrega hoy' : `${dias}d restantes`}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
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
