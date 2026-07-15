import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, KpiCard, SectionTitle, Table, Spinner, Btn, Input } from '../components/ui'

export default function HorasTrabajo() {
  const [ots, setOts] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ot_id:'', empleado_id:'', fecha: new Date().toISOString().slice(0,10), horas:'', notas:'' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: o }, { data: e }, { data: r }] = await Promise.all([
      supabase.from('ordenes_trabajo').select('id, numero_ot, estado, horas_estimadas, horas_reales, modulos(nombre, proyectos(nombre, clientes(nombre,apellido)))').order('created_at', { ascending:false }).limit(200),
      supabase.from('empleados').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('horas_trabajo_ot').select('*, empleados(nombre), ordenes_trabajo(numero_ot)').order('fecha', { ascending:false }).limit(100),
    ])
    setOts(o || [])
    setEmpleados(e || [])
    setRegistros(r || [])
    setLoading(false)
  }

  async function cargarHoras(e) {
    e.preventDefault()
    if (!form.ot_id || !form.empleado_id || !form.horas) return
    setSaving(true)
    const { error } = await supabase.from('horas_trabajo_ot').insert({
      ot_id: form.ot_id,
      empleado_id: form.empleado_id,
      fecha: form.fecha,
      horas: Number(form.horas),
      notas: form.notas || null,
    })
    setSaving(false)
    if (error) { alert('No se pudo cargar las horas: ' + error.message); return }
    setForm({ ot_id:'', empleado_id:'', fecha: new Date().toISOString().slice(0,10), horas:'', notas:'' })
    setShowForm(false)
    load()
  }

  const nombreOT = (ot) => {
    const modulo = ot.modulos
    const proyecto = modulo?.proyectos
    const cliente = proyecto?.clientes
    const partes = [proyecto?.nombre, modulo?.nombre].filter(Boolean)
    const base = partes.length ? partes.join(' — ') : ot.numero_ot
    return cliente ? `${base} (${cliente.nombre || ''} ${cliente.apellido || ''})` : base
  }

  const totalHorasMes = registros.filter(r => r.fecha?.slice(0,7) === new Date().toISOString().slice(0,7)).reduce((s,r) => s + Number(r.horas||0), 0)
  const otsSobreEstimado = ots.filter(o => o.horas_estimadas && o.horas_reales > o.horas_estimadas)

  return (
    <Layout>
      <Topbar
        title="Horas de trabajo"
        subtitle={`${ots.length} órdenes de trabajo`}
        actions={<Btn small onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancelar' : '+ Cargar horas'}</Btn>}
      />
      <PageContent>
        {loading ? <Spinner /> : <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:20 }}>
            <KpiCard label="Horas cargadas este mes" value={totalHorasMes.toFixed(1)} accent />
            <KpiCard label="OT registradas" value={ots.length} />
            <KpiCard label="OT sobre lo estimado" value={otsSobreEstimado.length} detail="más horas reales que estimadas" />
          </div>

          {showForm && (
            <Card style={{ marginBottom:20 }}>
              <form onSubmit={cargarHoras}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Orden de trabajo</label>
                  <select value={form.ot_id} onChange={e => setForm({...form, ot_id:e.target.value})} required>
                    <option value="">Elegir OT...</option>
                    {ots.map(o => <option key={o.id} value={o.id}>{nombreOT(o)}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Empleado</label>
                  <select value={form.empleado_id} onChange={e => setForm({...form, empleado_id:e.target.value})} required>
                    <option value="">Elegir empleado...</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha:e.target.value})} required />
                  <Input label="Horas" type="number" value={form.horas} onChange={e => setForm({...form, horas:e.target.value})} placeholder="0" required />
                </div>
                <Input label="Notas (opcional)" value={form.notas} onChange={e => setForm({...form, notas:e.target.value})} placeholder="¿Qué se hizo?" />
                <Btn onClick={cargarHoras} disabled={saving}>{saving ? 'Guardando...' : 'Cargar horas'}</Btn>
              </form>
            </Card>
          )}

          <SectionTitle>Órdenes de trabajo</SectionTitle>
          <Table
            cols={[
              { key:'ot', label:'OT', render:nombreOT },
              { key:'estado', label:'Estado', render:r => r.estado || '—' },
              { key:'horas_estimadas', label:'Estimadas', render:r => r.horas_estimadas ?? '—' },
              { key:'horas_reales', label:'Reales', render:r => (
                <span style={{ color: r.horas_estimadas && r.horas_reales > r.horas_estimadas ? 'var(--z-error)' : 'var(--z-text)' }}>{r.horas_reales ?? 0}</span>
              ) },
            ]}
            rows={ots}
            empty="Sin órdenes de trabajo registradas"
          />

          <div style={{ marginTop:28 }}>
            <SectionTitle>Últimas cargas de horas</SectionTitle>
            <Table
              cols={[
                { key:'fecha', label:'Fecha' },
                { key:'empleado', label:'Empleado', render:r => r.empleados?.nombre || '—' },
                { key:'ot', label:'OT', render:r => r.ordenes_trabajo?.numero_ot || '—' },
                { key:'horas', label:'Horas' },
                { key:'notas', label:'Notas', render:r => r.notas || '—' },
              ]}
              rows={registros}
              empty="Sin cargas de horas todavía"
            />
          </div>
        </>}
      </PageContent>
    </Layout>
  )
}
