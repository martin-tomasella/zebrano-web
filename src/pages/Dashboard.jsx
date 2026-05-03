import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { KpiCard, SectionTitle, Table, Badge, Avatar, Spinner } from '../components/ui'

const fmt  = n => n ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fmtM = n => n ? '$' + (Math.round(n/1000)).toLocaleString('es-AR') + 'k' : '—'

export default function Dashboard() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: proyectos }, { data: clientes }, { data: opps }] = await Promise.all([
      supabase.from('proyectos').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id'),
      supabase.from('oportunidades').select('*, clientes(nombre)').order('fecha_seguimiento'),
    ])
    setData({ proyectos: proyectos || [], clientes: clientes || [], opps: opps || [] })
    setLoading(false)
  }

  if (loading) return <Layout><Topbar title="Dashboard" subtitle="Resumen general" /><Spinner /></Layout>

  const { proyectos, clientes, opps } = data
  const activos    = proyectos.filter(p => p.estado === 'en_produccion')
  const entregados = proyectos.filter(p => p.estado === 'entregado')
  const facturado  = entregados.reduce((s, p) => s + (p.valor_final || 0), 0)
  const pipeline   = opps.filter(o => ['lead','contactado','cotizando','propuesta_enviada'].includes(o.estado_funnel))
                         .reduce((s, o) => s + (o.valor_estimado || 0), 0)
  const hoy = new Date().toISOString().slice(0,10)
  const seguimientos = opps.filter(o => o.fecha_seguimiento && o.fecha_seguimiento <= hoy && ['lead','contactado','cotizando','propuesta_enviada'].includes(o.estado_funnel))

  const proyColums = [
    { label:'Cliente', render: r => <div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={r.clientes?.nombre} size={26}/>{r.clientes?.nombre}</div> },
    { label:'Trabajo', key:'nombre', render: r => <span style={{color:'var(--z-muted)',fontSize:12}}>{r.nombre}</span> },
    { label:'Estado',  render: r => <Badge value={r.estado} /> },
    { label:'Entrega', key:'fecha_entrega_estimada', render: r => <span style={{color:'var(--z-hint)',fontSize:12}}>{r.fecha_entrega_estimada || '—'}</span> },
    { label:'Valor',   render: r => <strong>{fmt(r.valor_final)}</strong> },
  ]

  const segCols = [
    { label:'Prospecto', render: r => <strong>{r.nombre_prospecto || r.clientes?.nombre || '—'}</strong> },
    { label:'Trabajo',   key:'tipo_trabajo', render: r => <span style={{color:'var(--z-muted)'}}>{r.tipo_trabajo}</span> },
    { label:'Valor',     render: r => <strong>{fmt(r.valor_estimado)}</strong> },
    { label:'Temp.',     render: r => <Badge value={r.temperatura} /> },
    { label:'Seguimiento', render: r => <span style={{color:'var(--z-hint)',fontSize:12}}>{r.fecha_seguimiento}</span> },
  ]

  return (
    <Layout>
      <Topbar title="Dashboard" subtitle={new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})} />
      <PageContent>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12, marginBottom:24 }}>
          <KpiCard label="Proyectos activos" value={activos.length} detail="en producción" accent />
          <KpiCard label="Facturado"         value={fmtM(facturado)} detail="trabajos entregados" />
          <KpiCard label="Pipeline"          value={fmtM(pipeline)}  detail="cotizaciones abiertas" />
          <KpiCard label="Clientes"          value={clientes.length} detail="en base de datos" />
        </div>

        <div style={{ marginBottom:20 }}>
          <SectionTitle>Proyectos en producción</SectionTitle>
          <Table cols={proyColums} rows={activos} empty="No hay proyectos activos" />
        </div>

        <div>
          <SectionTitle>Seguimientos pendientes</SectionTitle>
          <Table cols={segCols} rows={seguimientos} empty="No hay seguimientos para hoy" />
        </div>
      </PageContent>
    </Layout>
  )
}
