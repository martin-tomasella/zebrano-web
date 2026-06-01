
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent, Avatar } from '../components/Layout'

const ROLES = ['admin','ventas','taller']

export default function Usuarios() {
  const { profile } = useAuth()
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ nombre:'', email:'', password:'', rol:'taller', costo_hora_ars:'' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('empleados').select('*').order('created_at')
    setEmpleados(data || [])
    setLoading(false)
  }

  async function crearUsuario(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { nombre: form.nombre } }
      })
      if (authError) throw authError
      const userId = authData.user?.id
      if (!userId) throw new Error('No se pudo obtener el ID del usuario')
      const { error: empError } = await supabase.from('empleados').insert({
        nombre: form.nombre, email: form.email, rol: form.rol,
        costo_hora_ars: Number(form.costo_hora_ars) || 0,
        auth_user_id: userId, activo: true,
      })
      if (empError) throw empError
      setModal(false)
      setForm({ nombre:'', email:'', password:'', rol:'taller', costo_hora_ars:'' })
      load()
    } catch(err) { setError(err.message || 'Error al crear usuario') }
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

  if (profile && profile.rol !== 'admin') {
    return (
      <Layout>
        <Topbar title="Usuarios" />
        <PageContent>
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>No tenés permisos para ver esta sección.</div>
        </PageContent>
      </Layout>
    )
  }

  return (
    <Layout>
      <Topbar
        title="Usuarios"
        subtitle={`${empleados.length} empleados registrados`}
        actions={
          profile?.rol === 'admin' &&
          <button className="btn btn-primary btn-sm" onClick={() => { setModal(true); setError('') }}>+ Nuevo usuario</button>
        }
      />
      <PageContent>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
        ) : (
          <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', overflow:'hidden' }}>
            <table>
              <thead>
                <tr>
                  {['Usuario','Rol','Costo/hora','Estado','Acceso',''].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {empleados.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <Avatar name={r.nombre} size={32} />
                        <div>
                          <div style={{ fontWeight:500, fontSize:14 }}>{r.nombre}</div>
                          <div style={{ fontSize:12, color:'var(--z-text-3)' }}>{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {profile?.rol === 'admin'
                        ? <select value={r.rol||''} onChange={e => cambiarRol(r, e.target.value)} style={{ width:'auto', fontSize:13, padding:'5px 10px' }}>
                            {ROLES.map(rol => <option key={rol} value={rol}>{rol}</option>)}
                          </select>
                        : <span className="badge badge-primary" style={{ textTransform:'capitalize' }}>{r.rol}</span>
                      }
                    </td>
                    <td style={{ color:'var(--z-text-2)' }}>
                      {r.costo_hora_ars ? `$${Number(r.costo_hora_ars).toLocaleString('es-AR')}/h` : '—'}
                    </td>
                    <td>
                      <span className="badge" style={{ background: r.activo ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: r.activo ? 'var(--z-success)' : 'var(--z-error)', border: `1px solid ${r.activo ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                        {r.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ fontSize:13, color: r.auth_user_id ? 'var(--z-success)' : 'var(--z-text-muted)' }}>
                      {r.auth_user_id ? '✓ Web' : '— Sin acceso web'}
                    </td>
                    <td>
                      {r.auth_user_id !== profile?.auth_user_id
                        ? <button className="btn btn-ghost btn-sm" onClick={() => toggleActivo(r)}>
                            {r.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        : <span style={{ fontSize:12, color:'var(--z-text-muted)' }}>Tu cuenta</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContent>

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-xl)', padding:'28px 32px', width:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18 }}>Nuevo usuario</h2>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'var(--z-text-3)', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            <form onSubmit={crearUsuario}>
              {[
                { label:'Nombre completo', key:'nombre', type:'text', ph:'Ej: Carlos Pérez' },
                { label:'Email', key:'email', type:'email', ph:'carlos@zebrano.com' },
                { label:'Contraseña', key:'password', type:'password', ph:'Mínimo 6 caracteres' },
                { label:'Costo/hora (ARS)', key:'costo_hora_ars', type:'number', ph:'Ej: 2400' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'var(--z-text-3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm({...form,[f.key]:e.target.value})} placeholder={f.ph} required={f.key !== 'costo_hora_ars'} />
                </div>
              ))}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, color:'var(--z-text-3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Rol</label>
                <select value={form.rol} onChange={e => setForm({...form,rol:e.target.value})}>
                  <option value="admin">Admin — acceso completo</option>
                  <option value="ventas">Ventas — clientes y cotizador</option>
                  <option value="taller">Taller — producción y órdenes</option>
                </select>
              </div>
              {error && <div style={{ background:'rgba(248,113,113,0.1)', color:'var(--z-error)', padding:'8px 12px', borderRadius:8, fontSize:13, marginBottom:14, border:'1px solid rgba(248,113,113,0.2)' }}>{error}</div>}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
