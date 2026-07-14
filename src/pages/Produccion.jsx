
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'

export default function Produccion() {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre,apellido)')
      .eq('estado', 'en_fabricacion')
      .order('fecha_entrega_estimada')
    setProyectos(data || [])
    setLoading(false)
  }

  function diasRestantes(fecha) {
    if (!fecha) return null
    return Math.ceil((new Date(fecha) - new Date()) / 86400000)
  }

  function getColor(dias) {
    if (dias === null) return 'var(--z-success)'
    if (dias < 0)  return 'var(--z-error)'
    if (dias <= 5) return 'var(--z-warning)'
    return 'var(--z-success)'
  }

  return (
    <Layout>
      <Topbar title="Producción" subtitle={`${proyectos.length} trabajos en taller`} />
      <PageContent>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
        ) : proyectos.length === 0 ? (
          <div style={{ textAlign:'center', padding:64, border:'1px dashed var(--z-border)', borderRadius:'var(--z-radius-xl)', color:'var(--z-text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔨</div>
            <p>No hay trabajos en producción actualmente</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {proyectos.map(p => {
              const dias = diasRestantes(p.fecha_entrega_estimada)
              const color = getColor(dias)
              const avance = p.avance_pct || 0
              return (
                <div key={p.id} style={{
                  background:'var(--z-card)',
                  border:'1px solid var(--z-border)',
                  borderRadius:'var(--z-radius-lg)',
                  padding:'18px 22px',
                  transition:'var(--z-transition)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--z-border-hover)'; e.currentTarget.style.boxShadow='var(--z-shadow-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--z-border)'; e.currentTarget.style.boxShadow='none'; }}>
                  {/* Header */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:15, color:'var(--z-text)', marginBottom:3 }}>
                        {p.clientes?.nombre} {p.clientes?.apellido}
                      </div>
                      <div style={{ fontSize:13, color:'var(--z-text-2)' }}>{p.nombre || p.descripcion}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {dias !== null && (
                        <div style={{ fontSize:13, fontWeight:600, color }}>
                          {dias < 0 ? `${Math.abs(dias)} días de retraso` : dias === 0 ? 'Entrega hoy' : `${dias} días restantes`}
                        </div>
                      )}
                      <div style={{ fontSize:12, color:'var(--z-text-3)', marginTop:3 }}>
                        Entrega: {p.fecha_entrega_estimada ? new Date(p.fecha_entrega_estimada).toLocaleDateString('es-AR') : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Barra de avance */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:12, color:'var(--z-text-3)' }}>Avance</span>
                      <span style={{ fontSize:12, fontWeight:600, color }}>{avance}%</span>
                    </div>
                    <div style={{ height:6, background:'rgba(74,107,54,0.1)', borderRadius:20 }}>
                      <div style={{ height:'100%', width:`${avance}%`, background: avance > 0 ? 'var(--z-gradient)' : 'transparent', borderRadius:20, transition:'width 0.4s' }} />
                    </div>
                  </div>

                  {/* Tags */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {p.tipo_trabajo && (
                      <span className="badge" style={{ background:'rgba(74,107,54,0.1)', color:'var(--z-primary-light)', border:'1px solid rgba(74,107,54,0.2)', textTransform:'capitalize' }}>
                        {p.tipo_trabajo}
                      </span>
                    )}
                    {p.valor_final && (
                      <span style={{ fontSize:12, color:'var(--z-success)', alignSelf:'center' }}>
                        ${Math.round(p.valor_final).toLocaleString('es-AR')}
                      </span>
                    )}
                    {p.carpintero && (
                      <span style={{ fontSize:12, color:'var(--z-text-3)', alignSelf:'center' }}>
                        👷 {p.carpintero}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </PageContent>
    </Layout>
  )
}
