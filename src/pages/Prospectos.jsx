
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

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

const ESTADO_COLOR = {
  nuevo:'#60a5fa', contactado:'#a78bfa', calificado:'#fbbf24',
  cotizado:'#fb923c', negociacion:'#f472b6', ganado:'#4ade80', perdido:'#f87171', dormido:'#6b7280'
};

export default function Prospectos() {
  const [vista, setVista] = useState('pipeline'); // pipeline | lista
  const [prospectos, setProspectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCanal, setFiltroCanal] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('prospectos')
      .select('*, empleados(nombre)')
      .eq('activo', true)
      .order('created_at', { ascending: false });
    setProspectos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = prospectos.filter(p => {
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
    if (filtroCanal !== 'todos' && p.canal_origen !== filtroCanal) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (p.nombre||'').toLowerCase().includes(q) ||
             (p.telefono||'').includes(q) ||
             (p.handle_rrss||'').toLowerCase().includes(q);
    }
    return true;
  });

  const porEstado = (estado) => filtrados.filter(p => p.estado === estado);
  const total_valor = prospectos.filter(p=>p.estado==='ganado').reduce((s,p)=>s+(p.monto_final||p.presupuesto_estimado||0),0);

  const s = {
    page: { display:'flex', flexDirection:'column', height:'100%', background:'#0A0D08' },
    header: { padding:'16px 24px', borderBottom:'1px solid rgba(74,107,54,0.1)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#080B06' },
    titulo: { fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:22, fontWeight:300, fontStyle:'italic', color:'#E8DFD0' },
    body: { flex:1, overflowY:'auto', padding:24 },
    btn: (bg='#4A6B36') => ({ padding:'8px 16px', fontSize:12, background:bg, color:'#C8D9B8', border:'none', borderRadius:8, cursor:'pointer' }),
    ghost: { padding:'6px 12px', fontSize:11, background:'transparent', color:'#3A5030', border:'1px solid rgba(74,107,54,0.2)', borderRadius:8, cursor:'pointer' },
    input: { background:'#080B06', border:'1px solid rgba(74,107,54,0.2)', borderRadius:8, padding:'7px 12px', color:'#C8D9B8', fontSize:12, outline:'none' },
    card: (p) => ({
      background:'#080B06', border:'1px solid rgba(74,107,54,0.15)', borderRadius:10,
      padding:'12px 14px', marginBottom:8, cursor:'pointer',
      borderLeft:`3px solid ${ESTADO_COLOR[p.estado]||'#3A5030'}`,
      transition:'background 0.15s',
    }),
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={s.titulo}>Prospectos</span>
          <span style={{ fontSize:11, color:'#3A5030' }}>{prospectos.length} en total</span>
          {total_valor > 0 && <span style={{ fontSize:11, color:'#7AAE5A' }}>✓ ${total_valor.toLocaleString('es-AR')} ganados</span>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input style={s.input} placeholder="Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
          <div style={{ display:'flex', gap:2, background:'rgba(74,107,54,0.08)', borderRadius:8, padding:3 }}>
            {['pipeline','lista'].map(v=>(
              <button key={v} onClick={()=>setVista(v)} style={{ padding:'5px 12px', fontSize:11, background:vista===v?'rgba(74,107,54,0.2)':'transparent', color:vista===v?'#C8D9B8':'#3A5030', border:'none', borderRadius:6, cursor:'pointer', textTransform:'capitalize' }}>{v}</button>
            ))}
          </div>
          <button style={s.btn()} onClick={()=>setShowNuevo(true)}>+ Nuevo prospecto</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ padding:'10px 24px', borderBottom:'1px solid rgba(74,107,54,0.06)', display:'flex', gap:8, overflowX:'auto' }}>
        {['todos',...ESTADOS.map(e=>e.id)].map(e=>(
          <button key={e} onClick={()=>setFiltroEstado(e)} style={{ padding:'4px 12px', fontSize:11, background:filtroEstado===e?'rgba(74,107,54,0.2)':'transparent', color:filtroEstado===e?'#C8D9B8':'#3A5030', border:`1px solid ${filtroEstado===e?'rgba(74,107,54,0.3)':'rgba(74,107,54,0.1)'}`, borderRadius:20, cursor:'pointer', whiteSpace:'nowrap' }}>
            {e==='todos'?'Todos':ESTADOS.find(x=>x.id===e)?.label} {e!=='todos'&&`(${porEstado(e).length})`}
          </button>
        ))}
      </div>

      <div style={s.body}>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'#3A5030' }}>Cargando...</div>
        ) : vista === 'pipeline' ? (
          /* VISTA PIPELINE KANBAN */
          <div style={{ display:'flex', gap:16, overflowX:'auto', paddingBottom:16 }}>
            {ESTADOS.filter(e=>e.id!=='perdido').map(est => (
              <div key={est.id} style={{ minWidth:240, flex:'0 0 240px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, padding:'6px 10px', background:'rgba(74,107,54,0.06)', borderRadius:8 }}>
                  <span style={{ fontSize:11, color:est.color, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.08em' }}>{est.label}</span>
                  <span style={{ fontSize:11, color:'#3A5030', background:'rgba(74,107,54,0.1)', padding:'2px 8px', borderRadius:10 }}>{porEstado(est.id).length}</span>
                </div>
                {porEstado(est.id).map(p=>(
                  <div key={p.id} style={s.card(p)} onClick={()=>navigate(`/prospectos/${p.id}`)}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, color:'#C8D9B8', fontWeight:400 }}>{p.nombre||'Sin nombre'} {p.apellido||''}</span>
                      <span style={{ fontSize:14 }}>{CANALES[p.canal_origen]||'📱'}</span>
                    </div>
                    {p.handle_rrss && <div style={{ fontSize:11, color:'#4A6B36', marginBottom:4 }}>{p.handle_rrss}</div>}
                    {p.tipo_trabajo && <div style={{ fontSize:11, color:'#3A5030', textTransform:'capitalize' }}>{p.tipo_trabajo}</div>}
                    {p.presupuesto_estimado && <div style={{ fontSize:12, color:'#7AAE5A', marginTop:4 }}>${p.presupuesto_estimado.toLocaleString('es-AR')}</div>}
                    {p.proximo_seguimiento && (
                      <div style={{ fontSize:10, color: new Date(p.proximo_seguimiento)<new Date()?'#f87171':'#fbbf24', marginTop:6 }}>
                        🕐 {new Date(p.proximo_seguimiento).toLocaleDateString('es-AR')}
                      </div>
                    )}
                  </div>
                ))}
                {porEstado(est.id).length===0 && <div style={{ fontSize:11, color:'#1E3014', textAlign:'center', padding:16 }}>Sin prospectos</div>}
              </div>
            ))}
          </div>
        ) : (
          /* VISTA LISTA */
          <div>
            {filtrados.length===0 ? (
              <div style={{ textAlign:'center', padding:48, color:'#3A5030' }}>Sin prospectos</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(74,107,54,0.1)' }}>
                    {['Nombre','Canal','Tipo','Presupuesto','Estado','Seguimiento',''].map(h=>(
                      <th key={h} style={{ padding:'8px 12px', fontSize:10, color:'#3A5030', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(p=>(
                    <tr key={p.id} onClick={()=>navigate(`/prospectos/${p.id}`)} style={{ borderBottom:'1px solid rgba(74,107,54,0.06)', cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(74,107,54,0.04)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'10px 12px', color:'#C8D9B8', fontSize:13 }}>{p.nombre||'—'} {p.apellido||''}</td>
                      <td style={{ padding:'10px 12px', fontSize:14 }}>{CANALES[p.canal_origen]||'📱'} <span style={{ fontSize:11, color:'#3A5030' }}>{p.canal_origen||'—'}</span></td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#8A9E82', textTransform:'capitalize' }}>{p.tipo_trabajo||'—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#7AAE5A' }}>{p.presupuesto_estimado?`$${p.presupuesto_estimado.toLocaleString('es-AR')}`:'—'}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:10, padding:'3px 10px', borderRadius:20, background:`${ESTADO_COLOR[p.estado]}22`, color:ESTADO_COLOR[p.estado], textTransform:'capitalize' }}>{p.estado}</span>
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:11, color: p.proximo_seguimiento&&new Date(p.proximo_seguimiento)<new Date()?'#f87171':'#fbbf24' }}>
                        {p.proximo_seguimiento?new Date(p.proximo_seguimiento).toLocaleDateString('es-AR'):'—'}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <button style={{ padding:'4px 10px', fontSize:11, background:'rgba(74,107,54,0.1)', color:'#8A9E82', border:'none', borderRadius:6, cursor:'pointer' }}
                          onClick={e=>{e.stopPropagation();navigate(`/prospectos/${p.id}`);}}>Ver →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal nuevo prospecto */}
      {showNuevo && <NuevoProspectoModal onClose={()=>setShowNuevo(false)} onSave={()=>{setShowNuevo(false);cargar();}} />}
    </div>
  );
}

function NuevoProspectoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nombre:'', apellido:'', telefono:'', email:'', canal_origen:'instagram', handle_rrss:'', tipo_trabajo:'', presupuesto_estimado:'', notas:'' });
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    const { error } = await supabase.from('prospectos').insert({
      ...form,
      presupuesto_estimado: form.presupuesto_estimado ? parseFloat(form.presupuesto_estimado) : null,
      estado: 'nuevo',
    });
    setSaving(false);
    if (!error) onSave();
  };

  const campos = [
    ['nombre','Nombre','text'],['apellido','Apellido','text'],
    ['telefono','Teléfono','tel'],['email','Email','email'],
    ['handle_rrss','@usuario RRSS','text'],['presupuesto_estimado','Presupuesto estimado','number'],
  ];

  const s = {
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 },
    modal: { background:'#080B06', border:'1px solid rgba(74,107,54,0.2)', borderRadius:16, padding:28, width:500, maxHeight:'90vh', overflowY:'auto' },
    input: { width:'100%', background:'#0A0D08', border:'1px solid rgba(74,107,54,0.2)', borderRadius:8, padding:'8px 12px', color:'#C8D9B8', fontSize:13, outline:'none', boxSizing:'border-box' },
    label: { fontSize:10, color:'#3A5030', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4, display:'block' },
    btn: (bg='#4A6B36') => ({ padding:'10px 20px', fontSize:13, background:bg, color:'#C8D9B8', border:'none', borderRadius:8, cursor:'pointer' }),
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <span style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, color:'#E8DFD0', fontStyle:'italic' }}>Nuevo prospecto</span>
          <button style={{ background:'none', border:'none', color:'#3A5030', cursor:'pointer', fontSize:18 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {campos.map(([key,lbl,type])=>(
            <div key={key}>
              <label style={s.label}>{lbl}</label>
              <input type={type} style={s.input} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
            </div>
          ))}
          <div>
            <label style={s.label}>Canal origen</label>
            <select style={s.input} value={form.canal_origen} onChange={e=>setForm(f=>({...f,canal_origen:e.target.value}))}>
              {Object.entries(CANALES).map(([k,v])=><option key={k} value={k}>{v} {k}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Tipo de trabajo</label>
            <select style={s.input} value={form.tipo_trabajo} onChange={e=>setForm(f=>({...f,tipo_trabajo:e.target.value}))}>
              <option value="">Sin definir</option>
              {['placard','cocina','mesa','escritorio','biblioteca','vestidor','baño','living','oficina','otro'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop:12 }}>
          <label style={s.label}>Notas iniciales</label>
          <textarea rows={3} style={{ ...s.input, resize:'vertical' }} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} />
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button style={s.btn('transparent')} onClick={onClose}>Cancelar</button>
          <button style={s.btn()} onClick={guardar} disabled={saving}>{saving?'Guardando...':'Guardar prospecto'}</button>
        </div>
      </div>
    </div>
  );
}
