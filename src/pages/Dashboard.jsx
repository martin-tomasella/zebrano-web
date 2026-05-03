import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { KpiCard, SectionTitle, Table, Badge, Avatar, Spinner } from '../components/ui'

const fmt  = n => n ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fmtM = n => n ? '$' + Math.round(n/1000).toLocaleString('es-AR') + 'k' : '—'

function HeroBanner({ profile, activos }) {
  const hour = new Date().getHours()
  const greeting = hour < 13 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = profile?.nombre?.split(' ')[0] || 'Martín'
  const hoy = new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })

  return (
    <div style={{ position:'relative', height:160, overflow:'hidden', flexShrink:0, background:'#080B06', borderBottom:'1px solid rgba(74,107,54,0.1)' }}>
      <svg style={{ position:'absolute', right:0, top:0, opacity:0.09 }} width="360" height="160" viewBox="0 0 360 160">
        <filter id="wf"><feTurbulence type="fractalNoise" baseFrequency="0.015 0.5" numOctaves="4" seed="5"/><feColorMatrix type="saturate" values="0.2"/></filter>
        <rect width="360" height="160" filter="url(#wf)" fill="#5C3D1E"/>
      </svg>
      <svg style={{ position:'absolute', right:0, bottom:0, opacity:0.13 }} width="300" height="160" viewBox="0 0 300 160">
        <g fill="#1E3014">
          <polygon points="200,5 150,80 250,80"/>
          <polygon points="200,30 140,105 260,105"/>
          <polygon points="200,55 130,135 270,135"/>
          <rect x="188" y="128" width="24" height="32"/>
          <polygon points="60,10 20,80 100,80"/>
          <polygon points="60,35 15,105 105,105"/>
          <rect x="50" y="100" width="20" height="30"/>
          <polygon points="280,0 250,60 310,60"/>
          <polygon points="280,25 245,85 315,85"/>
          <rect x="272" y="80" width="16" height="25"/>
        </g>
      </svg>
      <div style={{ position:'relative', zIndex:2, padding:'28px 24px' }}>
        <div style={{ fontSize:9, color:'#2E4A22', letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:8 }}>
          sistema de gestión · zebrano m+a
        </div>
        <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:26, fontWeight:300, color:'#E8DFD0', fontStyle:'italic', lineHeight:1.2 }}>
          {greeting}, <span style={{ color:'#7AAE5A', fontStyle:'normal' }}>{nombre}.</span>
        </div>
        <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:14, color:'#3A5030', marginTop:4 }}>
          {activos} {activos === 1 ? 'trabajo en taller' : 'trabajos en taller'} · {hoy}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: proyectos }, { data: clientes }, { data: opps }] = await Promise.all([
      supabase.from('proyectos').select('*, clientes(nombre)').order('created_at', { ascending:false }),
      supabase.from('clientes').select('id'),
      supabase.from('oportunidades').select('*, clientes(nombre)').order('fecha_seguimiento'),
    ])
    setData({ proyectos: proyectos||[], clientes: clientes||[], opps: opps||[] })
    setLoading(false)
  }

  if (loading) return <Layout><div style={{ height:160, background:'#080B06', borderBottom:'1px solid rgba(74,107,54,0.1)' }}/><Spinner/></Layout>

  const { proyectos, clientes, opps } = data
  const activos    = proyectos.filter(p => p.estado==='en_produccion')
  const entregados = proyectos.filter(p => p.estado==='entregado')
  const facturado  = entregados.reduce((s,p) => s+(p.valor_final||0), 0)
  const pipeline   = opps.filter(o => ['lead','contactado','cotizando','propuesta_enviada'].includes(o.estado_funnel)).reduce((s,o) => s+(o.valor_estimado||0), 0)
  const hoy = new Date().toISOString().slice(0,10)
  const seguimientos = opps.filter(o => o.fecha_seguimiento && o.fecha_seguimiento<=hoy && ['lead','contactado','cotizando','propuesta_enviada'].includes(o.estado_funnel))

  const proyCols = [
    { label:'Cliente', render: r => <div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={r.clientes?.nombre} size={24}/><span style={{color:'#C8D9B8'}}>{r.clientes?.nombre}</span></div> },
    { label:'Trabajo',  render: r => <span style={{color:'#3A5030',fontSize:11}}>{r.nombre}</span> },
    { label:'Estado',   render: r => <Badge value={r.estado}/> },
    { label:'Entrega',  render: r => <span style={{color:'#2E4A22',fontSize:11}}>{r.fecha_entrega_estimada||'—'}</span> },
    { label:'Valor',    render: r => <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:'#7AAE5A'}}>{fmt(r.valor_final)}</span> },
  ]

  const segCols = [
    { label:'Prospecto', render: r => <strong style={{color:'#C8D9B8',fontWeight:400}}>{r.nombre_prospecto||r.clientes?.nombre||'—'}</strong> },
    { label:'Trabajo',   render: r => <span style={{color:'#3A5030'}}>{r.tipo_trabajo}</span> },
    { label:'Valor',     render: r => <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:'#7AAE5A'}}>{fmt(r.valor_estimado)}</span> },
    { label:'Temp.',     render: r => <Badge value={r.temperatura}/> },
    { label:'Seguimiento', render: r => <span style={{color:'#2E4A22',fontSize:11}}>{r.fecha_seguimiento}</span> },
  ]

  return (
    <Layout>
      <HeroBanner profile={profile} activos={activos.length} />
      <PageContent>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:22 }}>
          <KpiCard label="En producción" value={activos.length} detail="proyectos activos" accent />
          <KpiCard label="Facturado"     value={fmtM(facturado)} detail="trabajos entregados" />
          <KpiCard label="Pipeline"      value={fmtM(pipeline)}  detail="cotizaciones abiertas" />
          <KpiCard label="Clientes"      value={clientes.length} detail="en base de datos" />
        </div>
        <div style={{ marginBottom:20 }}>
          <SectionTitle>proyectos en producción</SectionTitle>
          <Table cols={proyCols} rows={activos} empty="No hay proyectos activos" />
        </div>
        <div>
          <SectionTitle>seguimientos pendientes</SectionTitle>
          <Table cols={segCols} rows={seguimientos} empty="No hay seguimientos para hoy" />
        </div>
      </PageContent>
    </Layout>
  )
}
