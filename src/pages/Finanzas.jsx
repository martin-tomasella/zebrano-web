
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent } from '../components/Layout'

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—'
const CATEGORIAS = ['nomina','servicio','insumo','eventual','facturacion','sena','otro']
const CAT_LABEL = { nomina:'Nómina', servicio:'Servicio', insumo:'Insumo', eventual:'Eventual', facturacion:'Facturación', sena:'Seña', otro:'Otro' }

const TABS = [['flujo','Flujo de caja'],['nomina','Nómina'],['gastos','Gastos'],['rentabilidad','Rentabilidad']]

const MOV_ESTADO_CHIP = {
  aprobado:  'bg-z-primary/15 text-z-primary border-z-primary/30',
  pendiente: 'bg-z-warning/15 text-z-warning border-z-warning/30',
  rechazado: 'bg-z-danger/15 text-z-danger border-z-danger/30',
}
function MovBadge({ estado }) {
  const cls = MOV_ESTADO_CHIP[estado] || 'bg-z-ink-3/15 text-z-ink-3 border-z-ink-3/30'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11.5px] border flex-shrink-0 ${cls}`}>
      {estado}
    </span>
  )
}

// Banda de margen derivada de margenPct (dato real ya calculado) — sólo para colorear,
// no agrega ningún dato que el archivo no calcule ya.
function MargenBadge({ pct }) {
  if (pct == null) return <span className="text-z-ink-4 text-[11.5px] font-mono">—</span>
  const s = pct >= 35
    ? { label: 'ÓPTIMO', cls: 'bg-z-primary/15 text-z-primary border-z-primary/30' }
    : pct >= 30
    ? { label: 'OBJETIVO', cls: 'bg-z-ink-3/15 text-z-ink-3 border-z-ink-3/30' }
    : { label: 'ALERTA', cls: 'bg-z-danger/15 text-z-danger border-z-danger/30' }
  return <span className={`text-[11.5px] font-bold px-2 py-1 rounded border whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

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
        actions={
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-z-primary text-z-on-primary px-4 py-2 rounded font-mono text-xs flex items-center gap-2 hover:brightness-110 transition-all"
          >
            <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancelar' : 'Nuevo gasto'}
          </button>
        }
      />
      <PageContent>
        {loading ? (
          <div className="text-center py-12 text-z-ink-4">Cargando...</div>
        ) : (
          <>
            {/* ── Header KPI Row ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-z-surface border border-z-line rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[11.5px] text-z-ink-3">Saldo proyectado (8 sem)</span>
                  <span className="material-symbols-outlined text-z-primary text-sm">account_balance_wallet</span>
                </div>
                <div className="font-mono text-2xl font-bold text-z-ink">{fmt(semanas[semanas.length-1]?.acumulado)}</div>
                <div className="mt-2 text-[11.5px] font-mono" style={{ color: semanas[semanas.length-1]?.acumulado >= 0 ? '#0D7665' : '#C43428' }}>
                  {semanas[semanas.length-1]?.acumulado >= 0 ? 'Positivo a 8 semanas' : 'Déficit proyectado'}
                </div>
              </div>
              <div className="bg-z-surface border border-z-line rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[11.5px] text-z-ink-3">Margen promedio</span>
                  <span className="material-symbols-outlined text-z-ai text-sm">percent</span>
                </div>
                <div className="font-mono text-2xl font-bold text-z-ink">{margenPromedio != null ? `${margenPromedio.toFixed(1)}%` : '—'}</div>
                <div className="mt-2 text-[11.5px] font-mono text-z-ink-3">
                  {margenPromedio != null ? `sobre ${margenesValidos.length} trabajo${margenesValidos.length !== 1 ? 's' : ''} con horas` : 'sin horas cargadas'}
                </div>
              </div>
              <div className="bg-z-surface border border-z-line rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[11.5px] text-z-ink-3">Ingresos pendientes</span>
                  <span className="material-symbols-outlined text-z-ink-3 text-sm">pending_actions</span>
                </div>
                <div className="font-mono text-2xl font-bold text-z-ink">{fmt(ingresosPendientes)}</div>
                <div className="mt-2 text-[11.5px] font-mono text-z-ink-3">
                  {proyectosPendientesFacturacion.length} proyecto{proyectosPendientesFacturacion.length !== 1 ? 's' : ''} sin entregar
                </div>
              </div>
              <div className="bg-z-surface border border-z-line rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[11.5px] text-z-ink-3">Egreso fijo semanal</span>
                  <span className="material-symbols-outlined text-z-danger text-sm">error</span>
                </div>
                <div className="font-mono text-2xl font-bold text-z-ink">{fmt(semanas[0]?.egresoFijoSemanal)}</div>
                <div className="mt-2 text-[11.5px] font-mono text-z-ink-3">Nómina + servicios recurrentes</div>
              </div>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────────────────── */}
            <div className="flex gap-2 mb-6">
              {TABS.map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setTab(v)}
                  className={`px-3 py-1.5 rounded font-mono text-[11px] transition-colors ${
                    tab === v
                      ? 'bg-z-primary text-z-on-primary font-bold'
                      : 'bg-z-surface border border-z-line text-z-ink-2 hover:border-z-primary'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {showForm && (
              <div className="bg-z-surface border border-z-line rounded-lg p-6 mb-6">
                <form onSubmit={crearMovimiento}>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block font-mono text-[11.5px] text-z-ink-3 mb-1.5">Fecha</label>
                      <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha:e.target.value})} required
                        className="w-full bg-z-inset border border-z-line rounded px-3 py-2 text-sm font-mono text-z-ink focus:outline-none focus:border-z-primary transition-colors" />
                    </div>
                    <div>
                      <label className="block font-mono text-[11.5px] text-z-ink-3 mb-1.5">Monto (ARS)</label>
                      <input type="number" value={form.monto} onChange={e => setForm({...form, monto:e.target.value})} placeholder="0" required
                        className="w-full bg-z-inset border border-z-line rounded px-3 py-2 text-sm font-mono text-z-ink focus:outline-none focus:border-z-primary transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-[2fr_1fr] gap-4 mb-4">
                    <div>
                      <label className="block font-mono text-[11.5px] text-z-ink-3 mb-1.5">Categoría</label>
                      <select value={form.categoria} onChange={e => setForm({...form, categoria:e.target.value})}
                        className="w-full bg-z-inset border border-z-line rounded px-3 py-2 text-sm font-mono text-z-ink focus:outline-none focus:border-z-primary transition-colors">
                        {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end pb-2.5 gap-2">
                      <input type="checkbox" checked={form.recurrente} onChange={e => setForm({...form, recurrente:e.target.checked})} className="w-auto" />
                      <span className="text-xs text-z-ink-2">Es un gasto fijo mensual</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block font-mono text-[11.5px] text-z-ink-3 mb-1.5">Descripción</label>
                    <input value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} placeholder="¿En qué se gastó?" required
                      className="w-full bg-z-inset border border-z-line rounded px-3 py-2 text-sm font-mono text-z-ink focus:outline-none focus:border-z-primary transition-colors" />
                  </div>
                  <button type="submit" onClick={crearMovimiento} disabled={saving}
                    className="bg-z-primary text-z-on-primary px-4 py-2 rounded font-mono text-xs font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {saving ? 'Guardando...' : 'Registrar movimiento'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Tab: Flujo de caja ──────────────────────────────────────────────── */}
            {tab === 'flujo' && (
              <>
                <section className="bg-z-surface border border-z-line rounded-lg overflow-hidden mb-6">
                  <div className="px-4 py-3 border-b border-z-line flex justify-between items-center">
                    <h2 className="text-lg font-bold text-z-primary">Flujo de caja proyectado — 8 semanas</h2>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-2 font-mono text-[11.5px] text-z-ink-3">
                        <span className="w-2.5 h-2.5 rounded-sm bg-z-primary/40 inline-block" /> Ingresos esperados
                      </span>
                      <span className="flex items-center gap-2 font-mono text-[11.5px] text-z-ink-3">
                        <span className="w-2.5 h-2.5 rounded-sm bg-z-danger/60 inline-block" /> Egresos (fijos + eventuales)
                      </span>
                    </div>
                  </div>
                  <div
                    className="p-6 h-64 flex items-end gap-3"
                    style={{ backgroundImage: 'linear-gradient(rgb(var(--z-line-c)) 1px, transparent 1px)', backgroundSize: '100% 25%' }}
                  >
                    {semanas.map((s, i) => {
                      const hIngreso = Math.max(1, (s.ingresos / maxFlujoSemanal) * 100)
                      const hEgreso = Math.max(1, ((s.egresoFijoSemanal + s.eventuales) / maxFlujoSemanal) * 100)
                      const deficit = s.saldoSemana < 0
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                          title={`${fechaFmt(s.inicio)} – ${fechaFmt(s.fin)} · Ingresos ${fmt(s.ingresos)} · Egresos ${fmt(s.egresoFijoSemanal + s.eventuales)} · Saldo ${fmt(s.saldoSemana)}`}
                        >
                          <div className="w-full flex flex-col justify-end flex-1">
                            <div className="w-full bg-z-primary/40 rounded-t" style={{ height: `${hIngreso}%`, minHeight: 2 }} />
                            <div
                              className={`w-full rounded-b ${deficit ? 'bg-z-danger/60 border-x border-b border-z-danger' : 'bg-z-danger/30'}`}
                              style={{ height: `${hEgreso}%`, minHeight: 2 }}
                            />
                          </div>
                          <span className={`font-mono text-[11.5px] ${deficit ? 'text-z-danger font-bold' : 'text-z-ink-4'}`}>
                            S{i + 1}{deficit ? ' ⚠' : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <h3 className="font-mono text-[11.5px] text-z-ink-3 mb-3">Próximas 8 semanas</h3>
                <div className="border border-z-line rounded-lg overflow-hidden mb-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-z-line">
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2">Semana</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Ingresos esperados</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Egresos fijos</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Egresos eventuales</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Saldo semana</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semanas.map((s, i) => (
                        <tr key={i} className={`border-t border-z-line ${i % 2 === 1 ? 'bg-z-subtle' : ''}`}>
                          <td className="px-4 py-2.5 text-z-ink-2">{fechaFmt(s.inicio)} — {fechaFmt(s.fin)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-z-primary">{fmt(s.ingresos)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-z-ink-2">{fmt(s.egresoFijoSemanal)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-z-ink-2">{fmt(s.eventuales)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold" style={{ color: s.saldoSemana >= 0 ? '#0D7665' : '#C43428' }}>{fmt(s.saldoSemana)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold" style={{ color: s.acumulado >= 0 ? '#0D7665' : '#C43428' }}>{fmt(s.acumulado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[11px] text-z-ink-4 mb-8">
                  Ingresos esperados = valor de proyectos con seña pagada o en fabricación cuya fecha de entrega cae en esa semana. Egresos fijos = nómina cargada + servicios marcados como recurrentes, prorrateados a semana. Es una proyección simple sobre datos cargados, no una predicción financiera.
                </div>
              </>
            )}

            {/* ── Tab: Nómina ───────────────────────────────────────────────────── */}
            {tab === 'nomina' && (
              <div className="bg-z-surface border border-z-line rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-z-line">
                  <h2 className="text-lg font-bold text-z-primary">Nómina — {empleados.length} recursos activos</h2>
                </div>
                {empleados.length === 0 ? (
                  <div className="p-6 text-xs text-z-ink-4">Sin empleados activos cargados en Usuarios.</div>
                ) : (
                  <div className="divide-y divide-z-line">
                    {empleados.map(emp => {
                      const val = editSueldo[emp.id] || { sueldo_monto: emp.sueldo_monto || '', sueldo_periodicidad: emp.sueldo_periodicidad || 'mensual' }
                      return (
                        <div key={emp.id} className="flex items-center gap-4 p-4 hover:bg-z-subtle transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-z-primary/15 border border-z-primary/30 flex items-center justify-center text-z-primary font-bold text-xs flex-shrink-0">
                            {initials(emp.nombre)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-z-ink truncate">{emp.nombre}</div>
                            <div className="font-mono text-[11px] text-z-ink-3 capitalize">{emp.rol || '—'} · costo hora {fmt(emp.costo_hora_ars)}</div>
                          </div>
                          <input
                            type="number" placeholder="Monto sueldo" value={val.sueldo_monto}
                            onChange={e => setEditSueldo(s => ({...s, [emp.id]: { ...val, sueldo_monto:e.target.value }}))}
                            className="w-32 bg-z-inset border border-z-line rounded px-3 py-1.5 text-sm font-mono text-z-ink focus:outline-none focus:border-z-primary transition-colors"
                          />
                          <select
                            value={val.sueldo_periodicidad}
                            onChange={e => setEditSueldo(s => ({...s, [emp.id]: { ...val, sueldo_periodicidad:e.target.value }}))}
                            className="w-32 bg-z-inset border border-z-line rounded px-3 py-1.5 text-sm font-mono text-z-ink focus:outline-none focus:border-z-primary transition-colors"
                          >
                            <option value="mensual">Mensual</option>
                            <option value="quincenal">Quincenal</option>
                            <option value="semanal">Semanal</option>
                          </select>
                          <button
                            onClick={() => guardarSueldo(emp.id)}
                            className="bg-z-primary text-z-on-primary px-3 py-1.5 rounded font-mono text-[11px] font-bold hover:brightness-110 transition-all flex-shrink-0"
                          >
                            Guardar
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {empleados.length > 0 && (
                  <div className="p-4 bg-z-inset flex justify-between items-center">
                    <span className="font-mono text-[11.5px] font-bold text-z-ink-3">Total nómina mensual estimada</span>
                    <span className="font-mono text-lg font-bold text-z-ink">{fmt(nominaMensualTotal)}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Gastos ───────────────────────────────────────────────────── */}
            {tab === 'gastos' && (
              <>
                <div className="bg-z-surface border border-z-line rounded-lg flex flex-col mb-6">
                  <div className="px-4 py-3 border-b border-z-line">
                    <h2 className="text-lg font-bold text-z-primary">Categorización de gastos (aprobados)</h2>
                  </div>
                  {totalGastosCat === 0 ? (
                    <div className="p-6 text-xs text-z-ink-4">Sin gastos aprobados todavía.</div>
                  ) : (
                    <>
                      <div className="p-6 grid grid-cols-2 gap-6">
                        <div>
                          <div className="flex justify-between items-end mb-3">
                            <h3 className="font-mono text-[11.5px] font-bold text-z-ink-3">Fijos</h3>
                            <span className="text-sm font-bold text-z-ink">{fmt(totalFijos)}</span>
                          </div>
                          <div className="flex flex-col gap-2">
                            {fijosPorCategoria.length === 0
                              ? <span className="text-[11px] text-z-ink-4">Sin gastos fijos aprobados</span>
                              : fijosPorCategoria.map(([cat, monto]) => (
                                <div key={cat} className="h-8 bg-z-line border border-z-line rounded flex items-center px-3 justify-between">
                                  <span className="font-mono text-[11px] text-z-ink-2">{CAT_LABEL[cat] || cat}</span>
                                  <span className="font-mono text-xs text-z-ink">{fmt(monto)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-end mb-3">
                            <h3 className="font-mono text-[11.5px] font-bold text-z-ink-3">Eventuales</h3>
                            <span className="text-sm font-bold text-z-ai">{fmt(totalEventuales)}</span>
                          </div>
                          <div className="flex flex-col gap-2">
                            {eventualesPorCategoria.length === 0
                              ? <span className="text-[11px] text-z-ink-4">Sin gastos eventuales aprobados</span>
                              : eventualesPorCategoria.map(([cat, monto]) => (
                                <div key={cat} className="h-8 bg-z-ai/5 border border-z-ai/20 rounded flex items-center px-3 justify-between">
                                  <span className="font-mono text-[11px] text-z-ink-2">{CAT_LABEL[cat] || cat}</span>
                                  <span className="font-mono text-xs text-z-ai">{fmt(monto)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                      <div className="mx-4 h-2 bg-z-line rounded-full overflow-hidden flex">
                        <div className="h-full bg-z-primary" style={{ width: `${pctFijos}%` }} />
                        <div className="h-full bg-z-ai" style={{ width: `${100 - pctFijos}%` }} />
                      </div>
                      <div className="px-4 pb-4 pt-2 flex justify-between font-mono text-[11px]">
                        <span className="text-z-primary">FIJOS: {pctFijos}%</span>
                        <span className="text-z-ai">EVENTUALES: {100 - pctFijos}%</span>
                      </div>
                    </>
                  )}
                </div>

                <h3 className="font-mono text-[11.5px] text-z-ink-3 mb-3">Movimientos (fijos y eventuales)</h3>
                <div className="border border-z-line rounded-lg overflow-hidden mb-6 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-z-line">
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2">Fecha</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2">Descripción</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2">Categoría</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Monto</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2">Cargado por</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-center">Estado</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-9 text-z-ink-4 text-sm">Sin movimientos registrados</td></tr>
                      ) : movimientos.map((m, i) => (
                        <tr key={m.id} className={`border-t border-z-line hover:bg-z-primary/5 transition-colors ${i % 2 === 1 ? 'bg-z-subtle' : ''}`}>
                          <td className="px-4 py-2.5 text-z-ink-2">{fechaFmt(m.fecha)}</td>
                          <td className="px-4 py-2.5 text-z-ink">{m.descripcion}</td>
                          <td className="px-4 py-2.5 text-z-ink-2">
                            {CAT_LABEL[m.categoria] || m.categoria}
                            {m.recurrente && <span className="ml-1.5 text-[11.5px] text-z-ink-4">· fijo</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-z-ink">{fmt(m.monto)}</td>
                          <td className="px-4 py-2.5 text-z-ink-2">{m.creado_por_emp?.nombre || '—'}</td>
                          <td className="px-4 py-2.5 text-center"><MovBadge estado={m.estado} /></td>
                          <td className="px-4 py-2.5">
                            {puedeAprobar && m.estado === 'pendiente' ? (
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => actualizarEstado(m.id, 'aprobado')}
                                  className="bg-z-primary text-z-on-primary px-3 py-1 rounded font-mono text-[11.5px] font-bold hover:brightness-110 transition-all">
                                  Aprobar
                                </button>
                                <button onClick={() => actualizarEstado(m.id, 'rechazado')}
                                  className="bg-z-danger text-z-on-primary px-3 py-1 rounded font-mono text-[11.5px] font-bold hover:brightness-110 transition-all">
                                  Rechazar
                                </button>
                              </div>
                            ) : m.aprobado_por_emp?.nombre ? (
                              <span className="text-[11px] text-z-ink-4">por {m.aprobado_por_emp.nombre}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── Tab: Rentabilidad ─────────────────────────────────────────────── */}
            {tab === 'rentabilidad' && (
              <>
                <section className="bg-z-surface border border-z-line rounded-lg overflow-hidden mb-2">
                  <div className="px-4 py-3 border-b border-z-line bg-z-line">
                    <h2 className="text-lg font-bold text-z-primary">Rentabilidad por trabajo (entregados)</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-z-line border-b border-z-line">
                        <tr>
                          <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2">Trabajo</th>
                          <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2">Entregado</th>
                          <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Facturado</th>
                          <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Horas reales</th>
                          <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Costo estimado</th>
                          <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Margen</th>
                          <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentabilidad.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-9 text-z-ink-4 text-sm">Sin trabajos entregados todavía</td></tr>
                        ) : rentabilidad.map((r, i) => (
                          <tr key={r.id} className={`border-t border-z-line hover:bg-z-primary/5 transition-colors ${i % 2 === 1 ? 'bg-z-subtle' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-z-ink">{r.nombre || r.descripcion || r.tipo_trabajo || '—'}</div>
                            </td>
                            <td className="px-4 py-3 text-z-ink-2">{fechaFmt(r.fecha_entrega_real)}</td>
                            <td className="px-4 py-3 text-right font-mono text-z-primary">{fmt(r.valor_final)}</td>
                            <td className="px-4 py-3 text-right font-mono text-z-ink-2">{r.horas != null ? r.horas.toFixed(1) : '—'}</td>
                            <td className="px-4 py-3 text-right font-mono text-z-ink-2">{r.costo != null ? fmt(r.costo) : '— (sin horas cargadas)'}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: r.margen == null ? '#687482' : r.margen >= 0 ? '#0D7665' : '#C43428' }}>
                              {r.margen != null ? `${fmt(r.margen)} (${r.margenPct.toFixed(0)}%)` : '—'}
                            </td>
                            <td className="px-4 py-3 text-center"><MargenBadge pct={r.margenPct} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 bg-z-inset border-t border-z-line flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-z-primary rounded-sm inline-block" />
                      <span className="font-mono text-[11.5px] text-z-ink-3">Óptimo (&gt;35%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-z-ink-3 rounded-sm inline-block" />
                      <span className="font-mono text-[11.5px] text-z-ink-3">Objetivo (30–35%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-z-danger rounded-sm inline-block" />
                      <span className="font-mono text-[11.5px] text-z-ink-3">Alerta (&lt;30%)</span>
                    </div>
                  </div>
                </section>
                <div className="text-[11px] text-z-ink-4 mb-8">
                  Costo estimado = horas reales cargadas en Horas de trabajo × costo hora promedio de los empleados activos ({fmt(costoHoraProm)}). No incluye materiales por trabajo todavía (compras de insumos no están vinculadas a un proyecto puntual).
                </div>

                <h3 className="font-mono text-[11.5px] text-z-ink-3 mb-3">Totalizado por mes</h3>
                <div className="border border-z-line rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-z-line">
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2">Mes</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Trabajos</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Facturado</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Costo (con datos)</th>
                        <th className="px-4 py-3 font-mono text-[11.5px] text-z-ink-2 text-right">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rentabilidadPorMes.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-9 text-z-ink-4 text-sm">Sin datos todavía</td></tr>
                      ) : rentabilidadPorMes.map(([mes, v], i) => (
                        <tr key={mes} className={`border-t border-z-line ${i % 2 === 1 ? 'bg-z-subtle' : ''}`}>
                          <td className="px-4 py-2.5 text-z-ink-2">{mes}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-z-ink-2">{v.cantidad}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-z-ink">{fmt(v.facturado)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-z-ink-2">{v.conCosto > 0 ? fmt(v.costo) : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-z-primary">{v.conCosto > 0 ? fmt(v.facturado - v.costo) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </PageContent>
    </Layout>
  )
}
