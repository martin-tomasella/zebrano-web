import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Table, Badge, Avatar, Spinner, Btn, Card } from '../components/ui'

const ROLES = ['admin', 'taller', 'ventas']

export default function Usuarios() {
  const { profile } = useAuth()
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [form, setForm] = useState({ nombre:'', email:'', password:'', rol:'taller', costo_hora_ars:0 })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('empleados').select('*').order('created_at')
    setEmpleados(data || [])
    setLoading(false)
  }

  async function crearUsuario(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // 1. Crear en Supabase Auth via Admin API (requiere service role — usamos signup público)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { nombre: form.nombre } }
      })

      if (authError) throw authError

      const userId = authData.user?.id
      if (!userId) throw new Error('No se pudo obtener el ID del usuario')

      // 2. Insertar en empleados
      const { error: empError } = await supabase.from('empleados').insert({
        nombre: form.nombre,
        email: form.email,
        rol: form.rol,
        costo_hora_ars: Number(form.costo_hora_ars),
        auth_user_id: userId,
        activo: true,
      })

      if (empError) throw empError

      setModal(false)
      setForm({ nombre:'', email:'', password:'', rol:'taller', costo_hora_ars:0 })
      load()
    } catch (err) {
      setError(err.message || 'Error al crear usuario')
    }
    setSaving(false)
  }

  async function toggleActivo(emp) {
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id)
    load()
  }

  async function cambiarRol(emp, nuevoRol) {
    await supabase.from('empleados').update({ rol: nuevoRol }).eq('id', emp.id)
    load()
  }

  // Solo admin puede ver esta página
  if (profile && profile.rol !== 'admin') {
    return (
      <Layout>
        <Topbar title="Usuarios" />
        <PageContent>
          <div style={{ textAlign:'center', padding:48, color:'var(--z-hint)' }}>
            No tenés permisos para ver esta sección.
          </div>
        </PageContent>
      </Layout>
    )
  }

  const cols = [
    { label:'Usuario', render: r => (
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <Avatar name={r.nombre} size={30} />
        <div>
          <div style={{ fontWeight:500 }}>{r.nombre}</div>
          <div style={{ fontSize:11, color:'var(--z-hint)' }}>{r.email}</div>
        </div>
      </div>
    )},
    { label:'Rol', render: r => (
      profile?.rol === 'admin'
        ? <select value={r.rol} onChange={e => cambiarRol(r, e.target.value)}
            style={{ padding:'4px 8px', borderRadius:'var(--radius-sm)', border:'0.5px solid var(--z-border)', fontSize:12, background:'#fff', cursor:'pointer' }}>
            {ROLES.map(rol => <option key={rol} value={rol}>{rol}</option>)}
          </select>
        : <Badge value={r.rol} />
    )},
    { label:'Costo/hora', render: r => (
      <span style={{ color:'var(--z-muted)', fontSize:12 }}>
        {r.costo_hora_ars ? '$' + Number(r.costo_hora_ars).toLocaleString('es-AR') + '/h' : '—'}
      </span>
    )},
    { label:'Estado', render: r => (
      <span style={{
        display:'inline-block', padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:500,
        background: r.activo ? '#E1F5EE' : '#FCEBEB',
        color: r.activo ? '#0F6E56' : '#A32D2D',
      }}>
        {r.activo ? 'Activo' : 'Inactivo'}
      </span>
    )},
    { label:'Acceso', render: r => (
      <span style={{ fontSize:11, color: r.auth_user_id ? '#1D9E75' : 'var(--z-hint)' }}>
        {r.auth_user_id ? '✓ Web' : '— Sin acceso web'}
      </span>
    )},
    { label:'', render: r => (
      r.auth_user_id !== profile?.auth_user_id
        ? <button onClick={() => toggleActivo(r)} style={{
            padding:'4px 12px', borderRadius:'var(--radius-sm)', fontSize:11, cursor:'pointer',
            background:'transparent', border:'0.5px solid var(--z-border)', color:'var(--z-muted)'
          }}>
            {r.activo ? 'Desactivar' : 'Activar'}
          </button>
        : <span style={{ fontSize:11, color:'var(--z-hint)' }}>Tu cuenta</span>
    )},
  ]

  return (
    <Layout>
      <Topbar
        title="Usuarios"
        subtitle={`${empleados.length} empleados registrados`}
        actions={
          profile?.rol === 'admin' &&
          <Btn onClick={() => { setModal(true); setError('') }}>+ Nuevo usuario</Btn>
        }
      />
      <PageContent>
        {loading ? <Spinner /> : <Table cols={cols} rows={empleados} empty="Sin empleados registrados" />}
      </PageContent>

      {/* Modal nuevo usuario */}
      {modal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{
            background:'#fff', borderRadius:'var(--radius-lg)', padding:'28px 32px',
            width:'100%', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,0.15)'
          }}>
            <div style={{ fontSize:16, fontWeight:500, marginBottom:20 }}>Nuevo usuario</div>

            <form onSubmit={crearUsuario}>
              {[
                { label:'Nombre completo', key:'nombre', type:'text', placeholder:'Ej: Carlos Pérez' },
                { label:'Email', key:'email', type:'email', placeholder:'carlos@zebrano.com' },
                { label:'Contraseña', key:'password', type:'password', placeholder:'Mínimo 6 caracteres' },
                { label:'Costo hora (ARS)', key:'costo_hora_ars', type:'number', placeholder:'Ej: 2400' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:12, color:'var(--z-muted)', marginBottom:4 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm({...form, [f.key]:e.target.value})}
                    placeholder={f.placeholder} required={f.key !== 'costo_hora_ars'}
                    style={{ width:'100%', padding:'8px 12px', borderRadius:'var(--radius-sm)', border:'0.5px solid var(--z-border)', fontSize:13, outline:'none' }}
                    onFocus={e => e.target.style.borderColor='var(--z-green)'}
                    onBlur={e  => e.target.style.borderColor='var(--z-border)'}
                  />
                </div>
              ))}

              <div style={{ marginBottom:20 }}>
                <label style={{ display:'block', fontSize:12, color:'var(--z-muted)', marginBottom:4 }}>Rol</label>
                <select value={form.rol} onChange={e => setForm({...form, rol:e.target.value})}
                  style={{ width:'100%', padding:'8px 12px', borderRadius:'var(--radius-sm)', border:'0.5px solid var(--z-border)', fontSize:13, background:'#fff' }}>
                  <option value="admin">Admin — acceso completo</option>
                  <option value="taller">Taller — producción y OTs</option>
                  <option value="ventas">Ventas — clientes y cotizador</option>
                </select>
              </div>

              {error && (
                <div style={{ background:'#FCEBEB', color:'#A32D2D', padding:'8px 12px', borderRadius:'var(--radius-sm)', fontSize:12, marginBottom:14 }}>
                  {error}
                </div>
              )}

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
                <Btn disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
