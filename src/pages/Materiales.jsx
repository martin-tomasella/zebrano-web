
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, KpiCard, SectionTitle, Table, Spinner, Btn, Input } from '../components/ui'

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'

export default function Materiales() {
  const [tab, setTab] = useState('materiales')
  const [materiales, setMateriales] = useState([])
  const [herrajes, setHerrajes] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formMat, setFormMat] = useState({ nombre:'', tipo:'', espesor_mm:'', descripcion:'', unidad:'', precio_unitario:'', proveedor_id:'' })
  const [formHer, setFormHer] = useState({ nombre:'', categoria:'', marca:'', descripcion:'', precio_unitario:'', stock_actual:'', proveedor_id:'' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: m }, { data: h }, { data: p }] = await Promise.all([
      supabase.from('catalogo_materiales').select('*, proveedores(nombre)').eq('activo', true).order('nombre'),
      supabase.from('catalogo_herrajes').select('*, proveedores(nombre)').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id,nombre').eq('activo', true).order('nombre'),
    ])
    setMateriales(m || [])
    setHerrajes(h || [])
    setProveedores(p || [])
    setLoading(false)
  }

  async function crearMaterial(e) {
    e.preventDefault()
    if (!formMat.nombre || !formMat.unidad) return
    setSaving(true)
    await supabase.from('catalogo_materiales').insert({
      nombre: formMat.nombre,
      tipo: formMat.tipo || null,
      espesor_mm: formMat.espesor_mm ? Number(formMat.espesor_mm) : null,
      descripcion: formMat.descripcion || null,
      unidad: formMat.unidad,
      precio_unitario: formMat.precio_unitario ? Number(formMat.precio_unitario) : null,
      proveedor_id: formMat.proveedor_id || null,
      activo: true,
    })
    setFormMat({ nombre:'', tipo:'', espesor_mm:'', descripcion:'', unidad:'', precio_unitario:'', proveedor_id:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function crearHerraje(e) {
    e.preventDefault()
    if (!formHer.nombre) return
    setSaving(true)
    await supabase.from('catalogo_herrajes').insert({
      nombre: formHer.nombre,
      categoria: formHer.categoria || null,
      marca: formHer.marca || null,
      descripcion: formHer.descripcion || null,
      precio_unitario: formHer.precio_unitario ? Number(formHer.precio_unitario) : null,
      stock_actual: formHer.stock_actual ? Number(formHer.stock_actual) : 0,
      proveedor_id: formHer.proveedor_id || null,
      activo: true,
    })
    setFormHer({ nombre:'', categoria:'', marca:'', descripcion:'', precio_unitario:'', stock_actual:'', proveedor_id:'' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const valorInventarioHerrajes = herrajes.reduce((s, h) => s + Number(h.precio_unitario || 0) * Number(h.stock_actual || 0), 0)

  return (
    <Layout>
      <Topbar
        title="Materiales e insumos"
        subtitle={`${materiales.length} materiales · ${herrajes.length} herrajes`}
        actions={<Btn small onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancelar' : (tab === 'materiales' ? '+ Material' : '+ Herraje')}</Btn>}
      />
      <PageContent>
        {loading ? <Spinner /> : <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:20 }}>
            <KpiCard label="Materiales activos" value={materiales.length} accent />
            <KpiCard label="Herrajes activos" value={herrajes.length} />
            <KpiCard label="Valor stock herrajes" value={fmt(valorInventarioHerrajes)} />
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <Btn small variant={tab === 'materiales' ? 'primary' : 'ghost'} onClick={() => { setTab('materiales'); setShowForm(false) }}>Materiales</Btn>
            <Btn small variant={tab === 'herrajes' ? 'primary' : 'ghost'} onClick={() => { setTab('herrajes'); setShowForm(false) }}>Herrajes</Btn>
          </div>

          {showForm && tab === 'materiales' && (
            <Card style={{ marginBottom:20 }}>
              <form onSubmit={crearMaterial}>
                <Input label="Nombre" value={formMat.nombre} onChange={e => setFormMat({...formMat, nombre:e.target.value})} required />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                  <Input label="Tipo" value={formMat.tipo} onChange={e => setFormMat({...formMat, tipo:e.target.value})} />
                  <Input label="Espesor (mm)" type="number" value={formMat.espesor_mm} onChange={e => setFormMat({...formMat, espesor_mm:e.target.value})} />
                  <Input label="Unidad" value={formMat.unidad} onChange={e => setFormMat({...formMat, unidad:e.target.value})} required placeholder="m2, unidad, kg..." />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <Input label="Precio unitario" type="number" value={formMat.precio_unitario} onChange={e => setFormMat({...formMat, precio_unitario:e.target.value})} />
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Proveedor</label>
                    <select value={formMat.proveedor_id} onChange={e => setFormMat({...formMat, proveedor_id:e.target.value})}>
                      <option value="">Sin asignar</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <Input label="Descripción" value={formMat.descripcion} onChange={e => setFormMat({...formMat, descripcion:e.target.value})} />
                <Btn onClick={crearMaterial} disabled={saving}>{saving ? 'Guardando...' : 'Guardar material'}</Btn>
              </form>
            </Card>
          )}

          {showForm && tab === 'herrajes' && (
            <Card style={{ marginBottom:20 }}>
              <form onSubmit={crearHerraje}>
                <Input label="Nombre" value={formHer.nombre} onChange={e => setFormHer({...formHer, nombre:e.target.value})} required />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <Input label="Categoría" value={formHer.categoria} onChange={e => setFormHer({...formHer, categoria:e.target.value})} placeholder="Bisagras, tiradores, rieles..." />
                  <Input label="Marca" value={formHer.marca} onChange={e => setFormHer({...formHer, marca:e.target.value})} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                  <Input label="Precio unitario" type="number" value={formHer.precio_unitario} onChange={e => setFormHer({...formHer, precio_unitario:e.target.value})} />
                  <Input label="Stock actual" type="number" value={formHer.stock_actual} onChange={e => setFormHer({...formHer, stock_actual:e.target.value})} />
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Proveedor</label>
                    <select value={formHer.proveedor_id} onChange={e => setFormHer({...formHer, proveedor_id:e.target.value})}>
                      <option value="">Sin asignar</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <Input label="Descripción" value={formHer.descripcion} onChange={e => setFormHer({...formHer, descripcion:e.target.value})} />
                <Btn onClick={crearHerraje} disabled={saving}>{saving ? 'Guardando...' : 'Guardar herraje'}</Btn>
              </form>
            </Card>
          )}

          {tab === 'materiales' ? (
            <>
              <SectionTitle>Catálogo de materiales</SectionTitle>
              <Table
                cols={[
                  { key:'nombre', label:'Nombre' },
                  { key:'tipo', label:'Tipo', render:r => r.tipo || '—' },
                  { key:'espesor_mm', label:'Espesor', render:r => r.espesor_mm ? `${r.espesor_mm}mm` : '—' },
                  { key:'unidad', label:'Unidad' },
                  { key:'precio_unitario', label:'Precio unit.', render:r => fmt(r.precio_unitario) },
                  { key:'proveedor', label:'Proveedor', render:r => r.proveedores?.nombre || '—' },
                ]}
                rows={materiales}
                empty="Sin materiales registrados"
              />
            </>
          ) : (
            <>
              <SectionTitle>Catálogo de herrajes</SectionTitle>
              <Table
                cols={[
                  { key:'nombre', label:'Nombre' },
                  { key:'categoria', label:'Categoría', render:r => r.categoria || '—' },
                  { key:'marca', label:'Marca', render:r => r.marca || '—' },
                  { key:'precio_unitario', label:'Precio unit.', render:r => fmt(r.precio_unitario) },
                  { key:'stock_actual', label:'Stock', render:r => r.stock_actual ?? 0 },
                  { key:'proveedor', label:'Proveedor', render:r => r.proveedores?.nombre || '—' },
                ]}
                rows={herrajes}
                empty="Sin herrajes registrados"
              />
            </>
          )}
        </>}
      </PageContent>
    </Layout>
  )
}
