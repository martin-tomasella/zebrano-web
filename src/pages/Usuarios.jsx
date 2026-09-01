
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Layout, Topbar, PageContent, Avatar as SidebarAvatar } from '../components/Layout'
import { Badge, Avatar, Card, SectionTitle, Table, Spinner, Btn, Input } from '../components/ui'
import { ROLES, ROLES_SELECCIONABLES, MODULOS, CATEGORIAS_ORDEN, modulosPermitidos } from '../lib/permisos'

export default function Usuarios() {
  const { profile } = useAuth()
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ nombre:'', email:'', password:'', rol:'gestion', costo_hora_ars:'' })
  const [tab, setTab] = useState('usuarios') // usuarios | permisos

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
      // Alta via Edge Function con service_role (auth.admin.createUser +
      // email_confirm:true) en vez de supabase.auth.signUp() desde el
      // cliente -- asi el usuario nuevo queda con el email confirmado de
      // entrada y no requiere el parche manual por SQL de antes.
      const resp = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/crear-usuario-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          rol: form.rol,
          costo_hora_ars: form.costo_hora_ars,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || !data.ok) throw new Error(data.error || 'Error al crear usuario')
      setModal(false)
      setForm({ nombre:'', email:'', password:'', rol:'gestion', costo_hora_ars:'' })
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

  if (profile && profile.rol !== 'admin' && profile.rol !== 'gestion') {
    return (
      <Layout>
        <Topbar title="Usuarios" />
        <PageContent>
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>No ten&eacute;s permisos para ver esta secci&oacute;n.</div>
        </PageContent>
      </Layout>
    )
  }

  const esAdmin = profile?.rol === 'admin'

  return (
    <Layout>
      <Topbar
        title="Usuarios"
        subtitle={`${empleados.length} empleados registrados · ${empleados.filter(e=>e.activo).length} con acceso activo`}
        actions={
          esAdmin &&
          <Btn onClick={() => { setModal(true); setError('') }}>+ Nuevo usuario</Btn>
        }
      />
      <PageContent>
        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--z-bg-2)', padding:4, borderRadius:'var(--radius-md)', width:'fit-content' }}>
          {[['usuarios','Usuarios'],['permisos','Roles y permisos']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding:'7px 16px', fontSize:12, fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.05em',
              borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer',
              background: tab===k ? 'var(--z-primary)' : 'transparent',
              color: tab===k ? 'var(--z-on-primary)' : 'var(--z-text-3)',
              fontWeight: tab===k ? 700 : 500,
            }}>{l}</button>
          ))}
        </div>

        {tab === 'usuarios' ? (
          loading ? <Spinner /> : (
            <Table
              cols={[
                { key:'usuario', label:'Usuario', render: r => (
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Avatar name={r.nombre} size={32} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:13, color:'var(--z-text)' }}>{r.nombre}</div>
                      <div style={{ fontSize:11, color:'var(--z-text-3)', fontFamily:'var(--font-mono)' }}>{r.email || 'sin email'}</div>
                    </div>
                  </div>
                )},
                { key:'rol', label:'Rol', render: r => (
                  esAdmin ? (
                    <select value={r.rol||''} onChange={e => cambiarRol(r, e.target.value)} style={{
                      background:'var(--z-bg-2)', color:'var(--z-text)', border:'1px solid var(--z-border)',
                      borderRadius:'var(--radius-sm)', padding:'5px 10px', fontSize:12, fontFamily:'var(--font-mono)', outline:'none',
                    }}>
                      {ROLES_SELECCIONABLES.map(rol => <option key={rol} value={rol}>{ROLES[rol].label}</option>)}
                    </select>
                  ) : <Badge value={r.rol} />
                )},
                { key:'costo', label:'Costo/hora', render: r => r.costo_hora_ars ? `$${Number(r.costo_hora_ars).toLocaleString('es-AR')}/h` : '—' },
                { key:'estado', label:'Estado', render: r => (
                  <span style={{
                    fontSize:10, fontFamily:'var(--font-mono)', padding:'3px 9px', borderRadius:99, textTransform:'uppercase', letterSpacing:'0.05em',
                    background: r.activo ? 'rgba(172,210,146,0.15)' : 'rgba(255,180,171,0.15)',
                    color: r.activo ? '#acd292' : '#ffb4ab',
                    border: `1px solid ${r.activo ? 'rgba(172,210,146,0.3)' : 'rgba(255,180,171,0.3)'}`,
                  }}>{r.activo ? 'Activo' : 'Inactivo'}</span>
                )},
                { key:'acceso', label:'Acceso web', render: r => (
                  <span style={{ fontSize:12, color: r.auth_user_id ? '#acd292' : 'var(--z-text-3)' }}>
                    {r.auth_user_id ? '✓ Con acceso' : '— Sin acceso web'}
                  </span>
                )},
                { key:'acciones', label:'', render: r => (
                  esAdmin && r.auth_user_id !== profile?.auth_user_id ? (
                    <Btn variant="ghost" small onClick={() => toggleActivo(r)}>{r.activo ? 'Desactivar' : 'Activar'}</Btn>
                  ) : r.auth_user_id === profile?.auth_user_id ? (
                    <span style={{ fontSize:11, color:'var(--z-text-3)', fontFamily:'var(--font-mono)' }}>Tu cuenta</span>
                  ) : null
                )},
              ]}
              rows={empleados}
              empty="Sin empleados registrados"
            />
          )
        ) : (
          <MatrizPermisos />
        )}
      </PageContent>

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <Card style={{ width:440, padding:'28px 32px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontFamily:'var(--font-display)', margin:0, fontSize:18, color:'var(--z-text)' }}>Nuevo usuario</h2>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'var(--z-text-3)', cursor:'pointer', fontSize:18 }}>&times;</button>
            </div>
            <form onSubmit={crearUsuario}>
              <Input label="Nombre completo" value={form.nombre} onChange={e => setForm({...form,nombre:e.target.value})} placeholder="Ej: Carlos Pérez" required />
              <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="carlos@zebrano.com" required />
              <Input label="Contraseña" type="password" value={form.password} onChange={e => setForm({...form,password:e.target.value})} placeholder="Mínimo 6 caracteres" required />
              <Input label="Costo/hora (ARS)" type="number" value={form.costo_hora_ars} onChange={e => setForm({...form,costo_hora_ars:e.target.value})} placeholder="Ej: 2400" />
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--z-hint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>Rol</label>
                <select value={form.rol} onChange={e => setForm({...form,rol:e.target.value})} style={{
                  width:'100%', padding:'8px 12px', borderRadius:'var(--radius-sm)', border:'1px solid var(--z-border)',
                  background:'var(--z-bg-2)', color:'var(--z-text)', fontSize:13, outline:'none', fontFamily:'var(--font-mono)',
                }}>
                  {ROLES_SELECCIONABLES.map(rol => <option key={rol} value={rol}>{ROLES[rol].label}</option>)}
                </select>
                <p style={{ fontSize:11, color:'var(--z-text-3)', marginTop:6, lineHeight:1.5 }}>{ROLES[form.rol]?.descripcion}</p>
              </div>
              {error && <div style={{ background:'rgba(255,180,171,0.1)', color:'#ffb4ab', padding:'8px 12px', borderRadius:'var(--radius-sm)', fontSize:13, marginBottom:14, border:'1px solid rgba(255,180,171,0.25)' }}>{error}</div>}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
                <Btn disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Layout>
  )
}

