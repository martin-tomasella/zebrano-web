import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent, Icon } from '../components/Layout'
import { KpiCard, Badge, Spinner, EmptyState } from '../components/ui'

const $ = n => n == null ? '—' : (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-AR')
const fecha = d => d ? new Date(String(d).slice(0, 10) + 'T12:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'
const CATEGORIAS = [['servicio', 'Servicio'], ['seguro', 'Seguro'], ['insumo', 'Insumo / consumible'], ['herramienta', 'Herramienta'], ['impuesto', 'Impuesto'], ['eventual', 'Eventual'], ['otro', 'Otro']]
const ORIGEN = { factura: 'Factura de compra', manual: 'Cargado a mano', caja_chica: 'Caja chica' }

export default function Finanzas() {
  const { profile } = useAuth()
  const puedeAprobar = ['admin', 'rrhh', 'gestion'].includes(profile?.rol)
  const [tab, setTab] = useState('flujo')
  const [d, setD] = useState(null)
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const [abierta, setAbierta] = useState(null)

  const cargar = async () => {
    const [per, est, egr, flu, meta, rent] = await Promise.all([
      supabase.from('personal').select('id,nombre,puesto,es_operario,sueldo_semanal,activo').eq('activo', true).order('nombre'),
      supabase.from('estructura_mensual').select('*').maybeSingle(),
      supabase.from('egresos').select('*').order('fecha', { ascending: false }),
      supabase.rpc('flujo_semanal', { p_semanas: 8 }),
      supabase.rpc('meta_canal_recurrente', { p_pct: 120, p_personas: 3 }),
      supabase.from('proyecto_costos').select('*'),
    ])
    setD({ personal: per.data || [], est: est.data || {}, egresos: egr.data || [], flujo: flu.data || [], meta: meta.data || {}, rent: rent.data || [] })
  }
  useEffect(() => { cargar() }, [])

  const guardarSueldo = async (id, v) => {
    const { error } = await supabase.from('personal').update({ sueldo_semanal: v === '' ? null : Number(v) }).eq('id', id)
    setMsg(error ? error.message : 'Sueldo actualizado'); cargar()
  }
  const crearGasto = async e => {
    e.preventDefault()
    const { error } = await supabase.from('finanzas_movimientos').insert({ tipo: 'egreso', fecha: form.fecha, monto: Number(form.monto), categoria: form.categoria, descripcion: form.descripcion, recurrente: false, estado: form.pagado ? 'aprobado' : 'pendiente' })
    if (error) { setMsg(error.message); return }
    setForm(null); setMsg('Gasto registrado'); cargar()
  }
  const marcarPagado = async e => {
    const { error } = e.origen === 'factura'
      ? await supabase.from('facturas_compra').update({ pagada_en: new Date().toISOString().slice(0, 10) }).eq('id', e.id)
      : await supabase.from(e.origen === 'caja_chica' ? 'caja_chica' : 'finanzas_movimientos').update({ estado: 'aprobado', aprobado_en: new Date().toISOString() }).eq('id', e.id)
    setMsg(error ? error.message : 'Marcado como pagado'); cargar()
  }

  if (!d) return <Layout><Topbar title="Finanzas" /><PageContent><Spinner /></PageContent></Layout>
  const { est, meta, flujo } = d
  const mensual = Number(est.nomina_mensual || 0) + Number(est.fijos_mensual || 0)
  const semana = flujo[0]
  const mesActual = new Date().toISOString().slice(0, 7)
  const egresosMes = d.egresos.filter(e => String(e.fecha).slice(0, 7) === mesActual).reduce((s, e) => s + Number(e.monto || 0), 0)
  const porPagar = d.egresos.filter(e => !e.pagada_en)

  return (
    <Layout>
      <Topbar title="Finanzas" subtitle="Cuánta plata necesita la fábrica cada semana y de dónde tiene que salir"
        actions={<button className="btn btn-primary" onClick={() => setForm({ fecha: new Date().toISOString().slice(0, 10), monto: '', categoria: 'servicio', descripcion: '', pagado: true })}><Icon name="add" />Gasto</button>} />
      <PageContent>
        {msg && <div className="text-[13px] text-z-ink-2 mb-3" role="status">{msg}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <KpiCard label="Necesitás esta semana" value={$(semana?.necesario)} icon="savings" accent tone="danger"
            detail={`Viernes ${fecha(semana?.viernes)}: sueldos ${$(semana?.nomina)}${Number(semana?.fijos) ? ` + vencimientos ${$(semana?.fijos)}` : ''}${Number(semana?.facturas) ? ` + facturas ${$(semana?.facturas)}` : ''}`} />
          <KpiCard label="Gasto fijo mensual" value={$(mensual)} icon="event_repeat" detail={`Sueldos ${$(est.nomina_mensual)} + estructura ${$(est.fijos_mensual)}`} />
          <KpiCard label="Meta canal recurrente (120%)" value={$(meta.meta_aporte_mensual)} icon="flag" detail={`Con 3 personas: ${$(meta.aporte_por_hora)} por hora de trabajo`} />
          <KpiCard label="Egresos variables del mes" value={$(egresosMes)} icon="receipt_long" detail={`${porPagar.length} pendiente${porPagar.length !== 1 ? 's' : ''} de pago`} />
        </div>

        <div className="z-seg mb-4" role="group" aria-label="Vista">
          {[['flujo', 'Flujo de caja'], ['meta', 'Meta mayorista'], ['nomina', 'Nómina'], ['gastos', 'Gastos'], ['rentabilidad', 'Rentabilidad']].map(([k, l]) =>
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        {tab === 'flujo' && <>
          <p className="text-[12.5px] text-z-ink-3 mb-3">Lo mínimo que tiene que haber disponible cada semana: sueldos del taller (se pagan el viernes) + gastos fijos que vencen esa semana + facturas de compra impagas que vencen + otros gastos cargados. Los gastos fijos sin día de vencimiento se prorratean por semana. El alquiler en dólares se pasa a pesos con el dólar oficial BCRA ({$(est.tc_usd)}).</p>
          <div className="card overflow-auto mb-2">
            <table className="w-full text-[13px]">
              <thead><tr><th>Semana</th><th>Viernes</th><th className="text-right">Sueldos</th><th className="text-right">Vencimientos fijos</th><th className="text-right">Facturas a pagar</th><th className="text-right">Otros</th><th className="text-right">Necesitás disponible</th><th className="text-right">Cobros esperados</th><th className="text-right">Diferencia</th></tr></thead>
              <tbody>{flujo.map((s, i) => {
                const dif = Number(s.ingresos_esperados) - Number(s.necesario)
                return <Fragment key={s.semana_inicio}>
                  <tr className="cursor-pointer hover:bg-z-subtle" onClick={() => setAbierta(abierta === i ? null : i)}>
                    <td className="whitespace-nowrap">{fecha(s.semana_inicio)}</td>
                    <td>{fecha(s.viernes)}</td>
                    <td className="text-right tabular-nums">{$(s.nomina)}</td>
                    <td className="text-right tabular-nums">{$(s.fijos)}</td>
                    <td className="text-right tabular-nums">{$(s.facturas)}</td>
                    <td className="text-right tabular-nums">{$(s.otros)}</td>
                    <td className="text-right tabular-nums font-semibold text-z-ink">{$(s.necesario)}</td>
                    <td className="text-right tabular-nums">{$(s.ingresos_esperados)}</td>
                    <td className="text-right tabular-nums font-medium" style={{ color: dif < 0 ? 'rgb(var(--z-danger-c))' : 'rgb(var(--z-success-c))' }}>{$(dif)}</td>
                  </tr>
                  {abierta === i && <tr><td colSpan={9} style={{ background: 'var(--z-subtle)' }}>
                    <div className="grid sm:grid-cols-3 gap-4 text-[12.5px] py-1">
                      {[['Vencimientos fijos', s.fijos_detalle], ['Facturas a pagar', s.facturas_detalle], ['Cobros esperados', s.ingresos_detalle]].map(([t, xs]) => (
                        <div key={t}><div className="font-medium text-z-ink mb-1">{t}</div>
                          {(xs || []).length === 0 ? <span className="text-z-ink-3">—</span> : xs.map((x, j) => <div key={j} className="flex justify-between gap-3"><span>{fecha(x.fecha)} · {x.concepto}</span><span className="tabular-nums">{$(x.monto)}</span></div>)}
                        </div>))}
                    </div>
                  </td></tr>}
                </Fragment>
              })}</tbody>
            </table>
          </div>
          <p className="text-[12px] text-z-ink-3">Tocá una semana para ver el detalle. Cobros esperados = saldo de proyectos señados o en fabricación según su fecha de entrega.</p>
        </>}

        {tab === 'meta' && <>
          <div className="card p-4 mb-4 text-[13.5px] leading-relaxed">
            <p className="m-0">La fábrica gasta <b>{$(meta.gasto_mensual)}</b> por mes ({$(meta.nomina_mensual)} de sueldos + {$(meta.fijos_mensual)} de estructura). La meta es un canal recurrente (mayoristas, distribuidores, cadenas) que aporte el <b>{meta.pct}%</b> de eso: <b>{$(meta.meta_aporte_mensual)} por mes después de pagar el material</b>, ocupando solo a <b>{meta.personas} personas a tiempo completo</b> ({Math.round(meta.horas_mes || 0)} horas al mes).</p>
            <p className="mt-2 mb-0">Cada hora de esas 3 personas tiene que dejar <b>{$(meta.aporte_por_hora)}</b> por encima del material. Las otras 3 personas quedan libres para trabajos a medida, que pasan a ser la ganancia.</p>
          </div>
          <div className="card overflow-auto">
            <table className="w-full text-[13px]">
              <thead><tr><th>Producto estándar</th><th className="text-right">Horas por unidad</th><th className="text-right">Unidades por mes (3 personas)</th><th className="text-right">Material por unidad</th><th className="text-right">Aporte necesario por unidad</th><th className="text-right">Precio mínimo al mayorista (sin IVA)</th></tr></thead>
              <tbody>{(meta.productos || []).map(p => (
                <tr key={p.nombre}>
                  <td className="font-medium text-z-ink">{p.nombre}</td>
                  <td className="text-right tabular-nums">{p.horas_unidad}</td>
                  <td className="text-right tabular-nums">{p.unidades_mes}</td>
                  <td className="text-right tabular-nums">{$(p.material_unidad)}{p.material_incompleto && <span title="Hay insumos de la receta sin precio de factura todavía"> <Badge tone="warning">incompleto</Badge></span>}</td>
                  <td className="text-right tabular-nums">{$(p.aporte_unidad)}</td>
                  <td className="text-right tabular-nums font-semibold text-z-ink">{$(p.precio_minimo_sin_iva)}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <p className="text-[12px] text-z-ink-3 mt-2">Si un solo producto ocupara las 3 personas todo el mes. Mezclando productos, la regla es la misma: cada hora tiene que dejar {$(meta.aporte_por_hora)} sobre el material. Las horas por unidad salen de los tipos de módulo (calibrados con las horas reales del taller).</p>
        </>}

        {tab === 'nomina' && <div className="card overflow-auto">
          <table className="w-full text-[13px]">
            <thead><tr><th>Persona</th><th>Puesto</th><th className="text-right">Sueldo semanal</th><th className="text-right">Mensual (×52/12)</th></tr></thead>
            <tbody>{d.personal.length === 0 ? <tr><td colSpan={4}><EmptyState icon="badge" title="Sin personal cargado" /></td></tr> : d.personal.map(p => (
              <tr key={p.id}>
                <td className="font-medium text-z-ink">{p.nombre}</td>
                <td className="capitalize">{p.puesto || '—'}{p.es_operario ? '' : ' · administración'}</td>
                <td className="text-right"><input type="number" min="0" className="w-[140px] text-right" defaultValue={p.sueldo_semanal ?? ''} aria-label={`Sueldo semanal de ${p.nombre}`}
                  onBlur={e => String(e.target.value) !== String(p.sueldo_semanal ?? '') && guardarSueldo(p.id, e.target.value)} /></td>
                <td className="text-right tabular-nums">{$(Number(p.sueldo_semanal || 0) * 52 / 12)}</td>
              </tr>))}
              <tr><td colSpan={2} className="font-semibold text-z-ink">Total · se paga los viernes</td><td className="text-right tabular-nums font-semibold text-z-ink">{$(est.nomina_semanal)}</td><td className="text-right tabular-nums font-semibold text-z-ink">{$(est.nomina_mensual)}</td></tr>
            </tbody>
          </table>
          <p className="text-[12px] text-z-ink-3 px-3 pb-3 m-0">Sale de Personal y estructura (legajos), no de los usuarios del sistema. El sueldo se edita acá o en el legajo; al salir del campo se guarda.</p>
        </div>}

        {tab === 'gastos' && <>
          <p className="text-[12.5px] text-z-ink-3 mb-3">Todos los egresos variables: facturas de compra de material e insumos (de Compras), seguros, consumibles, impuestos y cualquier gasto cargado a mano o por caja chica. Los gastos fijos de Personal y estructura no se listan acá, pero sí cuentan en el flujo de caja.</p>
          <div className="card overflow-auto">
            <table className="w-full text-[13px]">
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Origen</th><th>Vence</th><th className="text-right">Monto</th><th>Pago</th></tr></thead>
              <tbody>{d.egresos.length === 0 ? <tr><td colSpan={7}><EmptyState icon="receipt_long" title="Sin egresos" /></td></tr> : d.egresos.map(e => (
                <tr key={e.origen + e.id}>
                  <td className="whitespace-nowrap">{fecha(e.fecha)}</td>
                  <td className="text-z-ink">{e.concepto}</td>
                  <td className="capitalize">{e.categoria}</td>
                  <td>{ORIGEN[e.origen]}</td>
                  <td className="whitespace-nowrap">{fecha(e.vencimiento)}</td>
                  <td className="text-right tabular-nums font-medium text-z-ink">{$(e.monto)}</td>
                  <td>{e.pagada_en ? <Badge tone="success">Pagado {fecha(e.pagada_en)}</Badge> : puedeAprobar ? <button className="btn btn-secondary btn-sm" onClick={() => marcarPagado(e)}>Marcar pagado</button> : <Badge tone="warning">Pendiente</Badge>}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </>}

        {tab === 'rentabilidad' && <div className="card overflow-auto">
          <table className="w-full text-[13px]">
            <thead><tr><th>Trabajo</th><th>Estado</th><th className="text-right">Facturación sin IVA</th><th className="text-right">Material real</th><th className="text-right">Mano de obra</th><th className="text-right">Estructura</th><th className="text-right">Margen</th></tr></thead>
            <tbody>{d.rent.length === 0 ? <tr><td colSpan={7}><EmptyState icon="query_stats" title="Sin trabajos con costos" /></td></tr> : d.rent.map(r => (
              <tr key={r.proyecto_id}>
                <td className="text-z-ink">{r.cliente} · {r.nombre}</td>
                <td className="capitalize">{String(r.estado || '').replace('_', ' ')}</td>
                <td className="text-right tabular-nums">{$(r.facturacion_sin_iva)}</td>
                <td className="text-right tabular-nums">{$(r.material_real)}</td>
                <td className="text-right tabular-nums">{$(r.mo_real)}</td>
                <td className="text-right tabular-nums">{$(r.estructura_real)}</td>
                <td className="text-right tabular-nums font-medium" style={{ color: r.margen < 0 ? 'rgb(var(--z-danger-c))' : undefined }}>{r.margen != null ? `${$(r.margen)}${r.margen_pct != null ? ` · ${r.margen_pct}%` : ''}` : '—'}</td>
              </tr>))}</tbody>
          </table>
          <p className="text-[12px] text-z-ink-3 px-3 pb-3 m-0">Material = facturas de compra asignadas a la orden. Mano de obra y estructura = horas reales cargadas × costo hora.</p>
        </div>}
      </PageContent>

      {form && <div className="z-drawer-wrap" onMouseDown={() => setForm(null)}>
        <form className="z-drawer" style={{ width: 'min(480px, 100vw)' }} onMouseDown={e => e.stopPropagation()} onSubmit={crearGasto} role="dialog" aria-label="Nuevo gasto">
          <div className="z-drawer-head"><h2 className="text-[17px] flex-1">Nuevo gasto</h2><button type="button" className="btn btn-quiet btn-icon" onClick={() => setForm(null)} aria-label="Cerrar"><Icon name="close" /></button></div>
          <div className="z-drawer-body grid gap-4">
            <p className="text-[12.5px] text-z-ink-3 m-0">Las compras con factura se cargan en Compras. Los gastos fijos mensuales (alquiler, luz…) van en Personal y estructura.</p>
            <div className="z-field"><label htmlFor="g-d">Concepto</label><input id="g-d" required value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Seguro del galpón, discos de corte…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="z-field"><label htmlFor="g-f">Fecha</label><input id="g-f" type="date" required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
              <div className="z-field"><label htmlFor="g-m">Monto</label><input id="g-m" type="number" min="0" required value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} /></div>
            </div>
            <div className="z-field"><label htmlFor="g-c">Categoría</label><select id="g-c" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.pagado} onChange={e => setForm({ ...form, pagado: e.target.checked })} /> Ya está pagado</label>
          </div>
          <div className="z-drawer-foot"><button type="button" className="btn btn-quiet" onClick={() => setForm(null)}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
        </form>
      </div>}
    </Layout>
  )
}
