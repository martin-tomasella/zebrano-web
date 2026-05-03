import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Badge, Spinner, SectionTitle } from '../components/ui'

export default function Produccion() {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre)')
      .eq('estado', 'en_produccion')
      .order('fecha_entrega_estimada')
    setProyectos(data || [])
    setLoading(false)
  }

  function diasRestantes(fecha) {
    if (!fecha) return null
    const diff = Math.ceil((new Date(fecha) - new Date()) / 86400000)
    return diff
  }

  function barColor(dias) {
    if (dias === null) return '#1D9E75'
    if (dias < 0)  return '#E24B4A'
    if (dias <= 3) return '#EF9F27'
    return '#1D9E75'
  }

  return (
    <Layout>
      <Topbar title="Producción" subtitle={`${proyectos.length} trabajos en taller`} />
      <PageContent>
        {loading ? <Spinner /> : (
          proyectos.length === 0
            ? <div style={{ textAlign:'center', padding:48, color:'var(--z-hint)' }}>No hay trabajos en producción</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {proyectos.map(p => {
                  const dias = diasRestantes(p.fecha_entrega_estimada)
                  const color = barColor(dias)
                  const avance = p.avance_pct || 0
                  return (
                    <div key={p.id} style={{
                      background:'#fff', border:'0.5px solid var(--z-border)',
                      borderRadius:'var(--radius-lg)', padding:'16px 20px',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                        <div>
                          <div style={{ fontWeight:500, fontSize:14 }}>{p.clientes?.nombre}</div>
                          <div style={{ fontSize:12, color:'var(--z-muted)', marginTop:2 }}>{p.nombre}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          {dias !== null && (
                            <div style={{ fontSize:12, fontWeight:500, color }}>
                              {dias < 0 ? `${Math.abs(dias)} días de retraso` : dias === 0 ? 'Entrega hoy' : `${dias} días restantes`}
                            </div>
                          )}
                          <div style={{ fontSize:11, color:'var(--z-hint)', marginTop:2 }}>
                            Entrega: {p.fecha_entrega_estimada || '—'}
                          </div>
                        </div>
                      </div>

                      {/* Barra de avance */}
                      <div style={{ marginBottom:8 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:11, color:'var(--z-muted)' }}>Avance</span>
                          <span style={{ fontSize:11, fontWeight:500, color }}>{avance}%</span>
                        </div>
                        <div style={{ height:6, background:'#F1EFE8', borderRadius:3 }}>
                          <div style={{ height:'100%', width:`${avance}%`, background:color, borderRadius:3, transition:'width 0.3s' }} />
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:6, marginTop:8 }}>
                        <Badge value={p.tipo_trabajo} />
                        {p.valor_final && <span style={{ fontSize:11, color:'var(--z-hint)', alignSelf:'center' }}>${Math.round(p.valor_final).toLocaleString('es-AR')}</span>}
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
