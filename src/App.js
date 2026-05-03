import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login      from './pages/Login'
import Dashboard  from './pages/Dashboard'
import Proyectos  from './pages/Proyectos'
import Clientes   from './pages/Clientes'
import Ventas     from './pages/Ventas'
import Produccion from './pages/Produccion'
import Cotizador  from './pages/Cotizador'
import LandingPreview from './pages/Landing'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--z-bg)' }}>
      <div style={{ width:24, height:24, border:'2px solid #E1F5EE', borderTop:'2px solid #1D9E75', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/"          element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/proyectos" element={<PrivateRoute><Proyectos /></PrivateRoute>} />
      <Route path="/clientes"  element={<PrivateRoute><Clientes /></PrivateRoute>} />
      <Route path="/ventas"    element={<PrivateRoute><Ventas /></PrivateRoute>} />
      <Route path="/produccion"element={<PrivateRoute><Produccion /></PrivateRoute>} />
      <Route path="/cotizador" element={<PrivateRoute><Cotizador /></PrivateRoute>} />
      <Route path="/landing"   element={<PrivateRoute><LandingPreview /></PrivateRoute>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
