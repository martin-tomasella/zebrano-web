import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--z-bg)'
    }}>
      <div style={{
        background:'#fff', borderRadius:'var(--radius-lg)', border:'0.5px solid var(--z-border)',
        padding:'40px 36px', width:'100%', maxWidth:380,
        boxShadow:'0 4px 24px rgba(0,0,0,0.06)'
      }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:22, fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--z-text)' }}>Zebrano</div>
          <div style={{ fontSize:13, color:'var(--z-hint)', marginTop:4 }}>Sistema de gestión interno</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--z-muted)', marginBottom:4 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="nombre@zebrano.com" required autoFocus
              style={{
                width:'100%', padding:'9px 12px', borderRadius:'var(--radius-sm)',
                border:'0.5px solid var(--z-border)', fontSize:13, color:'var(--z-text)',
                outline:'none', background:'#fff'
              }}
              onFocus={e => e.target.style.borderColor='var(--z-green)'}
              onBlur={e  => e.target.style.borderColor='var(--z-border)'}
            />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--z-muted)', marginBottom:4 }}>Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{
                width:'100%', padding:'9px 12px', borderRadius:'var(--radius-sm)',
                border:'0.5px solid var(--z-border)', fontSize:13, color:'var(--z-text)',
                outline:'none', background:'#fff'
              }}
              onFocus={e => e.target.style.borderColor='var(--z-green)'}
              onBlur={e  => e.target.style.borderColor='var(--z-border)'}
            />
          </div>

          {error && (
            <div style={{ background:'#FCEBEB', color:'#A32D2D', padding:'8px 12px', borderRadius:'var(--radius-sm)', fontSize:12, marginBottom:14 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width:'100%', padding:'10px', background:'var(--z-green)', color:'#fff',
            border:'none', borderRadius:'var(--radius-md)', fontSize:14, fontWeight:500,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:24, fontSize:11, color:'var(--z-hint)' }}>
          Zebrano m+a · Sistema interno
        </div>
      </div>
    </div>
  )
}