// --- Matriz visual de Roles y Permisos ---
function MatrizPermisos() {
  const roles = Object.keys(ROLES)

  return (
    <div>
      {/* Tarjetas resumen por rol */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${roles.length},1fr)`, gap:12, marginBottom:28 }}>
        {roles.map(rol => (
          <Card key={rol} style={{ borderTop: `2px solid ${ROLES[rol].color}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:ROLES[rol].color, flexShrink:0 }} />
              <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:14, color:'var(--z-text)' }}>{ROLES[rol].label}</span>
            </div>
            <p style={{ fontSize:11.5, color:'var(--z-text-3)', lineHeight:1.6, margin:0 }}>{ROLES[rol].descripcion}</p>
          </Card>
        ))}
      </div>

      {/* Matriz por categoria */}
      {CATEGORIAS_ORDEN.map(categoria => {
        const modulosCategoria = MODULOS.filter(m => m.categoria === categoria)
        if (modulosCategoria.length === 0) return null
        return (
          <div key={categoria} style={{ marginBottom:24 }}>
            <SectionTitle>{categoria}</SectionTitle>
            <div style={{ border:'1px solid var(--z-border)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ background:'var(--z-bg-2)', padding:'8px 14px', textAlign:'left', fontFamily:'var(--font-mono)', fontSize:9, fontWeight:500, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.1em', borderBottom:'1px solid var(--z-border)' }}>M&oacute;dulo</th>
                    {roles.map(rol => (
                      <th key={rol} style={{ background:'var(--z-bg-2)', padding:'8px 14px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:9, fontWeight:500, color:ROLES[rol].color, textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--z-border)', whiteSpace:'nowrap' }}>{ROLES[rol].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modulosCategoria.map((modulo, i) => (
                    <tr key={modulo.key} style={{ background: i % 2 === 1 ? 'var(--z-zebra)' : 'transparent' }}>
                      <td style={{ padding:'9px 14px', color:'var(--z-text-2)', borderBottom: i < modulosCategoria.length-1 ? '1px solid var(--z-border)' : 'none', fontWeight:500 }}>{modulo.label}</td>
                      {roles.map(rol => {
                        const permitido = rol === 'admin' || modulosPermitidos(rol).includes(modulo.key)
                        return (
                          <td key={rol} style={{ padding:'9px 14px', textAlign:'center', borderBottom: i < modulosCategoria.length-1 ? '1px solid var(--z-border)' : 'none' }}>
                            {permitido
                              ? <span style={{ color:'#acd292', fontSize:14 }}>&check;</span>
                              : <span style={{ color:'var(--z-text-3)', opacity:0.4, fontSize:14 }}>&mdash;</span>
                            }
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <p style={{ fontSize:11, color:'var(--z-text-3)', marginTop:8, lineHeight:1.6 }}>
        Esta matriz controla tanto lo que cada rol ve en el men&uacute; lateral como el acceso directo por URL &mdash; un usuario sin permiso sobre un m&oacute;dulo es redirigido autom&aacute;ticamente si intenta entrar a esa ruta.
      </p>
    </div>
  )
}
