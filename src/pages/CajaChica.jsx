import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, KpiCard, SectionTitle, Table, Spinner, Btn, Input } from '../components/ui'

const CATEGORIAS = ['insumos_menores', 'viaticos', 'mantenimiento', 'limpieza', 'servicios', 'otro']
const CAT_LABEL = { insumos_menores:'Insumos menores', viaticos:'Viáticos', mantenimiento:'Mantenimiento', limpieza:'Limpieza', servicios:'Servicios', otro:'Otro' }

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'

export default function CajaChica() {
  const { profile } = useAuth()
  const puedeAprobar = profile?.rol === 'admin' || profile?.rol === 'rrhh'

  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0,10), monto:'', categoria:'insumos_menores', descripcion:'' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('caja_chica')
      .select('*, creado_por_emp:empleados!caja_chica_creado_por_fkey(nombre), aprobado_por_emp:empleados!caja_chica_aprobado_por_fkey(nombre)')
      .order('fecha', { ascending:false })
    setRegistros(data || [])
    setLoading(false)
  }

  async function crear(e) {
    e.preventDefault()
    if (!form.monto || !form.descripcion) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: emp } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single()
    const { error } = await supabase.from('caja_chica').insert({
      fecha: form.fecha,
      monto: Number(form.monto),
      categoria: form.categoria,
      descripcion: form.descripcion,
      creado_por: emp?.id || null,
      estado: 'pendiente',
    })
    setSaving(false)
    if (error) { alert('No se pudo registrar el gasto: ' + error.message); return }
    setForm({ fecha: new Date().toISOString().slice(0,10), monto:'', categoria:'insumos_menores', descripcion:'' })
    setShowForm(false)
    load()
  }

  async function actualizarEstado(id, estado) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: emp } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single()
    const { error } = await supabase.from('caja_chica').update({
      estado,
      aprobado_por: emp?.id || null,
      aprobado_en: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert('No se pudo actualizar el estado: ' + error.message); return }
    load()
  }

  const pendientes = registros.filter(r => r.estado === 'pendiente')
  const aprobados  = registros.filter(r => r.estado === 'aprobado')
  const totalMes   = registros.filter(r => r.estado === 'aprobado' && r.fecha?.slice(0,7) === new Date().toISOString().slice(0,7)).reduce((s,r) => s + Number(r.monto||0), 0)

  const badgeEstado = (estado) => {
    const map = { pendiente:{bg:'rgba(176,123,48,0.15)',color:'#C99A55'}, aprobado:{bg:'rgba(74,107,54,0.15)',color:'#7AAE5A'}, rechazado:{bg:'rgba(160,64,42,0.15)',color:'#A0402A'} }
    const s = map[estado] || map.pendiente
    return <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10, background:s.bg, color:s.color, textTransform:'capitalize' }}>{estado}</span>
  }

  return (
    <Layout>
      <Topbar
        title="Caja chica"
        subtitle={`${pendientes.length} pendientes de aprobación`}
        actions={<Btn small onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancelar' : '+ Nuevo gasto'}</Btn>}
      />
      <PageContent>
        {loading ? <Spinner /> : <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:24 }}>
            <KpiCard label="Aprobado este mes" value={fmt(totalMes)} accent />
            <KpiCard label="Pendientes" value={pendientes.length} detail="esperando aprobación" />
            <KpiCard label="Movimientos totales" value={registros.length} detail={`${aprobados.length} aprobados`} />
          </div>

          {showForm && (
            <Card style={{ marginBottom:20 }}>
              <form onSubmit={crear}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha:e.target.value})} required />
                  <Input label="Monto (ARS)" type="number" value={form.monto} onChange={e => setForm({...form, monto:e.target.value})} placeholder="0" required />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({...form, categoria:e.target.value})}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </div>
                <Input label="Descripción" value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} placeholder="¿En qué se gastó?" required />
                <Btn onClick={crear} disabled={saving}>{saving ? 'Guardando...' : 'Registrar gasto'}</Btn>
              </form>
            </Card>
          )}

          <SectionTitle>Movimientos</SectionTitle>
          <Table
            cols={[
              { key:'fecha', label:'Fecha' },
              { key:'descripcion', label:'Descripción' },
              { key:'categoria', label:'Categoría', render:r => CAT_LABEL[r.categoria] || r.categoria || '—' },
              { key:'monto', label:'Monto', render:r => fmt(r.monto) },
              { key:'creado_por', label:'Cargado por', render:r => r.creado_por_emp?.nombre || '—' },
              { key:'estado', label:'Estado', render:r => badgeEstado(r.estado) },
              { key:'acciones', label:'', render:r => (
                puedeAprobar && r.estado === 'pendiente' ? (
                  <div style={{ display:'flex', gap:6 }}>
                    <Btn small onClick={() => actualizarEstado(r.id, 'aprobado')}>Aprobar</Btn>
                    <Btn small variant="danger" onClick={() => actualizarEstado(r.id, 'rechazado')}>Rechazar</Btn>
                  </div>
                ) : r.aprobado_por_emp?.nombre ? <span style={{ fontSize:11, color:'var(--z-ghost)' }}>por {r.aprobado_por_emp.nombre}</span> : null
              ) },
            ]}
            rows={registros}
            empty="Sin movimientos de caja chica registrados"
          />
        </>}
      </PageContent>
    </Layout>
  )
}
