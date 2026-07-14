import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, KpiCard, SectionTitle, Table, Spinner, Btn, Input } from '../components/ui'

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'

export default function Proveedores() {
  const [tab, setTab] = useState('proveedores')
  const [proveedores, setProveedores] = useState([])
  const [compras, setCompras] = useState([])
  const [materiales, setMateriales] = useState([])
  const [herrajes, setHerrajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formProv, setFormProv] = useState({ nombre:'', contacto:'', telefono:'', email:'' })
  const [formCompra, setFormCompra] = useState({ proveedor_id:'', insumo_tipo:'material', insumo_id:'', cantidad:'', precio_unitario:'', fecha: new Date().toISOString().slice(0,10) })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: c }, { data: m }, { data: h }] = await Promise.all([
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
      supabase.from('compras_insumos').select('*, proveedores(nombre), catalogo_materiales(nombre), catalogo_herrajes(nombre)').order('fecha', { ascending:false }).limit(100),
      supabase.from('catalogo_materiales').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('catalogo_herrajes').select('id,nombre').eq('activo', true).order('nombre'),
    ])
    setProveedores(p || [])
    setCompras(c || [])
    setMateriales(m || [])
    setHerrajes(h || [])
    setLoading(false)
  }

  async function crearProveedor(e) {
    e.preventDefault()
    if (!formProv.nombre) return
    setSaving(true)
    await supabase.from('proveedores').insert(formProv)
    setFormProv({ nombre:'', contacto:'', telefono:'', email:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function crearCompra(e) {
    e.preventDefault()
    if (!formCompra.proveedor_id || !formCompra.insumo_id || !formCompra.cantidad || !formCompra.precio_unitario) return
    setSaving(true)
    const cantidad = Number(formCompra.cantidad)
    const precio_unitario = Number(formCompra.precio_unitario)
    await supabase.from('compras_insumos').insert({
      proveedor_id: formCompra.proveedor_id,
      catalogo_material_id: formCompra.insumo_tipo === 'material' ? formCompra.insumo_id : null,
      catalogo_herraje_id: formCompra.insumo_tipo === 'herraje' ? formCompra.insumo_id : null,
      cantidad,
      precio_unitario,
      precio_total: cantidad * precio_unitario,
      fecha: formCompra.fecha,
    })
    setFormCompra({ proveedor_id:'', insumo_tipo:'material', insumo_id:'', cantidad:'', precio_unitario:'', fecha: new Date().toISOString().slice(0,10) })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const totalComprasMes = compras.filter(c => c.fecha?.slice(0,7) === new Date().toISOString().slice(0,7)).reduce((s,c) => s + Number(c.precio_total || c.cantidad*c.precio_unitario || 0), 0)

  return (
    <Layout>
      <Topbar
        title="Proveedores e insumos"
        subtitle={`${proveedores.length} proveedores activos`}
        actions={<Btn small onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancelar' : (tab === 'proveedores' ? '+ Proveedor' : '+ Compra')}</Btn>}
      />
      <PageContent>
        {loading ? <Spinner /> : <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:20 }}>
            <KpiCard label="Comprado este mes" value={fmt(totalComprasMes)} accent />
            <KpiCard label="Proveedores activos" value={proveedores.length} />
            <KpiCard label="Compras registradas" value={compras.length} detail="últimas 100" />
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <Btn small variant={tab === 'proveedores' ? 'primary' : 'ghost'} onClick={() => { setTab('proveedores'); setShowForm(false) }}>Proveedores</Btn>
            <Btn small variant={tab === 'compras' ? 'primary' : 'ghost'} onClick={() => { setTab('compras'); setShowForm(false) }}>Historial de compras</Btn>
          </div>

          {showForm && tab === 'proveedores' && (
            <Card style={{ marginBottom:20 }}>
              <form onSubmit={crearProveedor}>
                <Input label="Nombre" value={formProv.nombre} onChange={e => setFormProv({...formProv, nombre:e.target.value})} required />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <Input label="Contacto" value={formProv.contacto} onChange={e => setFormProv({...formProv, contacto:e.target.value})} />
                  <Input label="Teléfono" value={formProv.telefono} onChange={e => setFormProv({...formProv, telefono:e.target.value})} />
                </div>
                <Input label="Email" type="email" value={formProv.email} onChange={e => setFormProv({...formProv, email:e.target.value})} />
                <Btn onClick={crearProveedor} disabled={saving}>{saving ? 'Guardando...' : 'Guardar proveedor'}</Btn>
              </form>
            </Card>
          )}

          {showForm && tab === 'compras' && (
            <Card style={{ marginBottom:20 }}>
              <form onSubmit={crearCompra}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Proveedor</label>
                  <select value={formCompra.proveedor_id} onChange={e => setFormCompra({...formCompra, proveedor_id:e.target.value})} required>
                    <option value="">Elegir proveedor...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16 }}>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Tipo</label>
                    <select value={formCompra.insumo_tipo} onChange={e => setFormCompra({...formCompra, insumo_tipo:e.target.value, insumo_id:''})}>
                      <option value="material">Material</option>
                      <option value="herraje">Herraje</option>
                    </select>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Insumo</label>
                    <select value={formCompra.insumo_id} onChange={e => setFormCompra({...formCompra, insumo_id:e.target.value})} required>
                      <option value="">Elegir...</option>
                      {(formCompra.insumo_tipo === 'material' ? materiales : herrajes).map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                  <Input label="Cantidad" type="number" value={formCompra.cantidad} onChange={e => setFormCompra({...formCompra, cantidad:e.target.value})} required />
                  <Input label="Precio unitario" type="number" value={formCompra.precio_unitario} onChange={e => setFormCompra({...formCompra, precio_unitario:e.target.value})} required />
                  <Input label="Fecha" type="date" value={formCompra.fecha} onChange={e => setFormCompra({...formCompra, fecha:e.target.value})} required />
                </div>
                <Btn onClick={crearCompra} disabled={saving}>{saving ? 'Guardando...' : 'Registrar compra'}</Btn>
              </form>
            </Card>
          )}

          {tab === 'proveedores' ? (
            <>
              <SectionTitle>Proveedores</SectionTitle>
              <Table
                cols={[
                  { key:'nombre', label:'Nombre' },
                  { key:'contacto', label:'Contacto', render:r => r.contacto || '—' },
                  { key:'telefono', label:'Teléfono', render:r => r.telefono || '—' },
                  { key:'email', label:'Email', render:r => r.email || '—' },
                ]}
                rows={proveedores}
                empty="Sin proveedores registrados"
              />
            </>
          ) : (
            <>
              <SectionTitle>Historial de compras</SectionTitle>
              <Table
                cols={[
                  { key:'fecha', label:'Fecha' },
                  { key:'proveedor', label:'Proveedor', render:r => r.proveedores?.nombre || '—' },
                  { key:'insumo', label:'Insumo', render:r => r.catalogo_materiales?.nombre || r.catalogo_herrajes?.nombre || '—' },
                  { key:'cantidad', label:'Cantidad' },
                  { key:'precio_unitario', label:'Precio unit.', render:r => fmt(r.precio_unitario) },
                  { key:'precio_total', label:'Total', render:r => fmt(r.precio_total || r.cantidad*r.precio_unitario) },
                ]}
                rows={compras}
                empty="Sin compras registradas"
              />
            </>
          )}
        </>}
      </PageContent>
    </Layout>
  )
}
