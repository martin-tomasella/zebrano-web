
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, KpiCard, SectionTitle, Table, Spinner, Btn, Input, Badge } from '../components/ui'

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—'
const CATEGORIAS = ['nomina','servicio','insumo','eventual','facturacion','sena','otro']
const CAT_LABEL = { nomina:'Nómina', servicio:'Servicio', insumo:'Insumo', eventual:'Eventual', facturacion:'Facturación', sena:'Seña', otro:'Otro' }

// Prorratea un sueldo a un monto semanal segun su periodicidad. Es una aproximacion
// simple y auditable (no una simulacion financiera), a proposito.
function semanalDeSueldo(emp) {
  if (!emp.sueldo_monto) return 0
  if (emp.sueldo_periodicidad === 'semanal') return Number(emp.sueldo_monto)
  if (emp.sueldo_periodicidad === 'quincenal') return Number(emp.sueldo_monto) * 2 / 4.33
  return Number(emp.sueldo_monto) / 4.33 // mensual por defecto
}

function inicioSemana(offsetSemanas) {
  const d = new Date()
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() - d.getDay() + 1 + offsetSemanas*7) // lunes
  return d
}

export default function Finanzas() {
  const { profile } = useAuth()
  const puedeAprobar = profile?.rol === 'admin' || profile?.rol === 'rrhh'

  const [tab, setTab] = useState('flujo')
  const [loading, setLoading] = useState(true)
  const [movimientos, setMovimientos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0,10), monto:'', categoria:'eventual', descripcion:'', recurrente:false })
  const [editSueldo, setEditSueldo] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: m, error: em }, { data: e, error: ee }, { data: p, error: ep }, { data: o, error: eo }] = await Promise.all([
      supabase.from('finanzas_movimientos').select('*, creado_por_emp:empleados!finanzas_movimientos_creado_por_fkey(nombre), aprobado_por_emp:empleados!finanzas_movimientos_aprobado_por_fkey(nombre)').order('fecha', { ascending:false }),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      supabase.from('proyectos').select('*').order('fecha_entrega_estimada'),
      supabase.from('ordenes_trabajo').select('proyecto_id, horas_reales'),
    ])
    if (em) console.error('Error cargando movimientos:', em)
    if (ee) console.error('Error cargando empleados:', ee)
    if (ep) console.error('Error cargando proyectos:', ep)
    if (eo) console.error('Error cargando ordenes:', eo)
    setMovimientos(m || [])
    setEmpleados(e || [])
    setProyectos(p || [])
    setOrdenes(o || [])
    setLoading(false)
  }

  async function crearMovimiento(e) {
    e.preventDefault()
    if (!form.monto || !form.descripcion) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: emp } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single()
    const { error } = await supabase.from('finanzas_movimientos').insert({
      tipo: 'egreso',
      fecha: form.fecha,
      monto: Number(form.monto),
      categoria: form.categoria,
      descripcion: form.descripcion,
      recurrente: form.recurrente,
      creado_por: emp?.id || null,
      estado: 'pendiente',
    })
    setSaving(false)
    if (error) { alert('No se pudo registrar el movimiento: ' + error.message); return }
    setForm({ fecha: new Date().toISOString().slice(0,10), monto:'', categoria:'eventual', descripcion:'', recurrente:false })
    setShowForm(false)
    load()
  }

  async function actualizarEstado(id, estado) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: emp } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single()
    const { error } = await supabase.from('finanzas_movimientos').update({
      estado, aprobado_por: emp?.id || null, aprobado_en: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('No se pudo actualizar el estado: ' + error.message); return }
    load()
  }

  async function guardarSueldo(empId) {
    const val = editSueldo[empId]
    if (!val) return
    const { error } = await supabase.from('empleados').update({
      sueldo_monto: val.sueldo_monto ? Number(val.sueldo_monto) : null,
      sueldo_periodicidad: val.sueldo_periodicidad || null,
    }).eq('id', empId)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    load()
  }

  const pendientes = movimientos.filter(m => m.estado === 'pendiente')
  const aprobados = movimientos.filter(m => m.estado === 'aprobado')
  const mesActual = new Date().toISOString().slice(0,7)
  const totalMes = aprobados.filter(m => m.fecha?.slice(0,7) === mesActual).reduce((s,m) => s + Number(m.monto||0), 0)

  // ── Flujo de caja proyectado: 8 semanas ──────────────────────────────────
  const semanas = useMemo(() => {
    const nominaSemanal = empleados.reduce((s,e) => s + semanalDeSueldo(e), 0)
    const serviciosSemanal = aprobados.filter(m => m.categoria === 'servicio' && m.recurrente).reduce((s,m) => s + Number(m.monto||0)/4.33, 0)
    const egresoFijoSemanal = nominaSemanal + serviciosSemanal

    let acumulado = 0
    return Array.from({ length: 8 }).map((_, i) => {
      const inicio = inicioSemana(i)
      const fin = new Date(inicio); fin.setDate(fin.getDate() + 6)
      const ingresos = proyectos
        .filter(p => ['sena_pagada','en_fabricacion'].includes(p.estado) && p.fecha_entrega_estimada)
        .filter(p => { const f = new Date(p.fecha_entrega_estimada); return f >= inicio && f <= fin })
        .reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0)
      const eventuales = movimientos
        .filter(m => m.categoria !== 'servicio' && m.estado !== 'rechazado' && m.fecha)
        .filter(m => { const f = new Date(m.fecha); return f >= inicio && f <= fin })
        .reduce((s,m) => s + Number(m.monto||0), 0)
      const saldoSemana = ingresos - egresoFijoSemanal - eventuales
      acumulado += saldoSemana
      return { inicio, fin, ingresos, egresoFijoSemanal, eventuales, saldoSemana, acumulado }
    })
  }, [proyectos, empleados, movimientos, aprobados])

  // ── Rentabilidad por trabajo ──────────────────────────────────────────────
  const costoHoraProm = empleados.length > 0 ? empleados.reduce((s,e) => s + Number(e.costo_hora_ars||0), 0) / empleados.length : 0
  const horasPorProyecto = useMemo(() => {
    const map = {}
    for (const o of ordenes) {
      if (!o.proyecto_id || !o.horas_reales) continue
      map[o.proyecto_id] = (map[o.proyecto_id]||0) + Number(o.horas_reales)
    }
    return map
  }, [ordenes])

  const entregados = proyectos.filter(p => p.estado === 'entregado' && p.valor_final)
  const rentabilidad = entregados.map(p => {
    const horas = horasPorProyecto[p.id]
    const costo = horas != null ? horas * costoHoraProm : null
    const margen = costo != null ? p.valor_final - costo : null
    return { ...p, horas, costo, margen, margenPct: margen != null && p.valor_final ? (margen/p.valor_final*100) : null }
  })

  const rentabilidadPorMes = useMemo(() => {
    const map = {}
    for (const r of rentabilidad) {
      const mes = r.fecha_entrega_real?.slice(0,7) || 'sin fecha'
      if (!map[mes]) map[mes] = { facturado:0, costo:0, conCosto:0, cantidad:0 }
      map[mes].facturado += Number(r.valor_final||0)
      map[mes].cantidad += 1
      if (r.costo != null) { map[mes].costo += r.costo; map[mes].conCosto += 1 }
    }
    return Object.entries(map).sort((a,b) => b[0].localeCompare(a[0]))
  }, [rentabilidad])

  // ── KPIs adicionales para el header (derivados de datos ya cargados, sin queries nuevas) ──
  const margenesValidos = rentabilidad.filter(r => r.margenPct != null)
  const margenPromedio = margenesValidos.length > 0 ? margenesValidos.reduce((s,r) => s + r.margenPct, 0) / margenesValidos.length : null

  const proyectosPendientesFacturacion = proyectos.filter(p => ['cotizado','sena_pagada','en_fabricacion'].includes(p.estado))
  const ingresosPendientes = proyectosPendientesFacturacion.reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0)

  // ── Categorización de gastos: fijos (recurrentes) vs eventuales ───────────
  const gastosFijos = aprobados.filter(m => m.recurrente)
  const gastosEventuales = aprobados.filter(m => !m.recurrente)
  const totalFijos = gastosFijos.reduce((s,m) => s + Number(m.monto||0), 0)
  const totalEventuales = gastosEventuales.reduce((s,m) => s + Number(m.monto||0), 0)
  const totalGastosCat = totalFijos + totalEventuales
  const pctFijos = totalGastosCat > 0 ? Math.round((totalFijos/totalGastosCat)*100) : 0

  function agruparPorCategoria(lista) {
    const map = {}
    for (const m of lista) { map[m.categoria] = (map[m.categoria]||0) + Number(m.monto||0) }
    return Object.entries(map).sort((a,b) => b[1]-a[1])
  }
  const fijosPorCategoria = agruparPorCategoria(gastosFijos)
  const eventualesPorCategoria = agruparPorCategoria(gastosEventuales)

  // ── Escala del gráfico de flujo de caja (sobre `semanas`, sin tocar el cálculo) ──
  const maxFlujoSemanal = Math.max(1, ...semanas.flatMap(s => [s.ingresos, s.egresoFijoSemanal + s.eventuales]))

  // ── Total nómina mensual (misma fórmula que semanalDeSueldo, proyectada a mes) ──
  const nominaMensualTotal = empleados.reduce((s,e) => s + semanalDeSueldo(e), 0) * 4.33

  return (
    <Layout>
      <Topbar
        title="Finanzas"
        subtitle={`${pendientes.length} pendientes de aprobación · ${fmt(totalMes)} aprobado este mes`}
        actions={<Btn small onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancelar' : '+ Nuevo gasto'}</Btn>}
      />
      <PageContent>
        {loading ? <Spinner /> : <>

          {/* ── KPI row global (derivado de datos ya cargados) ─────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12, marginBottom:20 }}>
            <KpiCard label="Saldo proyectado (8 sem)" value={fmt(semanas[semanas.length-1]?.acumulado)} accent
              detail={semanas[semanas.length-1]?.acumulado >= 0 ? 'positivo a 8 semanas' : 'déficit proyectado'} />
            <KpiCard label="Margen promedio" value={margenPromedio != null ? `${margenPromedio.toFixed(1)}%` : '—'}
              detail={margenPromedio != null ? `sobre ${margenesValidos.length} trabajo${margenesValidos.length !== 1 ? 's' : ''} con horas` : 'sin horas cargadas'} />
            <KpiCard label="Ingresos pendientes" value={fmt(ingresosPendientes)}
              detail={`${proyectosPendientesFacturacion.length} proyecto${proyectosPendientesFacturacion.length !== 1 ? 's' : ''} sin entregar`} />
            <KpiCard label="Egreso fijo semanal" value={fmt(semanas[0]?.egresoFijoSemanal)} detail="nómina + servicios recurrentes" />
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {[['flujo','Flujo de caja'],['nomina','Nómina'],['gastos','Gastos'],['rentabilidad','Rentabilidad']].map(([v,l]) => (
              <Btn key={v} small variant={tab === v ? 'primary' : 'ghost'} onClick={() => setTab(v)}>{l}</Btn>
            ))}
          </div>

          {showForm && (
            <Card style={{ marginBottom:20 }}>
              <form onSubmit={crearMovimiento}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha:e.target.value})} required />
                  <Input label="Monto (ARS)" type="number" value={form.monto} onChange={e => setForm({...form, monto:e.target.value})} placeholder="0" required />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:14 }}>
                  <div>
                    <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Categoría</label>
                    <select value={form.categoria} onChange={e => setForm({...form, categoria:e.target.value})}>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:8, gap:6 }}>
                    <input type="checkbox" checked={form.recurrente} onChange={e => setForm({...form, recurrente:e.target.checked})} style={{ width:'auto' }} />
                    <span style={{ fontSize:12, color:'var(--z-text-2)' }}>Es un gasto fijo mensual</span>
                  </div>
                </div>
                <Input label="Descripción" value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} placeholder="¿En qué se gastó?" required />
                <Btn onClick={crearMovimiento} disabled={saving}>{saving ? 'Guardando...' : 'Registrar movimiento'}</Btn>
              </form>
            </Card>
          )}

          {tab === 'flujo' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:20 }}>
                <KpiCard label="Saldo proyectado 8 semanas" value={fmt(semanas[semanas.length-1]?.acumulado)} accent />
                <KpiCard label="Egreso fijo semanal (nómina+servicios)" value={fmt(semanas[0]?.egresoFijoSemanal)} />
                <KpiCard label="Pendientes de aprobación" value={pendientes.length} />
              </div>

              {/* ── Gráfico de flujo proyectado (divs con altura %, sobre `semanas` sin tocar) ── */}
              <Card style={{ marginBottom:20, padding:0, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--z-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--z-primary)' }}>Flujo de caja proyectado — 8 semanas</span>
                  <div style={{ display:'flex', gap:16 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--z-text-3)' }}>
                      <span style={{ width:9, height:9, borderRadius:2, background:'rgba(172,210,146,0.55)', display:'inline-block' }} /> Ingresos esperados
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--z-text-3)' }}>
                      <span style={{ width:9, height:9, borderRadius:2, background:'rgba(255,180,171,0.55)', display:'inline-block' }} /> Egresos (fijos + eventuales)
                    </span>
                  </div>
                </div>
                <div style={{
                  padding:'20px 22px 10px', display:'flex', alignItems:'flex-end', gap:10, height:220,
                  backgroundImage:'linear-gradient(var(--z-border) 1px, transparent 1px)', backgroundSize:'100% 25%',
                }}>
                  {semanas.map((s, i) => {
                    const hIngreso = Math.max(1, (s.ingresos / maxFlujoSemanal) * 100)
                    const hEgreso = Math.max(1, ((s.egresoFijoSemanal + s.eventuales) / maxFlujoSemanal) * 100)
                    const deficit = s.saldoSemana < 0
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%' }}>
                        <div
                          title={`${fechaFmt(s.inicio)} – ${fechaFmt(s.fin)} · Ingresos ${fmt(s.ingresos)} · Egresos ${fmt(s.egresoFijoSemanal + s.eventuales)} · Saldo ${fmt(s.saldoSemana)}`}
                          style={{ width:'100%', flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', cursor:'default' }}
                        >
                          <div style={{ width:'100%', height:`${hIngreso}%`, background:'rgba(172,210,146,0.4)', borderRadius:'3px 3px 0 0', minHeight:2 }} />
                          <div style={{
                            width:'100%', height:`${hEgreso}%`, background: deficit ? 'rgba(255,180,171,0.6)' : 'rgba(255,180,171,0.3)',
                            border: deficit ? '1px solid var(--z-error)' : 'none', borderRadius:'0 0 3px 3px', minHeight:2,
                          }} />
                        </div>
                        <span style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight: deficit ? 700 : 400, color: deficit ? 'var(--z-error)' : 'var(--z-text-muted)' }}>
                          S{i+1}{deficit ? ' ⚠' : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <SectionTitle>Próximas 8 semanas</SectionTitle>
              <Table
                cols={[
                  { key:'semana', label:'Semana', render:r => `${fechaFmt(r.inicio)} — ${fechaFmt(r.fin)}` },
                  { key:'ingresos', label:'Ingresos esperados', render:r => <span style={{ color:'var(--z-success)' }}>{fmt(r.ingresos)}</span> },
                  { key:'fijos', label:'Egresos fijos', render:r => fmt(r.egresoFijoSemanal) },
                  { key:'eventuales', label:'Egresos eventuales', render:r => fmt(r.eventuales) },
                  { key:'saldo', label:'Saldo semana', render:r => <span style={{ color: r.saldoSemana >= 0 ? 'var(--z-success)' : 'var(--z-error)' }}>{fmt(r.saldoSemana)}</span> },
                  { key:'acumulado', label:'Acumulado', render:r => <span style={{ fontWeight:600, color: r.acumulado >= 0 ? 'var(--z-success)' : 'var(--z-error)' }}>{fmt(r.acumulado)}</span> },
                ]}
                rows={semanas}
              />
              <div style={{ fontSize:11, color:'var(--z-text-muted)', marginTop:10 }}>
                Ingresos esperados = valor de proyectos con seña pagada o en fabricación cuya fecha de entrega cae en esa semana. Egresos fijos = nómina cargada + servicios marcados como recurrentes, prorrateados a semana. Es una proyección simple sobre datos cargados, no una predicción financiera.
              </div>
            </>
          )}

          {tab === 'nomina' && (
            <>
              <SectionTitle>Nómina — {empleados.length} recursos activos</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {empleados.map(emp => {
                  const val = editSueldo[emp.id] || { sueldo_monto: emp.sueldo_monto || '', sueldo_periodicidad: emp.sueldo_periodicidad || 'mensual' }
                  return (
                    <Card key={emp.id}>
                      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:500, color:'var(--z-text)' }}>{emp.nombre}</div>
                          <div style={{ fontSize:11, color:'var(--z-text-muted)', textTransform:'capitalize' }}>{emp.rol || '—'} · costo hora {fmt(emp.costo_hora_ars)}</div>
                        </div>
                        <input type="number" placeholder="Monto sueldo" value={val.sueldo_monto}
                          onChange={e => setEditSueldo(s => ({...s, [emp.id]: { ...val, sueldo_monto:e.target.value }}))}
                          style={{ width:140 }} />
                        <select value={val.sueldo_periodicidad}
                          onChange={e => setEditSueldo(s => ({...s, [emp.id]: { ...val, sueldo_periodicidad:e.target.value }}))}
                          style={{ width:130 }}>
                          <option value="mensual">Mensual</option>
                          <option value="quincenal">Quincenal</option>
                          <option value="semanal">Semanal</option>
                        </select>
                        <Btn small onClick={() => guardarSueldo(emp.id)}>Guardar</Btn>
                      </div>
                    </Card>
                  )
                })}
                {empleados.length === 0 && <div style={{ fontSize:12.5, color:'var(--z-text-muted)' }}>Sin empleados activos cargados en Usuarios.</div>}
              </div>
              {empleados.length > 0 && (
                <div style={{
                  marginTop:14, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center',
                  background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:'var(--radius-lg)',
                }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, fontWeight:600, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                    Nómina mensual estimada
                  </span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:18, fontWeight:700, color:'var(--z-text)' }}>{fmt(nominaMensualTotal)}</span>
                </div>
              )}
            </>
          )}

          {tab === 'gastos' && (
            <>
              {/* ── Categorización de gastos: fijos (recurrentes) vs eventuales ── */}
              <Card style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--z-primary)' }}>Categorización de gastos (aprobados)</span>
                </div>
                {totalGastosCat === 0 ? (
                  <div style={{ fontSize:12.5, color:'var(--z-text-muted)' }}>Sin gastos aprobados todavía.</div>
                ) : (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, fontWeight:600, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Fijos</span>
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:700, color:'var(--z-text)' }}>{fmt(totalFijos)}</span>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {fijosPorCategoria.length === 0
                            ? <span style={{ fontSize:11.5, color:'var(--z-text-muted)' }}>Sin gastos fijos aprobados</span>
                            : fijosPorCategoria.map(([cat, monto]) => (
                              <div key={cat} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:6 }}>
                                <span style={{ fontSize:12, color:'var(--z-text-2)' }}>{CAT_LABEL[cat] || cat}</span>
                                <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--z-text)' }}>{fmt(monto)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, fontWeight:600, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Eventuales</span>
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:700, color:'var(--z-secondary)' }}>{fmt(totalEventuales)}</span>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {eventualesPorCategoria.length === 0
                            ? <span style={{ fontSize:11.5, color:'var(--z-text-muted)' }}>Sin gastos eventuales aprobados</span>
                            : eventualesPorCategoria.map(([cat, monto]) => (
                              <div key={cat} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', background:'rgba(248,178,217,0.05)', border:'1px solid rgba(248,178,217,0.2)', borderRadius:6 }}>
                                <span style={{ fontSize:12, color:'var(--z-text-2)' }}>{CAT_LABEL[cat] || cat}</span>
                                <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--z-secondary)' }}>{fmt(monto)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop:18, height:8, borderRadius:99, overflow:'hidden', display:'flex', background:'var(--z-bg-2)' }}>
                      <div style={{ width:`${pctFijos}%`, background:'var(--z-primary)' }} />
                      <div style={{ width:`${100-pctFijos}%`, background:'var(--z-secondary)' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:11, fontFamily:'var(--font-mono)' }}>
                      <span style={{ color:'var(--z-primary)' }}>FIJOS: {pctFijos}%</span>
                      <span style={{ color:'var(--z-secondary)' }}>EVENTUALES: {100-pctFijos}%</span>
                    </div>
                  </>
                )}
              </Card>

              <SectionTitle>Movimientos (fijos y eventuales)</SectionTitle>
              <Table
                cols={[
                  { key:'fecha', label:'Fecha', render:r => fechaFmt(r.fecha) },
                  { key:'descripcion', label:'Descripción' },
                  { key:'categoria', label:'Categoría', render:r => <>{CAT_LABEL[r.categoria] || r.categoria}{r.recurrente && <span style={{ marginLeft:6, fontSize:10, color:'var(--z-text-muted)' }}>· fijo</span>}</> },
                  { key:'monto', label:'Monto', render:r => fmt(r.monto) },
                  { key:'creado_por', label:'Cargado por', render:r => r.creado_por_emp?.nombre || '—' },
                  { key:'estado', label:'Estado', render:r => <Badge value={r.estado} /> },
                  { key:'acciones', label:'', render:r => (
                    puedeAprobar && r.estado === 'pendiente' ? (
                      <div style={{ display:'flex', gap:6 }}>
                        <Btn small onClick={() => actualizarEstado(r.id, 'aprobado')}>Aprobar</Btn>
                        <Btn small variant="danger" onClick={() => actualizarEstado(r.id, 'rechazado')}>Rechazar</Btn>
                      </div>
                    ) : r.aprobado_por_emp?.nombre ? <span style={{ fontSize:11, color:'var(--z-ghost)' }}>por {r.aprobado_por_emp.nombre}</span> : null
                  ) },
                ]}
                rows={movimientos}
                empty="Sin movimientos registrados"
              />
            </>
          )}

          {tab === 'rentabilidad' && (
            <>
              <SectionTitle>Rentabilidad por trabajo (entregados)</SectionTitle>
              <Table
                cols={[
                  { key:'nombre', label:'Trabajo', render:r => r.nombre || r.descripcion || r.tipo_trabajo || '—' },
                  { key:'entrega', label:'Entregado', render:r => fechaFmt(r.fecha_entrega_real) },
                  { key:'facturado', label:'Facturado', render:r => <span style={{ color:'var(--z-success)' }}>{fmt(r.valor_final)}</span> },
                  { key:'horas', label:'Horas reales', render:r => r.horas != null ? r.horas.toFixed(1) : '—' },
                  { key:'costo', label:'Costo estimado', render:r => r.costo != null ? fmt(r.costo) : '— (sin horas cargadas)' },
                  { key:'margen', label:'Margen', render:r => r.margen != null ? <span style={{ color: r.margen >= 0 ? 'var(--z-success)' : 'var(--z-error)' }}>{fmt(r.margen)} ({r.margenPct.toFixed(0)}%)</span> : '—' },
                ]}
                rows={rentabilidad}
                empty="Sin trabajos entregados todavía"
              />
              <div style={{ fontSize:11, color:'var(--z-text-muted)', margin:'10px 0 24px' }}>
                Costo estimado = horas reales cargadas en Horas de trabajo × costo hora promedio de los empleados activos ({fmt(costoHoraProm)}). No incluye materiales por trabajo todavía (compras de insumos no están vinculadas a un proyecto puntual).
              </div>

              <SectionTitle>Totalizado por mes</SectionTitle>
              <Table
                cols={[
                  { key:'mes', label:'Mes' },
                  { key:'cantidad', label:'Trabajos' },
                  { key:'facturado', label:'Facturado', render:r => fmt(r.facturado) },
                  { key:'costo', label:'Costo (con datos)', render:r => r.conCosto > 0 ? fmt(r.costo) : '—' },
                  { key:'margen', label:'Margen', render:r => r.conCosto > 0 ? fmt(r.facturado - r.costo) : '—' },
                ]}
                rows={rentabilidadPorMes.map(([mes, v]) => ({ mes, ...v }))}
                empty="Sin datos todavía"
              />
            </>
          )}
        </>}
      </PageContent>
    </Layout>
  )
}
