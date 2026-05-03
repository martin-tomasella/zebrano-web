import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Table, Badge, Avatar, Spinner, SectionTitle } from '../components/ui'

const fmt = n => n ? '$' + Math.round(n).toLocaleString('es-AR') : '—'

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtro, setFiltro]       = useState('todos')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre)')
      .order('created_at', { ascending: false })
    setProyectos(data || [])
    setLoading(false)
  }

  const ESTADOS = ['todos','en_produccion','propuesta_enviada','cotizando','entregado','cancelado']
  const filtrados = filtro === 'todos' ? proyectos : proyectos.filter(p => p.estado === filtro)

  const cols = [
    { label:'#', render: (_,i) => <span style={{color:'var(--z-hint)',fontSize:11,fontFamily:'var(--font-mono)'}}>{'#'+String(i+1).padStart(2,'0')}</span> },
    { label:'Cliente', render: r => <div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={r.clientes?.nombre} size={26}/><strong>{r.clientes?.nombre}</strong></div> },
    { label:'Proyecto', render: r => <span style={{color:'var(--z-muted)',fontSize:12}}>{r.nombre}</span> },
    { label:'Tipo', render: r => <Badge value={r.tipo_trabajo} /> },
    { label:'Estado', render: r => <Badge value={r.estado} /> },
    { label:'Entrega', render: r => <span style={{color:'var(--z-hint)',fontSize:12}}>{r.fecha_entrega_estimada || '—'}</span> },
    { label:'Valor', render: r => <strong>{fmt(r.valor_final)}</strong> },
  ]

  return (
    <Layout>
      <Topbar title="Proyectos" subtitle={`${proyectos.length} trabajos registrados`} />
      <PageContent>
        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          {ESTADOS.map(e => (
            <button key={e} onClick={() => setFiltro(e)} style={{
              padding:'5px 12px', borderRadius:99, fontSize:12, cursor:'pointer',
              background: filtro===e ? 'var(--z-green)' : '#fff',
              color: filtro===e ? '#fff' : 'var(--z-muted)',
              border: filtro===e ? 'none' : '0.5px solid var(--z-border)',
              fontWeight: filtro===e ? 500 : 400,
            }}>
              {e === 'todos' ? 'Todos' : e.replace('_',' ')}
            </button>
          ))}
        </div>
        {loading ? <Spinner /> : <Table cols={cols} rows={filtrados.map((r,i) => ({...r, _i:i}))} empty="Sin proyectos" />}
      </PageContent>
    </Layout>
  )
}
