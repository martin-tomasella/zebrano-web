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
      background:'#0A0D08', position:'relative', overflow:'hidden',
    }}>
      <svg style={{ position:'absolute', right:0, bottom:0, opacity:0.06 }} width="500" height="400" viewBox="0 0 500 400">
        <g fill="#4A6B36">
          <polygon points="250,20 140,200 360,200"/>
          <polygon points="250,60 120,240 380,240"/>
          <polygon points="250,100 100,280 400,280"/>
          <rect x="225" y="270" width="50" height="50"/>
          <polygon points="80,40 10,170 150,170"/>
          <polygon points="80,70 5,200 155,200"/>
          <rect x="65" y="195" width="30" height="35"/>
          <polygon points="420,30 350,160 490,160"/>
          <polygon points="420,60 345,190 495,190"/>
          <rect x="405" y="185" width="30" height="35"/>
        </g>
      </svg>

      <div style={{
        background:'#080B06',
        border:'1px solid rgba(74,107,54,0.2)',
        borderRadius:12, padding:'44px 40px',
        width:'100%', maxWidth:380,
        position:'relative', zIndex:1,
      }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:28, fontWeight:300, fontStyle:'italic', color:'#E8DFD0', letterSpacing:'0.04em' }}>Zebrano</div>
          <div style={{ fontSize:9, color:'#2E4A22', letterSpacing:'0.2em', textTransform:'uppercase', marginTop:6 }}>sistema de gestión interno</div>
        </div>

        <form onSubmit={handleSubmit}>
          {[
            { label:'Email', type:'email', value:email, set:setEmail, placeholder:'nombre@zebrano.com' },
            { label:'Contraseña', type:'password', value:password, set:setPassword, placeholder:'••••••••' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:9, color:'#2E4A22', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder} required autoFocus={f.label==='Email'}
                style={{
                  width:'100%', padding:'9px 12px', borderRadius:5,
                  border:'1px solid rgba(74,107,54,0.2)',
                  background:'#0A0D08', color:'#E8DFD0',
                  fontSize:13, outline:'none', fontFamily:"'Jost',sans-serif",
                }}
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

          <button type="submit" disabled={loading} style={{
            width:'100%', marginTop:6, padding:'10px',
            background: loading ? 'rgba(74,107,54,0.5)' : '#4A6B36',
            color:'#E8DFD0', border:'none', borderRadius:6,
            fontSize:12, fontWeight:400, letterSpacing:'0.1em',
            textTransform:'uppercase', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily:"'Jost',sans-serif",
          }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:28, fontSize:10, color:'#1E3014', letterSpacing:'0.05em' }}>
          Zebrano m+a · uso interno
        </div>
      </div>
    </div>
  )
}
