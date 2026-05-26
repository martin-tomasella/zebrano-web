import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn, user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/')
  }, [user, loading, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0A0D08' }}>
      <div style={{ width:24, height:24, border:'2px solid #4A6B36', borderTop:'2px solid #E8DFD0', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#0A0D08', position:'relative', overflow:'hidden',
    }}>
      <svg style={{ position:'absolute', right:0, bottom:0, opacity:0.06 }} width="500" height="400" viewBox="0 0 500 400">
        <g fill="#4A6B36">
          <polygon points="250,20 140,200 360,200"/>
          <polygon points="250,60 120,240 380,240"/>
          <polygon points="250,100 100,280 400,280"/>
          <rect x="225" y="270" width="50" height="50"/>
        </g>
      </svg>

      <div style={{
        background:'#080B06', border:'1px solid rgba(74,107,54,0.2)',
        borderRadius:12, padding:'44px 40px', width:'100%', maxWidth:380,
        position:'relative', zIndex:1,
      }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:28, fontWeight:300, fontStyle:'italic', color:'#E8DFD0', letterSpacing:'0.04em' }}>Zebrano</div>
          <div style={{ fontSize:9, color:'#2E4A22', letterSpacing:'0.2em', textTransform:'uppercase', marginTop:6 }}>sistema de gestión interno</div>
        </div>

        <form onSubmit={handleSubmit}>
          {[
            { label:'Email', type:'email', value:email, set:setEmail },
            { label:'Contraseña', type:'password', value:password, set:setPassword },
          ].map(f => (
            <div key={f.label} style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:9, color:'#2E4A22', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                required autoFocus={f.label==='Email'}
                style={{ width:'100%', padding:'9px 12px', borderRadius:5, border:'1px solid rgba(74,107,54,0.2)', background:'#0A0D08', color:'#E8DFD0', fontSize:13, outline:'none' }}
                onFocus={e => e.target.style.borderColor='#4A6B36'}
                onBlur={e  => e.target.style.borderColor='rgba(74,107,54,0.2)'}
              />
            </div>
          ))}

          {error && (
            <div style={{ background:'rgba(160,64,42,0.12)', color:'#C0604A', border:'1px solid rgba(160,64,42,0.25)', padding:'8px 12px', borderRadius:5, fontSize:12, marginBottom:14 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            width:'100%', marginTop:6, padding:'10px',
            background: submitting ? 'rgba(74,107,54,0.5)' : '#4A6B36',
            color:'#E8DFD0', border:'none', borderRadius:6,
            fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}>
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:28, fontSize:10, color:'#1E3014' }}>
          Zebrano m+a · uso interno
        </div>
      </div>
    </div>
  )
}
