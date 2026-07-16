
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, KpiCard, Btn, Input, Spinner } from '../components/ui'

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—'

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [compras, setCompras] = useState([])
  const [materiales, setMateriales] = useState([])
  const [herrajes, setHerrajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [formAbierto, setFormAbierto] = useState(null) // 'proveedor' | 'compra' | null
  const [saving, setSaving] = useState(false)

  const [formProv, setFormProv] = useState({ nombre:'', contacto:'', telefono:'', email:'' })
  const [formCompra, setFormCompra] = useState({ proveedor_id:'', insumo_tipo:'material', insumo_id:'', cantidad:'', precio_unitario:'', fecha: new Date().toISOString().slice(0,10) })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: c }, { data: m }, { data: h }] = await Promise.all([
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
      supabase.from('compras_insumos').select('*, proveedores(nombre), catalogo_materiales(nombre), catalogo_herrajes(nombre)').order('fecha', { ascending:false }).limit(300),
      supabase.from('catalogo_materiales').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('catalogo_herrajes').select('id,nombre').eq('activo', true).order('nombre'),
    ])
    setProveedores(p || [])
    setCompras(c || [])
    setMateriales(m || [])
    setHerrajes(h || [])
    setLoading(false)
  }

  const comprasPorProveedor = useMemo(() => {
    const map = {}
    for (const c of compras) {
      if (!c.proveedor_id) continue
      ;(map[c.proveedor_id] ||= []).push(c)
    }
    return map
  }, [compras])

  async function crearProveedor(e) {
    e.preventDefault()
    if (!formProv.nombre) return
    setSaving(true)
    const { error } = await supabase.from('proveedores').insert(formProv)
    setSaving(false)
    if (error) { alert('No se pudo guardar el proveedor: ' + error.message); return }
    setFormProv({ nombre:'', contacto:'', telefono:'', email:'' })
    setFormAbierto(null)
    load()
  }

  async function crearCompra(e) {
    e.preventDefault()
    if (!formCompra.proveedor_id || !formCompra.insumo_id || !formCompra.cantidad || !formCompra.precio_unitario) return
    setSaving(true)
    const cantidad = Number(formCompra.cantidad)
    const precio_unitario = Number(formCompra.precio_unitario)
    const { error } = await supabase.from('compras_insumos').insert({
      proveedor_id: formCompra.proveedor_id,
      catalogo_material_id: formCompra.insumo_tipo === 'material' ? formCompra.insumo_id : null,
      catalogo_herraje_id: formCompra.insumo_tipo === 'herraje' ? formCompra.insumo_id : null,
      cantidad,
      precio_unitario,
      fecha: formCompra.fecha,
    })
    setSaving(false)
    if (error) { alert('No se pudo registrar la compra: ' + error.message); return }
    setFormCompra({ proveedor_id: seleccionadoId || '', insumo_tipo:'material', insumo_id:'', cantidad:'', precio_unitario:'', fecha: new Date().toISOString().slice(0,10) })
    setFormAbierto(null)
    load()
  }

  const filtrados = proveedores.filter(p => !busqueda || (p.nombre||'').toLowerCase().includes(busqueda.toLowerCase()))
  const seleccionado = proveedores.find(p => p.id === seleccionadoId)
  const comprasSeleccionado = comprasPorProveedor[seleccionadoId] || []

  const mesActual = new Date().toISOString().slice(0,7)
  const totalComprasMes = compras.filter(c => c.fecha?.slice(0,7) === mesActual).reduce((s,c) => s + Number(c.precio_total || c.cantidad*c.precio_unitario || 0), 0)

  function abrirCompra(proveedorId) {
    setFormCompra(f => ({ ...f, proveedor_id: proveedorId || '' }))
    setFormAbierto('compra')
  }

  return (
    <Layout>
      <Topbar
        title="Proveedores e insumos"
        subtitle={`${proveedores.length} proveedores activos`}
        actions={
          <div style={{ display:'flex', gap:8 }}>
            <Btn small variant="ghost" onClick={() => setFormAbierto(v => v === 'proveedor' ? null : 'proveedor')}>{formAbierto === 'proveedor' ? 'Cancelar' : '+ Proveedor'}</Btn>
            <Btn small onClick={() => formAbierto === 'compra' ? setFormAbierto(null) : abrirCompra(seleccionadoId)}>{formAbierto === 'compra' ? 'Cancelar' : '+ Compra'}</Btn>
          </div>
        }
      />
      <PageContent>
        {loading ? <Spinner /> : <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:20 }}>
            <KpiCard label="Comprado este mes" value={fmt(totalComprasMes)} accent />
            <KpiCard label="Proveedores activos" value={proveedores.length} />
            <KpiCard label="Compras registradas" value={compras.length} detail="últimas 300" />
          </div>

          {formAbierto === 'proveedor' && (
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

          {formAbierto === 'compra' && (
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

          <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
            {/* Panel izquierdo: lista de proveedores */}
            <div style={{ width:280, flexShrink:0, background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', overflow:'hidden' }}>
              <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--z-border)' }}>
                <input placeholder="Buscar proveedor..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  style={{ width:'100%', padding:'7px 12px', fontSize:12.5, background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:8, color:'var(--z-text)', outline:'none' }} />
              </div>
              <div style={{ maxHeight:520, overflowY:'auto' }}>
                {filtrados.length === 0 ? (
                  <div style={{ padding:20, fontSize:12.5, color:'var(--z-text-muted)', textAlign:'center' }}>Sin proveedores</div>
                ) : filtrados.map(p => {
                  const compras_p = comprasPorProveedor[p.id] || []
                  const activo = seleccionadoId === p.id
                  return (
                    <div key={p.id} onClick={() => setSeleccionadoId(p.id)} style={{
                      padding:'11px 14px', cursor:'pointer', borderLeft: activo ? '3px solid var(--z-primary)' : '3px solid transparent',
                      background: activo ? 'var(--z-primary-glow)' : 'transparent', borderBottom:'1px solid rgba(74,107,54,0.07)',
                    }}
                    onMouseEnter={e => { if (!activo) e.currentTarget.style.background = 'var(--z-card-hover)' }}
                    onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ fontSize:13, fontWeight:500, color: activo ? 'var(--z-primary-light)' : 'var(--z-text)' }}>{p.nombre}</div>
                      <div style={{ fontSize:11, color:'var(--z-text-muted)', marginTop:2 }}>{compras_p.length} compra{compras_p.length !== 1 ? 's' : ''}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Panel derecho: detalle + historial de compras */}
            <div style={{ flex:1, background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', padding:24, minHeight:400 }}>
              {!seleccionado ? (
                <div style={{ textAlign:'center', padding:64, color:'var(--z-text-muted)' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🚚</div>
                  <p>Elegí un proveedor para ver su historial de compras</p>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <h2 style={{ margin:0, fontSize:19 }}>{seleccionado.nombre}</h2>
                    <Btn small onClick={() => abrirCompra(seleccionado.id)}>+ Compra</Btn>
                  </div>
                  <div style={{ display:'flex', gap:16, fontSize:12.5, color:'var(--z-text-2)', marginBottom:20 }}>
                    {seleccionado.contacto && <span>👤 {seleccionado.contacto}</span>}
                    {seleccionado.telefono && <span>📞 {seleccionado.telefono}</span>}
                    {seleccionado.email && <span>✉️ {seleccionado.email}</span>}
                  </div>

                  <div style={{ fontSize:9, fontWeight:400, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:10 }}>
                    Historial de compras ({comprasSeleccionado.length})
                  </div>
                  {comprasSeleccionado.length === 0 ? (
                    <div style={{ fontSize:12.5, color:'var(--z-text-muted)' }}>Sin compras registradas a este proveedor todavía.</div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:400, overflowY:'auto' }}>
                      {comprasSeleccionado.map(c => (
                        <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--z-bg-2)', borderRadius:10, border:'1px solid var(--z-border)' }}>
                          <div>
                            <div style={{ fontSize:13, color:'var(--z-text)' }}>{c.catalogo_materiales?.nombre || c.catalogo_herrajes?.nombre || 'Insumo'}</div>
                            <div style={{ fontSize:11, color:'var(--z-text-muted)', marginTop:2 }}>{fechaFmt(c.fecha)} · {c.cantidad} un. × {fmt(c.precio_unitario)}</div>
                          </div>
                          <span style={{ fontSize:13, color:'var(--z-success)', fontWeight:500 }}>{fmt(c.precio_total || c.cantidad*c.precio_unitario)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>}
      </PageContent>
    </Layout>
  )
}
