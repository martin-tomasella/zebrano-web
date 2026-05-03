import React, { useEffect, useState } from 'react'
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
  const [opps, setOpps]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

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
                      <div key={o.id} style={{
                        background:'#fff', border:'0.5px solid var(--z-border)',
                        borderRadius:'var(--radius-md)', padding:'10px 12px',
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
    </Layout>
  )
}
