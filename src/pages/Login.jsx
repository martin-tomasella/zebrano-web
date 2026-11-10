
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BrandMark } from '../components/Layout'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true })
    })
  }, [navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(/invalid/i.test(err.message) ? 'El email o la contraseña no coinciden. Revisalos e intentá de nuevo.' : err.message); return }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
      {/* Panel de marca: chapa de zebrano */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden z-login-hero text-white">
        <div className="relative flex items-center gap-3">
          <BrandMark size={36} />
          <span className="text-[18px] font-bold" style={{ fontStretch: '92%' }}>Zebrano</span>
        </div>
        <div className="relative max-w-[440px]">
          <h1 className="text-white text-[34px] leading-[40px] font-[650] tracking-[-0.02em]">Del primer mensaje a la entrega, cada mueble en un solo lugar.</h1>
          <p className="mt-4 text-[15px] leading-[24px]" style={{ color: 'rgb(var(--z-nav-ink-c))' }}>Prospectos, cotizaciones, taller y finanzas del estudio.</p>
        </div>
        <div className="relative text-[12.5px]" style={{ color: 'rgb(var(--z-nav-ink-2-c))' }}>Zebrano · Muebles a medida · Buenos Aires</div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6 sm:p-12 z-login-side">
        <form onSubmit={handleLogin} className="w-full max-w-[380px] animate-in">
          <div className="lg:hidden flex items-center gap-3 mb-10"><BrandMark size={36} /><span className="text-[18px] font-bold text-z-ink">Zebrano</span></div>
          <h2 className="text-[26px] leading-[32px]">Ingresá a tu cuenta</h2>
          <p className="mt-1 mb-8 text-z-ink-3">Usá el email con el que te dieron de alta.</p>

          <label htmlFor="email" className="block text-[13px] font-semibold mb-[6px]">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@zebrano.com.ar" style={{ height: 42 }} />

          <label htmlFor="pass" className="block text-[13px] font-semibold mb-[6px] mt-4">Contraseña</label>
          <input id="pass" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ height: 42 }} />

          {error && (
            <div role="alert" className="mt-4 flex gap-2 items-start rounded-lg px-3 py-[10px] text-[13px] bg-z-danger/10 text-z-danger">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>{error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full mt-6" style={{ height: 44, fontSize: 14.5 }}>
            {loading ? <><span style={{ width: 16, height: 16, border: '2px solid rgb(255 255 255 / 0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Ingresando…</> : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

