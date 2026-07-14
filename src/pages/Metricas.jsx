import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { KpiCard, SectionTitle, Table, Spinner } from '../components/ui'

const dias = n => n != null ? `${Number(n).toFixed(1)} días` : '—'

const ESTADO_LABEL = { prospecto:'Prospecto', cotizado:'Cotizado', sena_pagada:'Seña pagada', en_fabricacion:'En fabricación', entregado:'Entregado', cancelado:'Cancelado' }

export default function Metricas() {
  const [promedio, setPromedio] = useState(null)
  const [detalle, setDetalle] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: prom, error: e1 }, { data: det, error: e2 }] = await Promise.all([
      supabase.rpc('v_tiempos_ciclo_promedio'),
      supabase.rpc('v_tiempos_ciclo_proyectos'),
    ])
    if (e1 || e2) setError((e1 || e2).message)
    setPromedio(prom?.[0] || null)
    setDetalle(det || [])
    setLoading(false)
  }

  return (
    <Layout>
      <Topbar title="Tiempos de ciclo" subtitle="Cotización → seña → fabricación → entrega" />
      <PageContent>
        {loading ? <Spinner /> : error ? (
          <div style={{ textAlign:'center', padding:64, border:'1px dashed var(--z-border)', borderRadius:'var(--z-radius-xl)', color:'var(--z-text-muted)' }}>
            <p>No se pudo cargar la métrica: {error}</p>
            <p style={{ fontSize:12, marginTop:8 }}>Esta vista requiere permisos de admin o taller.</p>
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,minmax(0,1fr))', gap:12, marginBottom:24 }}>
              <KpiCard label="Prospecto → Cotizado" value={dias(promedio?.promedio_prospecto_a_cotizado)} />
              <KpiCard label="Cotizado → Seña" value={dias(promedio?.promedio_cotizado_a_sena)} />
              <KpiCard label="Seña → Fabricación" value={dias(promedio?.promedio_sena_a_fabricacion)} />
              <KpiCard label="Fabricación → Entrega" value={dias(promedio?.promedio_fabricacion_a_entrega)} />
              <KpiCard label="Ciclo total promedio" value={dias(promedio?.promedio_total_dias)} detail={`${promedio?.proyectos_completos ?? 0} proyectos completos`} accent />
            </div>

            <SectionTitle>Detalle por proyecto</SectionTitle>
            <Table
              cols={[
                { key:'proyecto', label:'Proyecto', render:r => r.proyecto || '—' },
                { key:'cliente', label:'Cliente', render:r => r.cliente || '—' },
                { key:'estado', label:'Estado', render:r => ESTADO_LABEL[r.estado] || r.estado || '—' },
                { key:'dias_prospecto_a_cotizado', label:'Pros.→Cot.', render:r => r.dias_prospecto_a_cotizado ?? '—' },
                { key:'dias_cotizado_a_sena', label:'Cot.→Seña', render:r => r.dias_cotizado_a_sena ?? '—' },
                { key:'dias_sena_a_fabricacion', label:'Seña→Fab.', render:r => r.dias_sena_a_fabricacion ?? '—' },
                { key:'dias_fabricacion_a_entrega', label:'Fab.→Entrega', render:r => r.dias_fabricacion_a_entrega ?? '—' },
                { key:'dias_totales_prospecto_a_entrega', label:'Total', render:r => (
                  <strong style={{ color:'var(--z-primary-light)' }}>{r.dias_totales_prospecto_a_entrega ?? '—'}</strong>
                ) },
              ]}
              rows={detalle}
              empty="Todavía no hay proyectos con ciclo completo para medir"
            />
          </>
        )}
      </PageContent>
    </Layout>
  )
}
