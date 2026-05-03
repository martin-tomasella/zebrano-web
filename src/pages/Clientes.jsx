import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Table, Badge, Avatar, Spinner } from '../components/ui'

const fmt = n => n ? '$' + Math.round(n).toLocaleString('es-AR') : '—'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('clientes').select('*').order('created_at'),
      supabase.from('proyectos').select('cliente_id, valor_final, estado'),
    ])
    setClientes(c || [])
    setProyectos(p || [])
    setLoading(false)
  }

  const cols = [
    { label:'Cliente', render: r => <div style={{display:'flex',alignItems:'center',gap:10}}><Avatar name={r.nombre} size={30}/><div><div style={{fontWeight:500}}>{r.nombre}</div>{r.email && <div style={{fontSize:11,color:'var(--z-hint)'}}>{r.email}</div>}</div></div> },
    { label:'Teléfono', render: r => <span style={{color:'var(--z-muted)',fontSize:12}}>{r.telefono || '—'}</span> },
    { label:'Origen', render: r => <Badge value={r.origen_lead || 'otro'} /> },
    { label:'Proyectos', render: r => {
      const ps = proyectos.filter(p => p.cliente_id === r.id)
      return <span style={{color:'var(--z-muted)'}}>{ps.length} {ps.length===1?'proyecto':'proyectos'}</span>
    }},
    { label:'Facturado', render: r => {
      const total = proyectos.filter(p => p.cliente_id === r.id && p.estado === 'entregado').reduce((s,p)=>s+(p.valor_final||0),0)
      return <strong>{fmt(total) || '—'}</strong>
    }},
    { label:'Estado', render: r => <Badge value={r.activo ? 'aprobado' : 'cancelado'} /> },
  ]

  return (
    <Layout>
      <Topbar title="Clientes" subtitle={`${clientes.length} clientes en base`} />
      <PageContent>
        {loading ? <Spinner /> : <Table cols={cols} rows={clientes} empty="Sin clientes registrados" />}
      </PageContent>
    </Layout>
  )
}
