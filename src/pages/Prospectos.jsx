
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';

const ESTADOS = [
  { id: 'nuevo',       label: 'Nuevos',       color: '#60a5fa' },
  { id: 'contactado',  label: 'Contactados',  color: '#a78bfa' },
  { id: 'calificado',  label: 'Calificados',  color: '#fbbf24' },
  { id: 'cotizado',    label: 'Cotizados',    color: '#fb923c' },
  { id: 'negociacion', label: 'Negociación',  color: '#f472b6' },
  { id: 'ganado',      label: 'Ganados',      color: '#4ade80' },
  { id: 'perdido',     label: 'Perdidos',     color: '#f87171' },
];
const CANALES = { instagram:'📸', facebook:'👍', tiktok:'🎵', whatsapp:'💬', web:'🌐', referido:'🤝', otro:'📱' };
const EC = { nuevo:'#60a5fa', contactado:'#a78bfa', calificado:'#fbbf24', cotizado:'#fb923c', negociacion:'#f472b6', ganado:'#4ade80', perdido:'#f87171', dormido:'#6b7280' };

export default function Prospectos() {
  const [vista, setVista] = useState('pipeline');
  const [prospectos, setProspectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('prospectos').select('*').eq('activo', true).order('created_at', { ascending: false });
    setProspectos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = prospectos.filter(p => {
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (p.nombre||'').toLowerCase().includes(q) || (p.telefono||'').includes(q) || (p.handle_rrss||'').toLowerCase().includes(q);
    }
    return true;
  });

  const porEstado = (estado) => filtrados.filter(p => p.estado === estado);
  const totalGanado = prospectos.filter(p => p.estado === 'ganado').reduce((s, p) => s + (p.presupuesto_estimado || 0), 0);

  return (
    <Layout>
      <Topbar
        title="Prospectos"
        subtitle={`${prospectos.length} activos${totalGanado > 0 ? ` · $${totalGanado.toLocaleString('es-AR')} ganados` : ''}`}
        actions={
          <>
            <div style={{ display:'flex', gap:2, background:'rgba(74,107,54,0.08)', borderRadius:8, padding:3 }}>
              {['pipeline','lista'].map(v => (
                <button key={v} onClick={() => setVista(v)} style={{ padding:'5px 12px', fontSize:11, background: vista===v ? 'rgba(74,107,54,0.2)' : 'transparent', color: vista===v ? 'var(--z-text)' : 'var(--z-text-3)', border:'none', borderRadius:6, cursor:'pointer', textTransform:'capitalize' }}>{v}</button>
              ))}
            </div>
            <input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
              style={{ width:180, padding:'6px 12px', fontSize:12, background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:8, color:'var(--z-text)', outline:'none' }} />
            <button className="btn btn-primary btn-sm" onClick={() => setShowNuevo(true)}>+ Nuevo</button>
          </>
        }
      />

      {/* Filtros de estado */}
      <div style={{ padding:'10px 24px', borderBottom:'1px solid var(--z-border)', display:'flex', gap:6, overflowX:'auto', flexShrink:0, background:'var(--z-sidebar-bg)' }}>
        {['todos', ...ESTADOS.map(e => e.id)].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)} style={{
            padding:'4px 12px', fontSize:11, borderRadius:20, cursor:'pointer', whiteSpace:'nowrap',
            background: filtroEstado===e ? 'rgba(74,107,54,0.2)' : 'transparent',
            color: filtroEstado===e ? 'var(--z-text)' : 'var(--z-text-3)',
            border: `1px solid ${filtroEstado===e ? 'rgba(74,107,54,0.4)' : 'var(--z-border)'}`,
          }}>
            {e === 'todos' ? 'Todos' : ESTADOS.find(x => x.id === e)?.label} {e !== 'todos' && `(${porEstado(e).length})`}
          </button>
        ))}
      </div>

      <PageContent pad={vista === 'pipeline' ? '16px 24px' : 24}>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
        ) : vista === 'pipeline' ? (
          <div style={{ display:'flex', gap:14, overflowX:'auto', paddingBottom:8 }}>
            {ESTADOS.filter(e => e.id !== 'perdido').map(est => (
              <div key={est.id} style={{ minWidth:230, flex:'0 0 230px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, padding:'6px 10px', background:'var(--z-card)', borderRadius:8, border:'1px solid var(--z-border)' }}>
                  <span style={{ fontSize:11, color:est.color, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>{est.label}</span>
                  <span style={{ fontSize:11, color:'var(--z-text-3)', background:'rgba(74,107,54,0.1)', padding:'2px 8px', borderRadius:10 }}>{porEstado(est.id).length}</span>
                </div>
                {porEstado(est.id).map(p => (
                  <div key={p.id} onClick={() => navigate(`/prospectos/${p.id}`)}
                    style={{ background:'var(--z-card)', border:`1px solid var(--z-border)`, borderLeft:`3px solid ${EC[p.estado]||'#3A5030'}`, borderRadius:10, padding:'12px 14px', marginBottom:8, cursor:'pointer', transition:'var(--z-transition)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = EC[p.estado]+'66'; e.currentTarget.style.boxShadow = `0 4px 16px ${EC[p.estado]}22`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--z-border)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, color:'var(--z-text)', fontWeight:500 }}>{p.nombre||'Sin nombre'} {p.apellido||''}</span>
                      <span style={{ fontSize:14 }}>{CANALES[p.canal_origen]||'📱'}</span>
                    </div>
                    {p.handle_rrss && <div style={{ fontSize:11, color:'#4A6B36', marginBottom:4 }}>{p.handle_rrss}</div>}
                    {p.tipo_trabajo && <div style={{ fontSize:11, color:'var(--z-text-3)', textTransform:'capitalize' }}>{p.tipo_trabajo}</div>}
                    {p.presupuesto_estimado && <div style={{ fontSize:12, color:'var(--z-success)', marginTop:4 }}>${p.presupuesto_estimado.toLocaleString('es-AR')}</div>}
                    {p.proximo_seguimiento && (
                      <div style={{ fontSize:10, color: new Date(p.proximo_seguimiento)<new Date() ? 'var(--z-error)' : 'var(--z-warning)', marginTop:6 }}>
                        🕐 {new Date(p.proximo_seguimiento).toLocaleDateString('es-AR')}
                      </div>
                    )}
                  </div>
                ))}
                {porEstado(est.id).length === 0 && <div style={{ fontSize:11, color:'var(--z-text-muted)', textAlign:'center', padding:16 }}>Sin prospectos</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', overflow:'hidden' }}>
            {filtrados.length === 0 ? (
              <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Sin prospectos</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {['Nombre','Canal','Tipo','Presupuesto','Estado','Seguimiento'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(p => (
                    <tr key={p.id} onClick={() => navigate(`/prospectos/${p.id}`)} style={{ cursor:'pointer' }}>
                      <td style={{ fontWeight:500 }}>{p.nombre||'—'} {p.apellido||''}</td>
                      <td>{CANALES[p.canal_origen]||'📱'} <span style={{ fontSize:11, color:'var(--z-text-3)' }}>{p.canal_origen||'—'}</span></td>
                      <td style={{ textTransform:'capitalize', color:'var(--z-text-2)' }}>{p.tipo_trabajo||'—'}</td>
                      <td style={{ color:'var(--z-success)' }}>{p.presupuesto_estimado ? `$${p.presupuesto_estimado.toLocaleString('es-AR')}` : '—'}</td>
                      <td><span className="badge" style={{ background:EC[p.estado]+'18', color:EC[p.estado], border:`1px solid ${EC[p.estado]}33`, textTransform:'capitalize' }}>{p.estado}</span></td>
                      <td style={{ fontSize:11, color: p.proximo_seguimiento && new Date(p.proximo_seguimiento)<new Date() ? 'var(--z-error)' : 'var(--z-warning)' }}>
                        {p.proximo_seguimiento ? new Date(p.proximo_seguimiento).toLocaleDateString('es-AR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </PageContent>

      {showNuevo && <NuevoModal onClose={() => setShowNuevo(false)} onSave={() => { setShowNuevo(false); cargar(); }} />}
    </Layout>
  );
}

function NuevoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nombre:'', apellido:'', telefono:'', email:'', canal_origen:'instagram', handle_rrss:'', tipo_trabajo:'', presupuesto_estimado:'', notas:'' });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    await supabase.from('prospectos').insert({ ...form, presupuesto_estimado: form.presupuesto_estimado ? parseFloat(form.presupuesto_estimado) : null, estado:'nuevo' });
    setSaving(false);
    onSave();
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }} onClick={onClose}>
      <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-xl)', padding:28, width:500, maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:18 }}>Nuevo prospecto</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--z-text-3)', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[['nombre','Nombre'],['apellido','Apellido'],['telefono','Teléfono'],['email','Email'],['handle_rrss','@usuario RRSS'],['presupuesto_estimado','Presupuesto $']].map(([k,l]) => (
            <div key={k}>
              <label style={{ fontSize:11, color:'var(--z-text-3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</label>
              <input value={form[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize:11, color:'var(--z-text-3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Canal</label>
            <select value={form.canal_origen} onChange={e => setForm(f => ({...f,canal_origen:e.target.value}))}>
              {Object.entries(CANALES).map(([k,v]) => <option key={k} value={k}>{v} {k}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--z-text-3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Tipo trabajo</label>
            <select value={form.tipo_trabajo} onChange={e => setForm(f => ({...f,tipo_trabajo:e.target.value}))}>
              <option value="">Sin definir</option>
              {['placard','cocina','mesa','escritorio','biblioteca','vestidor','baño','living','oficina','otro'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop:12 }}>
          <label style={{ fontSize:11, color:'var(--z-text-3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Notas</label>
          <textarea rows={3} style={{ resize:'vertical' }} value={form.notas} onChange={e => setForm(f => ({...f,notas:e.target.value}))} />
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
