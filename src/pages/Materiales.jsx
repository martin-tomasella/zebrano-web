import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent, Icon } from '../components/Layout'
import { KpiCard, Spinner, EmptyState, Badge } from '../components/ui'

const $ = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR')
const usd = n => n == null ? '—' : 'US$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f = d => d ? new Date(d + 'T12:00').toLocaleDateString('es-AR') : '—'

// Insumos: catálogo real (nacido del Excel y alimentado por las facturas confirmadas en Compras).
export default function Materiales() {
  const [rows, setRows] = useState(null)
  const [cat, setCat] = useState('todas')
  const [q, setQ] = useState('')
  const [nuevo, setNuevo] = useState(null)
  const [err, setErr] = useState('')
  const [tc, setTc] = useState(null)
  const cargar = () => supabase.from('insumos_resumen').select('*').order('categoria').order('nombre').then(({ data }) => setRows(data || []))
  useEffect(() => { cargar(); supabase.from('tipos_cambio').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle().then(({ data }) => setTc(data)) }, [])

  const cats = useMemo(() => ['todas', ...new Set((rows || []).map(r => r.categoria))], [rows])
  const lista = (rows || []).filter(r => (cat === 'todas' || r.categoria === cat) && (!q || r.nombre.toLowerCase().includes(q.toLowerCase())))
  const conFactura = (rows || []).filter(r => r.fuente === 'factura').length
  const comprado = (rows || []).reduce((s, r) => s + Number(r.comprado_importe || 0), 0)

  const guardar = async e => {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('insumos').insert({ nombre: nuevo.nombre, categoria: nuevo.categoria || 'otros', unidad: nuevo.unidad || 'unidad', precio_lista: nuevo.precio_lista ? Number(nuevo.precio_lista) : null, descuento_pct: 0, origen: 'manual' })
    if (error) setErr(error.message); else { setNuevo(null); cargar() }
  }

  // Precio de lista (neto, sin IVA) para lo que todavía no tiene factura. La factura confirmada lo reemplaza.
  const precioLista = async (r, v) => {
    const n = v === '' ? null : Number(v)
    if (n === (r.precio_neto == null ? null : Number(r.precio_neto))) return
    const { error } = await supabase.from('insumos').update({ precio_lista: n, descuento_pct: 0, precio_lista_fecha: new Date().toISOString().slice(0, 10) }).eq('id', r.insumo_id)
    if (error) setErr(error.message); else cargar()
  }

  return (
    <Layout>
      <Topbar title="Insumos" subtitle="Catálogo de materiales y herrajes con el último precio pagado"
        actions={<button className="btn btn-primary" onClick={() => setNuevo({})}><Icon name="add" />Insumo</button>} />
      <PageContent>
        {!rows ? <Spinner /> : <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <KpiCard label="Insumos activos" value={rows.length} icon="inventory_2" />
            <KpiCard label="Con precio de factura" value={conFactura} detail={`${rows.length - conFactura} sin factura todavía`} icon="receipt_long" />
            <KpiCard label="Comprado (facturas confirmadas)" value={$(comprado)} icon="shopping_cart" />
            <KpiCard label="Dólar oficial venta (BCRA)" value={tc ? '$' + Number(tc.oficial_venta).toLocaleString('es-AR', { maximumFractionDigits: 2 }) : '—'} icon="currency_exchange"
              detail={tc ? `Mayorista $${Number(tc.mayorista).toLocaleString('es-AR', { maximumFractionDigits: 2 })} · cotización del ${f(tc.fecha)}, tomada ${new Date(tc.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Sin cotización'} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {cats.map(c => <button key={c} className="z-chip capitalize" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
            <input className="ml-auto max-w-[260px]" placeholder="Buscar insumo…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" />
          </div>
          {err && !nuevo && <p role="alert" className="text-[13px]" style={{ color: 'rgb(var(--z-danger-c))' }}>{err}</p>}
          {cat === 'pintura' && <Recetas rows={rows} />}
          <div className="card overflow-auto">
            <table className="w-full text-[13px]">
              <thead><tr><th>Insumo</th><th>Categoría</th><th>Unidad</th><th className="text-right">Precio neto</th><th className="text-right">USD</th><th>Fuente</th><th className="text-right">Comprado</th><th>Última compra</th><th>Proveedor</th></tr></thead>
              <tbody>{lista.length === 0 ? <tr><td colSpan={9}><EmptyState icon="inventory_2" title="Sin insumos" /></td></tr> : lista.map(r => (
                <tr key={r.insumo_id}>
                  <td className="font-medium text-z-ink">{r.nombre}</td><td className="capitalize">{r.categoria}</td><td>{r.unidad}</td>
                  <td className="text-right tabular-nums">{r.fuente === 'factura' ? $(r.precio_neto)
                    : <input type="number" min={0} defaultValue={r.precio_neto ?? ''} placeholder="Cargar" style={{ width: 100, textAlign: 'right' }} aria-label={`Precio de lista de ${r.nombre}`} onBlur={e => precioLista(r, e.target.value)} />}</td><td className="text-right tabular-nums">{usd(r.precio_usd)}</td>
                  <td><Badge tone={r.fuente === 'factura' ? 'success' : r.precio_neto == null ? 'warning' : 'neutral'}>{r.fuente === 'factura' ? 'Factura' : r.precio_neto == null ? 'Sin precio' : 'Lista'}</Badge></td>
                  <td className="text-right tabular-nums">{Number(r.comprado_cantidad) ? `${Number(r.comprado_cantidad).toLocaleString('es-AR')} ${r.unidad}` : '—'}</td>
                  <td>{f(r.ultima_compra)}</td><td>{r.proveedor || '—'}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <p className="text-[12px] text-z-ink-3 mt-2">Los precios se actualizan solos al confirmar facturas en Compras. "Comprado" suma lo facturado; el stock en taller requiere registrar consumos por proyecto (próximo paso).</p>
        </>}
      </PageContent>
      {nuevo && (
        <div className="z-drawer-wrap" onMouseDown={() => setNuevo(null)}>
          <form className="z-drawer" onMouseDown={e => e.stopPropagation()} onSubmit={guardar} role="dialog" aria-label="Nuevo insumo">
            <div className="z-drawer-head"><h2 className="text-[17px] flex-1">Nuevo insumo</h2><button type="button" className="btn btn-quiet btn-icon" onClick={() => setNuevo(null)} aria-label="Cerrar"><Icon name="close" /></button></div>
            <div className="z-drawer-body grid gap-4">
              {[['nombre', 'Nombre', { required: true }], ['categoria', 'Categoría (placa, canto, bisagra…)'], ['unidad', 'Unidad (hoja, unidad, metro…)'], ['precio_lista', 'Precio de lista (opcional)', { type: 'number', min: 0 }]].map(([k, l, p = {}]) => (
                <div key={k} className="z-field"><label htmlFor={'in-' + k}>{l}</label><input id={'in-' + k} value={nuevo[k] || ''} onChange={e => setNuevo({ ...nuevo, [k]: e.target.value })} {...p} /></div>))}
              {err && <div role="alert" className="text-[13px]" style={{ color: 'rgb(var(--z-danger-c))' }}>{err}</div>}
            </div>
            <div className="z-drawer-foot"><button type="button" className="btn btn-secondary" onClick={() => setNuevo(null)}>Cancelar</button><button className="btn btn-primary" type="submit">Guardar</button></div>
          </form>
        </div>
      )}
    </Layout>
  )
}

// Receta de cada terminación: consumo por m² terminado (todas las manos) de cada insumo de pintura.
// El cotizador multiplica consumo × m² × precio del insumo. Solo un admin la puede editar.
function Recetas({ rows }) {
  const [rec, setRec] = useState(null)
  const cargar = () => supabase.from('terminacion_receta').select('terminacion,insumo_id,consumo_m2,notas').order('terminacion').then(({ data }) => setRec(data || []))
  useEffect(() => { cargar() }, [])
  if (!rec) return null
  const precio = id => Number(rows.find(r => r.insumo_id === id)?.precio_neto || 0)
  const nombre = id => rows.find(r => r.insumo_id === id)?.nombre || '—'
  const guardar = async (r, v) => { await supabase.from('terminacion_receta').update({ consumo_m2: Number(v) || 0 }).eq('terminacion', r.terminacion).eq('insumo_id', r.insumo_id); cargar() }
  return (
    <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      {['laqueado sintetico', 'laqueado al agua', 'lustrado'].map(t => {
        const rs = rec.filter(r => r.terminacion === t)
        const m2 = rs.reduce((a, r) => a + Number(r.consumo_m2) * precio(r.insumo_id), 0)
        return (
          <div key={t} className="card p-4">
            <div className="flex justify-between items-baseline mb-2"><b className="capitalize text-z-ink">{t}</b><span className="tabular-nums text-[13px]">{$(m2)} / m² sin IVA</span></div>
            <table className="w-full text-[12.5px]"><tbody>{rs.map(r => (
              <tr key={r.insumo_id}><td>{nombre(r.insumo_id)}{!precio(r.insumo_id) && <> <Badge tone="warning">sin precio</Badge></>}</td>
                <td className="text-right whitespace-nowrap"><input type="number" step="0.01" min={0} defaultValue={r.consumo_m2} style={{ width: 70, textAlign: 'right' }} onBlur={e => Number(e.target.value) !== Number(r.consumo_m2) && guardar(r, e.target.value)} aria-label={`Consumo por m² de ${nombre(r.insumo_id)} en ${t}`} /> /m²</td></tr>
            ))}</tbody></table>
          </div>
        )
      })}
      <p className="text-[12px] text-z-ink-3 m-0" style={{ gridColumn: '1 / -1' }}>Consumo por m² terminado, con todas las manos. Los valores iniciales son una referencia: ajustalos con lo que gasta el taller. Las horas de lijado y pintura van en la etapa "terminación" de la mano de obra.</p>
    </div>
  )
}
