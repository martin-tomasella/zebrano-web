
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ESTADOS = ['nuevo','contactado','calificado','cotizado','negociacion','ganado','perdido','dormido'];
const CANALES_MSG = ['whatsapp','instagram_dm','facebook_dm','tiktok_dm','email','telefono','presencial'];
const ESTADO_COLOR = {
  nuevo:'#60a5fa',contactado:'#a78bfa',calificado:'#fbbf24',
  cotizado:'#fb923c',negociacion:'#f472b6',ganado:'#4ade80',
  perdido:'#f87171',dormido:'#6b7280'
};

export default function ProspectoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prospecto, setProspecto] = useState(null);
  const [conversaciones, setConversaciones] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [tab, setTab] = useState('conversacion');
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [nuevoMsg, setNuevoMsg] = useState('');
  const [msgCanal, setMsgCanal] = useState('whatsapp');
  const [msgDir, setMsgDir] = useState('entrante');
  const [enviando, setEnviando] = useState(false);
  const [showAddCompra, setShowAddCompra] = useState(false);
  const [showAddPago, setShowAddPago] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState(null);
  const msgRef = useRef(null);

  const cargar = async () => {
    setLoading(true);
    const [p, c, h] = await Promise.all([
      supabase.from('prospectos').select('*, empleados(nombre)').eq('id',id).single(),
      supabase.from('prospecto_conversaciones').select('*, empleados(nombre)').eq('prospecto_id',id).order('created_at'),
      supabase.from('historial_compras').select('*').eq('prospecto_id',id).order('created_at',{ascending:false}),
    ]);
    setProspecto(p.data);
    setConversaciones(c.data||[]);
    setHistorial(h.data||[]);

    // Cargar pagos de todas las compras
    if (h.data?.length) {
      const ids = h.data.map(x=>x.id);
      const { data: pData } = await supabase.from('pagos').select('*').in('historial_compra_id',ids).order('created_at',{ascending:false});
      setPagos(pData||[]);
    }
    setLoading(false);
    setTimeout(()=>msgRef.current?.scrollIntoView({behavior:'smooth'}),100);
  };

  useEffect(()=>{ cargar(); },[id]);

  const cambiarEstado = async (nuevoEstado) => {
    await supabase.from('prospectos').update({estado:nuevoEstado,updated_at:new Date().toISOString()}).eq('id',id);
    setProspecto(p=>({...p,estado:nuevoEstado}));
  };

  const enviarMensaje = async () => {
    if (!nuevoMsg.trim()) return;
    setEnviando(true);
    await supabase.from('prospecto_conversaciones').insert({
      prospecto_id:id, canal:msgCanal, direccion:msgDir,
      contenido:nuevoMsg.trim(), tipo:'mensaje',
    });
    await supabase.from('prospectos').update({ultimo_contacto:new Date().toISOString()}).eq('id',id);
    setNuevoMsg('');
    await cargar();
    setEnviando(false);
  };

  const guardarEdicion = async (campo, valor) => {
    await supabase.from('prospectos').update({[campo]:valor,updated_at:new Date().toISOString()}).eq('id',id);
    setProspecto(p=>({...p,[campo]:valor}));
  };

  if (loading) return <div style={{padding:40,textAlign:'center',color:'#3A5030'}}>Cargando...</div>;
  if (!prospecto) return <div style={{padding:40,textAlign:'center',color:'#f87171'}}>Prospecto no encontrado</div>;

  const s = {
    page: { display:'flex', flexDirection:'column', height:'100%', background:'#0A0D08' },
    header: { padding:'14px 24px', borderBottom:'1px solid rgba(74,107,54,0.1)', display:'flex', alignItems:'center', gap:16, background:'#080B06' },
    body: { flex:1, display:'flex', overflow:'hidden' },
    sidebar: { width:280, minWidth:280, borderRight:'1px solid rgba(74,107,54,0.1)', padding:20, overflowY:'auto' },
    main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
    input: { width:'100%', background:'#0A0D08', border:'1px solid rgba(74,107,54,0.2)', borderRadius:8, padding:'8px 12px', color:'#C8D9B8', fontSize:12, outline:'none', boxSizing:'border-box' },
    label: { fontSize:9, color:'#2E4A22', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3, display:'block' },
    btn: (bg='#4A6B36',sm=false) => ({ padding:sm?'5px 12px':'8px 16px', fontSize:sm?11:12, background:bg, color:'#C8D9B8', border:'none', borderRadius:8, cursor:'pointer' }),
    msgBubble: (dir) => ({
      maxWidth:'70%', padding:'8px 12px', borderRadius:dir==='saliente'?'12px 12px 4px 12px':'12px 12px 12px 4px',
      background:dir==='saliente'?'rgba(74,107,54,0.2)':'rgba(74,107,54,0.06)',
      alignSelf:dir==='saliente'?'flex-end':'flex-start',
      fontSize:13, color:'#C8D9B8', lineHeight:1.5,
    }),
  };

  const totalPagado = pagos.filter(p=>p.estado==='recibido'||p.estado==='verificado').reduce((s,p)=>s+p.monto,0);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={{...s.btn('transparent',true),color:'#3A5030'}} onClick={()=>navigate('/prospectos')}>← Volver</button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, color:'#E8DFD0', fontStyle:'italic' }}>
            {prospecto.nombre||'Sin nombre'} {prospecto.apellido||''}
          </div>
          {prospecto.handle_rrss && <div style={{ fontSize:11, color:'#4A6B36' }}>{prospecto.handle_rrss}</div>}
        </div>
        {/* Selector de estado */}
        <div style={{ display:'flex', gap:4 }}>
          {ESTADOS.map(e=>(
            <button key={e} onClick={()=>cambiarEstado(e)} style={{ padding:'4px 10px', fontSize:10, background:prospecto.estado===e?`${ESTADO_COLOR[e]}33`:'transparent', color:prospecto.estado===e?ESTADO_COLOR[e]:'#2E4A22', border:`1px solid ${prospecto.estado===e?ESTADO_COLOR[e]:'rgba(74,107,54,0.1)'}`, borderRadius:20, cursor:'pointer', textTransform:'capitalize' }}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div style={s.body}>
        {/* Sidebar con datos del prospecto */}
        <div style={s.sidebar}>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, color:'#2E4A22', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Datos de contacto</div>
            {[
              ['nombre','Nombre'],['apellido','Apellido'],
              ['telefono','Teléfono'],['email','Email'],
              ['handle_rrss','@handle RRSS'],
            ].map(([k,lbl])=>(
              <div key={k} style={{ marginBottom:10 }}>
                <label style={s.label}>{lbl}</label>
                <input style={s.input} defaultValue={prospecto[k]||''} onBlur={e=>guardarEdicion(k,e.target.value)} />
              </div>
            ))}
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, color:'#2E4A22', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Proyecto</div>
            <div style={{ marginBottom:8 }}>
              <label style={s.label}>Tipo de trabajo</label>
              <select style={s.input} value={prospecto.tipo_trabajo||''} onChange={e=>guardarEdicion('tipo_trabajo',e.target.value)}>
                <option value="">Sin definir</option>
                {['placard','cocina','mesa','escritorio','biblioteca','vestidor','baño','living','oficina','otro'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:8 }}>
              <label style={s.label}>Presupuesto estimado ($)</label>
              <input type="number" style={s.input} defaultValue={prospecto.presupuesto_estimado||''} onBlur={e=>guardarEdicion('presupuesto_estimado',parseFloat(e.target.value)||null)} />
            </div>
            <div style={{ marginBottom:8 }}>
              <label style={s.label}>Presupuesto del cliente ($)</label>
              <input type="number" style={s.input} defaultValue={prospecto.presupuesto_cliente||''} onBlur={e=>guardarEdicion('presupuesto_cliente',parseFloat(e.target.value)||null)} />
            </div>
            <div>
              <label style={s.label}>Próximo seguimiento</label>
              <input type="datetime-local" style={s.input}
                defaultValue={prospecto.proximo_seguimiento?new Date(prospecto.proximo_seguimiento).toISOString().slice(0,16):''}
                onBlur={e=>guardarEdicion('proximo_seguimiento',e.target.value?new Date(e.target.value).toISOString():null)} />
            </div>
          </div>

          <div>
            <label style={s.label}>Notas</label>
            <textarea rows={4} style={{...s.input,resize:'vertical'}} defaultValue={prospecto.notas||''} onBlur={e=>guardarEdicion('notas',e.target.value)} />
          </div>

          {/* Resumen financiero */}
          {(historial.length>0||pagos.length>0) && (
            <div style={{ marginTop:20, padding:'14px', background:'rgba(74,107,54,0.05)', borderRadius:10, border:'1px solid rgba(74,107,54,0.1)' }}>
              <div style={{ fontSize:10, color:'#2E4A22', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Resumen financiero</div>
              <div style={{ fontSize:12, color:'#3A5030', marginBottom:4 }}>Compras: <span style={{color:'#C8D9B8'}}>{historial.length}</span></div>
              <div style={{ fontSize:12, color:'#3A5030', marginBottom:4 }}>Total cotizado: <span style={{color:'#fbbf24'}}>${historial.reduce((s,h)=>s+(h.monto_cotizado||0),0).toLocaleString('es-AR')}</span></div>
              <div style={{ fontSize:12, color:'#3A5030' }}>Total cobrado: <span style={{color:'#4ade80'}}>${totalPagado.toLocaleString('es-AR')}</span></div>
            </div>
          )}
        </div>

        {/* Panel principal */}
        <div style={s.main}>
          {/* Tabs */}
          <div style={{ padding:'10px 20px', borderBottom:'1px solid rgba(74,107,54,0.1)', display:'flex', gap:4 }}>
            {[['conversacion','💬 Conversación'],['historial','📋 Historial compras'],['pagos','💰 Pagos']].map(([t,lbl])=>(
              <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 14px', fontSize:12, background:tab===t?'rgba(74,107,54,0.15)':'transparent', color:tab===t?'#C8D9B8':'#3A5030', border:'none', borderRadius:8, cursor:'pointer' }}>{lbl}</button>
            ))}
          </div>

          {/* TAB: CONVERSACIÓN */}
          {tab==='conversacion' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
                {conversaciones.length===0 && <div style={{textAlign:'center',padding:40,color:'#3A5030'}}>Sin mensajes aún</div>}
                {conversaciones.map(c=>(
                  <div key={c.id} style={{ display:'flex', flexDirection:'column', alignItems:c.direccion==='saliente'?'flex-end':'flex-start' }}>
                    <div style={{ fontSize:10, color:'#2E4A22', marginBottom:3 }}>
                      {c.direccion==='saliente'?(c.empleados?.nombre||'Equipo'):prospecto.nombre||'Cliente'} · {c.canal} · {new Date(c.created_at).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                    </div>
                    <div style={s.msgBubble(c.direccion)}>{c.contenido}</div>
                  </div>
                ))}
                <div ref={msgRef} />
              </div>

              {/* Input de mensaje */}
              <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(74,107,54,0.1)', background:'#080B06' }}>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <select style={{...s.input,width:'auto',flex:'none'}} value={msgCanal} onChange={e=>setMsgCanal(e.target.value)}>
                    {CANALES_MSG.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <select style={{...s.input,width:'auto',flex:'none'}} value={msgDir} onChange={e=>setMsgDir(e.target.value)}>
                    <option value="entrante">📥 Entrante</option>
                    <option value="saliente">📤 Saliente</option>
                  </select>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input style={{...s.input,flex:1}} placeholder="Escribí el mensaje o nota..." value={nuevoMsg} onChange={e=>setNuevoMsg(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&enviarMensaje()} />
                  <button style={s.btn()} onClick={enviarMensaje} disabled={enviando||!nuevoMsg.trim()}>
                    {enviando?'...':'Registrar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: HISTORIAL COMPRAS */}
          {tab==='historial' && (
            <div style={{ flex:1, overflowY:'auto', padding:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                <span style={{ fontSize:14, color:'#C8D9B8' }}>Historial de compras</span>
                <button style={s.btn()} onClick={()=>setShowAddCompra(true)}>+ Nueva compra</button>
              </div>
              {historial.length===0 ? (
                <div style={{textAlign:'center',padding:40,color:'#3A5030'}}>Sin compras registradas</div>
              ) : historial.map(h=>(
                <div key={h.id} style={{ background:'#080B06', border:'1px solid rgba(74,107,54,0.15)', borderRadius:10, padding:'14px 18px', marginBottom:12, cursor:'pointer' }}
                  onClick={()=>setSelectedCompra(h)}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:13, color:'#C8D9B8', fontWeight:400 }}>{h.descripcion}</span>
                    <span style={{ fontSize:11, padding:'2px 10px', borderRadius:20, background:'rgba(74,107,54,0.1)', color:'#8A9E82', textTransform:'capitalize' }}>{h.estado}</span>
                  </div>
                  <div style={{ display:'flex', gap:20, fontSize:12 }}>
                    {h.monto_cotizado && <span style={{color:'#fbbf24'}}>Cotizado: ${h.monto_cotizado.toLocaleString('es-AR')}</span>}
                    {h.monto_final && <span style={{color:'#4ade80'}}>Final: ${h.monto_final.toLocaleString('es-AR')}</span>}
                    {h.forma_pago && <span style={{color:'#3A5030'}}>{h.forma_pago}</span>}
                  </div>
                  {h.fecha_entrega_estimada && <div style={{fontSize:11,color:'#3A5030',marginTop:4}}>Entrega: {new Date(h.fecha_entrega_estimada).toLocaleDateString('es-AR')}</div>}
                </div>
              ))}
            </div>
          )}

          {/* TAB: PAGOS */}
          {tab==='pagos' && (
            <div style={{ flex:1, overflowY:'auto', padding:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                <div>
                  <span style={{ fontSize:14, color:'#C8D9B8' }}>Pagos</span>
                  <span style={{ fontSize:12, color:'#4ade80', marginLeft:12 }}>Cobrado: ${totalPagado.toLocaleString('es-AR')}</span>
                </div>
                {historial.length>0 && <button style={s.btn()} onClick={()=>setShowAddPago(true)}>+ Registrar pago</button>}
              </div>
              {pagos.length===0 ? (
                <div style={{textAlign:'center',padding:40,color:'#3A5030'}}>Sin pagos registrados</div>
              ) : pagos.map(p=>(
                <div key={p.id} style={{ background:'#080B06', border:'1px solid rgba(74,107,54,0.15)', borderRadius:10, padding:'12px 18px', marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, color:'#C8D9B8' }}>{p.concepto||'Pago'}</span>
                    <span style={{ fontSize:14, color: p.estado==='recibido'||p.estado==='verificado'?'#4ade80':'#fbbf24', fontWeight:400 }}>${p.monto.toLocaleString('es-AR')}</span>
                  </div>
                  <div style={{ display:'flex', gap:16, marginTop:4, fontSize:11, color:'#3A5030' }}>
                    <span>{p.forma_pago||'—'}</span>
                    <span style={{color:p.estado==='recibido'?'#4ade80':'#fbbf24',textTransform:'capitalize'}}>{p.estado}</span>
                    {p.fecha_recibido && <span>{new Date(p.fecha_recibido).toLocaleDateString('es-AR')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal agregar compra */}
      {showAddCompra && <ModalCompra prospecto_id={id} onClose={()=>setShowAddCompra(false)} onSave={()=>{setShowAddCompra(false);cargar();}} />}

      {/* Modal agregar pago */}
      {showAddPago && historial.length>0 && (
        <ModalPago compras={historial} cliente_id={prospecto.cliente_id} onClose={()=>setShowAddPago(false)} onSave={()=>{setShowAddPago(false);cargar();}} />
      )}
    </div>
  );
}

function ModalCompra({ prospecto_id, onClose, onSave }) {
  const [form, setForm] = useState({ descripcion:'', tipo_trabajo:'', monto_cotizado:'', monto_final:'', forma_pago:'transferencia', condicion_pago:'50-50', fecha_entrega_estimada:'', estado:'en_proceso', notas:'' });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.descripcion) return;
    setSaving(true);
    await supabase.from('historial_compras').insert({
      prospecto_id, ...form,
      monto_cotizado: form.monto_cotizado ? parseFloat(form.monto_cotizado) : null,
      monto_final: form.monto_final ? parseFloat(form.monto_final) : null,
    });
    setSaving(false);
    onSave();
  };
  const s = {
    overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100},
    modal:{background:'#080B06',border:'1px solid rgba(74,107,54,0.2)',borderRadius:16,padding:28,width:480,maxHeight:'85vh',overflowY:'auto'},
    input:{width:'100%',background:'#0A0D08',border:'1px solid rgba(74,107,54,0.2)',borderRadius:8,padding:'8px 12px',color:'#C8D9B8',fontSize:12,outline:'none',boxSizing:'border-box'},
    label:{fontSize:9,color:'#2E4A22',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3,display:'block'},
    btn:(bg='#4A6B36')=>({padding:'9px 18px',fontSize:12,background:bg,color:'#C8D9B8',border:'none',borderRadius:8,cursor:'pointer'}),
  };
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <span style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:20,color:'#E8DFD0',fontStyle:'italic'}}>Nueva compra</span>
          <button style={{background:'none',border:'none',color:'#3A5030',cursor:'pointer',fontSize:18}} onClick={onClose}>✕</button>
        </div>
        <div style={{display:'grid',gap:10}}>
          <div><label style={s.label}>Descripción *</label><input style={s.input} value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Ej: Placard 3 puertas roble" /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={s.label}>Monto cotizado $</label><input type="number" style={s.input} value={form.monto_cotizado} onChange={e=>setForm(f=>({...f,monto_cotizado:e.target.value}))} /></div>
            <div><label style={s.label}>Monto final $</label><input type="number" style={s.input} value={form.monto_final} onChange={e=>setForm(f=>({...f,monto_final:e.target.value}))} /></div>
            <div><label style={s.label}>Forma de pago</label>
              <select style={s.input} value={form.forma_pago} onChange={e=>setForm(f=>({...f,forma_pago:e.target.value}))}>
                {['efectivo','transferencia','cheque','cuotas','mixto'].map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div><label style={s.label}>Condición</label>
              <select style={s.input} value={form.condicion_pago} onChange={e=>setForm(f=>({...f,condicion_pago:e.target.value}))}>
                {['50-50','30-70','40-60','contado','a_entregar','cuotas'].map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div><label style={s.label}>Entrega estimada</label><input type="date" style={s.input} value={form.fecha_entrega_estimada} onChange={e=>setForm(f=>({...f,fecha_entrega_estimada:e.target.value}))} /></div>
            <div><label style={s.label}>Estado</label>
              <select style={s.input} value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                {['en_proceso','entregado','cobrado','cancelado'].map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
          <div><label style={s.label}>Notas</label><textarea rows={2} style={{...s.input,resize:'vertical'}} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} /></div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button style={s.btn('transparent')} onClick={onClose}>Cancelar</button>
          <button style={s.btn()} onClick={guardar} disabled={saving||!form.descripcion}>{saving?'Guardando...':'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function ModalPago({ compras, cliente_id, onClose, onSave }) {
  const [form, setForm] = useState({ historial_compra_id: compras[0]?.id||'', concepto:'anticipo', monto:'', forma_pago:'transferencia', estado:'recibido', fecha_recibido:new Date().toISOString().split('T')[0], notas:'' });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.monto) return;
    setSaving(true);
    await supabase.from('pagos').insert({ ...form, monto:parseFloat(form.monto), cliente_id });
    setSaving(false);
    onSave();
  };
  const s = {
    overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100},
    modal:{background:'#080B06',border:'1px solid rgba(74,107,54,0.2)',borderRadius:16,padding:28,width:420},
    input:{width:'100%',background:'#0A0D08',border:'1px solid rgba(74,107,54,0.2)',borderRadius:8,padding:'8px 12px',color:'#C8D9B8',fontSize:12,outline:'none',boxSizing:'border-box'},
    label:{fontSize:9,color:'#2E4A22',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3,display:'block'},
    btn:(bg='#4A6B36')=>({padding:'9px 18px',fontSize:12,background:bg,color:'#C8D9B8',border:'none',borderRadius:8,cursor:'pointer'}),
  };
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <span style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:20,color:'#E8DFD0',fontStyle:'italic'}}>Registrar pago</span>
          <button style={{background:'none',border:'none',color:'#3A5030',cursor:'pointer',fontSize:18}} onClick={onClose}>✕</button>
        </div>
        <div style={{display:'grid',gap:10}}>
          <div><label style={s.label}>Compra</label>
            <select style={s.input} value={form.historial_compra_id} onChange={e=>setForm(f=>({...f,historial_compra_id:e.target.value}))}>
              {compras.map(c=><option key={c.id} value={c.id}>{c.descripcion} {c.monto_final?`($${c.monto_final.toLocaleString('es-AR')})`:''}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={s.label}>Concepto</label>
              <select style={s.input} value={form.concepto} onChange={e=>setForm(f=>({...f,concepto:e.target.value}))}>
                {['anticipo','cuota_1','cuota_2','saldo','pago_total','otro'].map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div><label style={s.label}>Monto $*</label><input type="number" style={s.input} value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))} /></div>
            <div><label style={s.label}>Forma de pago</label>
              <select style={s.input} value={form.forma_pago} onChange={e=>setForm(f=>({...f,forma_pago:e.target.value}))}>
                {['efectivo','transferencia','cheque','mercadopago','otro'].map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div><label style={s.label}>Estado</label>
              <select style={s.input} value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                {['pendiente','recibido','verificado','rechazado'].map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div><label style={s.label}>Fecha recibido</label><input type="date" style={s.input} value={form.fecha_recibido} onChange={e=>setForm(f=>({...f,fecha_recibido:e.target.value}))} /></div>
          </div>
          <div><label style={s.label}>Notas</label><textarea rows={2} style={{...s.input,resize:'vertical'}} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} /></div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button style={s.btn('transparent')} onClick={onClose}>Cancelar</button>
          <button style={s.btn()} onClick={guardar} disabled={saving||!form.monto}>{saving?'Guardando...':'Registrar'}</button>
        </div>
      </div>
    </div>
  );
}
