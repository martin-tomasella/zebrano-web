
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Layout, Icon } from '../components/Layout';

const ESTADOS = ['nuevo','contactado','calificado','cotizado','negociacion','ganado','perdido','dormido'];
const CANALES_MSG = ['whatsapp','instagram_dm','facebook_dm','tiktok_dm','email','telefono','presencial'];
const EC = { nuevo:'#60a5fa',contactado:'#a78bfa',calificado:'#fbbf24',cotizado:'#fb923c',negociacion:'#f472b6',ganado:'#4ade80',perdido:'#f87171',dormido:'#6b7280' };

export default function ProspectoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prospecto, setProspecto] = useState(null);
  const [conversaciones, setConversaciones] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [tab, setTab] = useState('conversacion');
  const [loading, setLoading] = useState(true);
  const [nuevoMsg, setNuevoMsg] = useState('');
  const [msgCanal, setMsgCanal] = useState('whatsapp');
  const [msgDir, setMsgDir] = useState('entrante');
  const [enviando, setEnviando] = useState(false);
  const [showAddCompra, setShowAddCompra] = useState(false);
  const [showAddPago, setShowAddPago] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const msgRef = useRef(null);

  const cargar = async () => {
    setLoading(true);
    const [p, c, h] = await Promise.all([
      supabase.from('prospectos').select('*').eq('id',id).single(),
      supabase.from('prospecto_conversaciones').select('*').eq('prospecto_id',id).order('created_at'),
      supabase.from('historial_compras').select('*').eq('prospecto_id',id).order('created_at',{ascending:false}),
    ]);
    setProspecto(p.data); setConversaciones(c.data||[]); setHistorial(h.data||[]);
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
    const { error } = await supabase.from('prospectos').update({estado:nuevoEstado}).eq('id',id);
    if (error) { alert('No se pudo cambiar el estado: ' + error.message); return; }
    setProspecto(p=>({...p,estado:nuevoEstado}));
  };

  const enviarMensaje = async () => {
    if (!nuevoMsg.trim()) return;
    setEnviando(true);
    const { error } = await supabase.from('prospecto_conversaciones').insert({ prospecto_id:id, canal:msgCanal, direccion:msgDir, contenido:nuevoMsg.trim(), tipo:'mensaje' });
    if (error) { alert('No se pudo registrar el mensaje: ' + error.message); setEnviando(false); return; }
    await supabase.from('prospectos').update({ultimo_contacto:new Date().toISOString()}).eq('id',id);
    setNuevoMsg(''); await cargar(); setEnviando(false);
  };

  const guardarCampo = async (campo, valor) => {
    const { error } = await supabase.from('prospectos').update({[campo]:valor}).eq('id',id);
    if (error) { alert('No se pudo guardar: ' + error.message); return; }
    setProspecto(p=>({...p,[campo]:valor}));
  };

  const convertirACliente = async () => {
    if (prospecto.convertido_a_cliente) return;
    setConvirtiendo(true);
    const nombreCompleto = [prospecto.nombre, prospecto.apellido].filter(Boolean).join(' ') || 'Sin nombre';
    const { data: nuevoCliente, error: errC } = await supabase.from('clientes').insert({
      nombre: nombreCompleto,
      telefono: prospecto.telefono,
      email: prospecto.email,
      origen_lead: prospecto.canal_origen,
      canal_social: prospecto.canal_origen,
      handle_social: prospecto.handle_rrss,
      notas: prospecto.notas,
    }).select().single();
    if (errC) { alert('No se pudo crear el cliente: ' + errC.message); setConvirtiendo(false); return; }
    const { error: errP } = await supabase.from('prospectos').update({ convertido_a_cliente:true, cliente_id:nuevoCliente.id }).eq('id',id);
    setConvirtiendo(false);
    if (errP) { alert('Cliente creado pero no se pudo vincular el prospecto: ' + errP.message); return; }
    setProspecto(p=>({...p, convertido_a_cliente:true, cliente_id:nuevoCliente.id}));
  };

  if (loading) return <Layout><div style={{padding:40,textAlign:'center',color:'var(--z-text-muted)'}}>Cargando...</div></Layout>;
  if (!prospecto) return <Layout><div style={{padding:40,textAlign:'center',color:'var(--z-error)'}}>Prospecto no encontrado</div></Layout>;

  const totalPagado = pagos.filter(p=>p.estado==='recibido'||p.estado==='verificado').reduce((s,p)=>s+p.monto,0);

  return (
    <Layout>
      <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
        {/* Header */}
        <div style={{height:56,padding:'0 20px',borderBottom:'1px solid var(--z-border)',display:'flex',alignItems:'center',gap:14,background:'rgba(10,7,16,0.8)',backdropFilter:'blur(12px)',flexShrink:0}}>
          <button onClick={()=>navigate('/prospectos')} style={{background:'rgba(74,107,54,0.08)',border:'1px solid var(--z-border)',color:'var(--z-text-2)',padding:'5px 12px',borderRadius:8,cursor:'pointer',fontSize:12}}>← Volver</button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:600,color:'var(--z-text)'}}>{prospecto.nombre||'Sin nombre'} {prospecto.apellido||''}</div>
            {prospecto.handle_rrss && <div style={{fontSize:11,color:'#4A6B36'}}>{prospecto.handle_rrss}</div>}
          </div>
          {/* Selector de estado */}
          <div style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'flex-end'}}>
            {ESTADOS.map(e=>(
              <button key={e} onClick={()=>cambiarEstado(e)} style={{padding:'3px 10px',fontSize:10,background:prospecto.estado===e?EC[e]+'22':'transparent',color:prospecto.estado===e?EC[e]:'var(--z-text-muted)',border:`1px solid ${prospecto.estado===e?EC[e]+'55':'var(--z-border)'}`,borderRadius:20,cursor:'pointer',textTransform:'capitalize',transition:'var(--z-transition)'}}>
                {e}
              </button>
            ))}
          </div>
          {prospecto.estado==='ganado' && (
            prospecto.convertido_a_cliente ? (
              <span style={{fontSize:10,color:'var(--z-success)',padding:'3px 10px',border:'1px solid var(--z-success)',borderRadius:20,whiteSpace:'nowrap'}}>✓ Cliente</span>
            ) : (
              <button onClick={convertirACliente} disabled={convirtiendo} className="btn btn-primary btn-sm" style={{fontSize:10,whiteSpace:'nowrap'}}>
                {convirtiendo?'Convirtiendo...':'Convertir a cliente'}
              </button>
            )
          )}
        </div>

        <div style={{flex:1,display:'flex',overflow:'hidden'}}>
          {/* Sidebar datos */}
          <div style={{width:260,minWidth:260,borderRight:'1px solid var(--z-border)',padding:16,overflowY:'auto',background:'var(--z-sidebar-bg)'}}>
            <div style={{fontSize:10,color:'var(--z-text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,fontWeight:600}}>Datos de contacto</div>
            {[['nombre','Nombre'],['apellido','Apellido'],['telefono','Teléfono'],['email','Email'],['handle_rrss','@handle']].map(([k,l])=>(
              <div key={k} style={{marginBottom:10}}>
                <label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em'}}>{l}</label>
                <input defaultValue={prospecto[k]||''} onBlur={e=>guardarCampo(k,e.target.value)} style={{fontSize:12}} />
              </div>
            ))}
            <div style={{height:1,background:'var(--z-border)',margin:'12px 0'}} />
            <div style={{fontSize:10,color:'var(--z-text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,fontWeight:600}}>Proyecto</div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em'}}>Tipo trabajo</label>
              <select value={prospecto.tipo_trabajo||''} onChange={e=>guardarCampo('tipo_trabajo',e.target.value)} style={{fontSize:12}}>
                <option value="">Sin definir</option>
                {['placard','cocina','mesa','escritorio','biblioteca','vestidor','baño','living','oficina','otro'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em'}}>Presupuesto estimado $</label>
              <input type="number" defaultValue={prospecto.presupuesto_estimado||''} onBlur={e=>guardarCampo('presupuesto_estimado',parseFloat(e.target.value)||null)} style={{fontSize:12}} />
            </div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em'}}>Próximo seguimiento</label>
              <input type="datetime-local" defaultValue={prospecto.proximo_seguimiento?new Date(prospecto.proximo_seguimiento).toISOString().slice(0,16):''} onBlur={e=>guardarCampo('proximo_seguimiento',e.target.value?new Date(e.target.value).toISOString():null)} style={{fontSize:12}} />
            </div>
            <div>
              <label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em'}}>Notas</label>
              <textarea rows={3} defaultValue={prospecto.notas||''} onBlur={e=>guardarCampo('notas',e.target.value)} style={{resize:'vertical',fontSize:12}} />
            </div>
            {(historial.length>0||pagos.length>0) && (
              <div style={{marginTop:14,padding:12,background:'rgba(74,107,54,0.06)',border:'1px solid var(--z-border)',borderRadius:'var(--z-radius)'}}>
                <div style={{fontSize:10,color:'var(--z-text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8,fontWeight:600}}>Resumen financiero</div>
                <div style={{fontSize:12,color:'var(--z-text-2)',marginBottom:3}}>Compras: <span style={{color:'var(--z-text)'}}>{historial.length}</span></div>
                <div style={{fontSize:12,color:'var(--z-text-2)',marginBottom:3}}>Cotizado: <span style={{color:'var(--z-warning)'}}>${historial.reduce((s,h)=>s+(h.monto_cotizado||0),0).toLocaleString('es-AR')}</span></div>
                <div style={{fontSize:12,color:'var(--z-text-2)'}}>Cobrado: <span style={{color:'var(--z-success)'}}>${totalPagado.toLocaleString('es-AR')}</span></div>
              </div>
            )}
          </div>

          {/* Panel principal */}
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Tabs */}
            <div style={{padding:'8px 16px',borderBottom:'1px solid var(--z-border)',display:'flex',gap:4,background:'var(--z-sidebar-bg)',flexShrink:0}}>
              {[['conversacion','💬 Conversación'],['historial','📋 Compras'],['pagos','💰 Pagos']].map(([t,l])=>(
                <button key={t} onClick={()=>setTab(t)} style={{padding:'6px 14px',fontSize:12,background:tab===t?'rgba(74,107,54,0.15)':'transparent',color:tab===t?'var(--z-text)':'var(--z-text-3)',border:`1px solid ${tab===t?'rgba(74,107,54,0.3)':'transparent'}`,borderRadius:8,cursor:'pointer',transition:'var(--z-transition)'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* TAB: CONVERSACIÓN */}
            {tab==='conversacion' && (
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
                  {conversaciones.length===0 && <div style={{textAlign:'center',padding:40,color:'var(--z-text-muted)'}}>Sin mensajes aún</div>}
                  {conversaciones.map(c=>(
                    <div key={c.id} style={{display:'flex',flexDirection:'column',alignItems:c.direccion==='saliente'?'flex-end':'flex-start'}}>
                      <div style={{fontSize:10,color:'var(--z-text-muted)',marginBottom:3}}>
                        {c.direccion==='saliente'?'Equipo':prospecto.nombre||'Cliente'} · {c.canal} · {new Date(c.created_at).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                      </div>
                      <div style={{maxWidth:'70%',padding:'8px 12px',borderRadius:c.direccion==='saliente'?'12px 12px 4px 12px':'12px 12px 12px 4px',background:c.direccion==='saliente'?'rgba(74,107,54,0.2)':'var(--z-card)',border:'1px solid var(--z-border)',fontSize:13,color:'var(--z-text)',lineHeight:1.5}}>
                        {c.contenido}
                      </div>
                    </div>
                  ))}
                  <div ref={msgRef} />
                </div>
                <div style={{padding:'10px 16px',borderTop:'1px solid var(--z-border)',background:'var(--z-sidebar-bg)',flexShrink:0}}>
                  <div style={{display:'flex',gap:6,marginBottom:6}}>
                    <select value={msgCanal} onChange={e=>setMsgCanal(e.target.value)} style={{flex:'none',width:'auto',fontSize:12}}>
                      {CANALES_MSG.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={msgDir} onChange={e=>setMsgDir(e.target.value)} style={{flex:'none',width:'auto',fontSize:12}}>
                      <option value="entrante">📥 Entrante</option>
                      <option value="saliente">📤 Saliente</option>
                    </select>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <input placeholder="Escribí el mensaje..." value={nuevoMsg} onChange={e=>setNuevoMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&enviarMensaje()} style={{flex:1,fontSize:12}} />
                    <button className="btn btn-primary btn-sm" onClick={enviarMensaje} disabled={enviando||!nuevoMsg.trim()}>
                      {enviando?'...':'Registrar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: HISTORIAL */}
            {tab==='historial' && (
              <div style={{flex:1,overflowY:'auto',padding:16}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
                  <span style={{fontSize:14,fontWeight:500,color:'var(--z-text)'}}>Historial de compras</span>
                  <button className="btn btn-primary btn-sm" onClick={()=>setShowAddCompra(true)}>+ Nueva compra</button>
                </div>
                {historial.length===0 ? <div style={{textAlign:'center',padding:40,color:'var(--z-text-muted)'}}>Sin compras registradas</div>
                : historial.map(h=>(
                  <div key={h.id} style={{background:'var(--z-card)',border:'1px solid var(--z-border)',borderRadius:'var(--z-radius-lg)',padding:'14px 18px',marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:500,color:'var(--z-text)'}}>{h.descripcion}</span>
                      <span className="badge" style={{textTransform:'capitalize'}}>{h.estado}</span>
                    </div>
                    <div style={{display:'flex',gap:20,fontSize:12}}>
                      {h.monto_cotizado&&<span style={{color:'var(--z-warning)'}}>Cotizado: ${h.monto_cotizado.toLocaleString('es-AR')}</span>}
                      {h.monto_final&&<span style={{color:'var(--z-success)'}}>Final: ${h.monto_final.toLocaleString('es-AR')}</span>}
                      {h.forma_pago&&<span style={{color:'var(--z-text-3)'}}>{h.forma_pago} · {h.condicion_pago}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: PAGOS */}
            {tab==='pagos' && (
              <div style={{flex:1,overflowY:'auto',padding:16}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
                  <div>
                    <span style={{fontSize:14,fontWeight:500,color:'var(--z-text)'}}>Pagos</span>
                    <span style={{fontSize:12,color:'var(--z-success)',marginLeft:12}}>Cobrado: ${totalPagado.toLocaleString('es-AR')}</span>
                  </div>
                  {historial.length>0&&<button className="btn btn-primary btn-sm" onClick={()=>setShowAddPago(true)}>+ Registrar pago</button>}
                </div>
                {pagos.length===0?<div style={{textAlign:'center',padding:40,color:'var(--z-text-muted)'}}>Sin pagos registrados</div>
                :pagos.map(p=>(
                  <div key={p.id} style={{background:'var(--z-card)',border:'1px solid var(--z-border)',borderRadius:'var(--z-radius-lg)',padding:'12px 18px',marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{fontSize:13,fontWeight:500,color:'var(--z-text)'}}>{p.concepto||'Pago'}</span>
                      <span style={{fontSize:14,color:p.estado==='recibido'||p.estado==='verificado'?'var(--z-success)':'var(--z-warning)',fontWeight:600}}>${p.monto.toLocaleString('es-AR')}</span>
                    </div>
                    <div style={{display:'flex',gap:16,marginTop:4,fontSize:11,color:'var(--z-text-3)'}}>
                      <span>{p.forma_pago||'—'}</span>
                      <span style={{textTransform:'capitalize'}}>{p.estado}</span>
                      {p.fecha_recibido&&<span>{new Date(p.fecha_recibido).toLocaleDateString('es-AR')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddCompra && <ModalCompra prospecto_id={id} onClose={()=>setShowAddCompra(false)} onSave={()=>{setShowAddCompra(false);cargar();}} />}
      {showAddPago && historial.length>0 && <ModalPago compras={historial} cliente_id={prospecto.cliente_id} onClose={()=>setShowAddPago(false)} onSave={()=>{setShowAddPago(false);cargar();}} />}
    </Layout>
  );
}

function ModalCompra({ prospecto_id, onClose, onSave }) {
  const [form, setForm] = useState({ descripcion:'', tipo_trabajo:'', monto_cotizado:'', monto_final:'', forma_pago:'transferencia', condicion_pago:'50-50', fecha_entrega_estimada:'', estado:'en_proceso', notas:'' });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.descripcion) return;
    setSaving(true);
    const { error } = await supabase.from('historial_compras').insert({ prospecto_id, ...form, monto_cotizado:form.monto_cotizado?parseFloat(form.monto_cotizado):null, monto_final:form.monto_final?parseFloat(form.monto_final):null });
    setSaving(false);
    if (error) { alert('No se pudo guardar la compra: ' + error.message); return; }
    onSave();
  };
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={onClose}>
      <div style={{background:'var(--z-card)',border:'1px solid var(--z-border)',borderRadius:'var(--z-radius-xl)',padding:28,width:480,maxHeight:'85vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <h2 style={{margin:0,fontSize:18}}>Nueva compra</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--z-text-3)',cursor:'pointer',fontSize:18}}>✕</button>
        </div>
        <div style={{display:'grid',gap:10}}>
          <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Descripción *</label><input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Ej: Placard 3 puertas" /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Cotizado $</label><input type="number" value={form.monto_cotizado} onChange={e=>setForm(f=>({...f,monto_cotizado:e.target.value}))} /></div>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Final $</label><input type="number" value={form.monto_final} onChange={e=>setForm(f=>({...f,monto_final:e.target.value}))} /></div>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Forma pago</label><select value={form.forma_pago} onChange={e=>setForm(f=>({...f,forma_pago:e.target.value}))}>{['efectivo','transferencia','cheque','cuotas','mixto'].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Condición</label><select value={form.condicion_pago} onChange={e=>setForm(f=>({...f,condicion_pago:e.target.value}))}>{['50-50','30-70','40-60','contado','a_entregar'].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Entrega estimada</label><input type="date" value={form.fecha_entrega_estimada} onChange={e=>setForm(f=>({...f,fecha_entrega_estimada:e.target.value}))} /></div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving||!form.descripcion}>{saving?'Guardando...':'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function ModalPago({ compras, cliente_id, onClose, onSave }) {
  const [form, setForm] = useState({ historial_compra_id:compras[0]?.id||'', concepto:'anticipo', monto:'', forma_pago:'transferencia', estado:'recibido', fecha_recibido:new Date().toISOString().split('T')[0], notas:'' });
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (!form.monto) return;
    setSaving(true);
    const { error } = await supabase.from('pagos').insert({ ...form, monto:parseFloat(form.monto), cliente_id });
    setSaving(false);
    if (error) { alert('No se pudo registrar el pago: ' + error.message); return; }
    onSave();
  };
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={onClose}>
      <div style={{background:'var(--z-card)',border:'1px solid var(--z-border)',borderRadius:'var(--z-radius-xl)',padding:28,width:420}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <h2 style={{margin:0,fontSize:18}}>Registrar pago</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--z-text-3)',cursor:'pointer',fontSize:18}}>✕</button>
        </div>
        <div style={{display:'grid',gap:10}}>
          <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Compra</label><select value={form.historial_compra_id} onChange={e=>setForm(f=>({...f,historial_compra_id:e.target.value}))}>{compras.map(c=><option key={c.id} value={c.id}>{c.descripcion}</option>)}</select></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Concepto</label><select value={form.concepto} onChange={e=>setForm(f=>({...f,concepto:e.target.value}))}>{['anticipo','cuota_1','cuota_2','saldo','pago_total','otro'].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Monto $ *</label><input type="number" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))} /></div>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Forma pago</label><select value={form.forma_pago} onChange={e=>setForm(f=>({...f,forma_pago:e.target.value}))}>{['efectivo','transferencia','cheque','mercadopago'].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
            <div><label style={{fontSize:10,color:'var(--z-text-3)',display:'block',marginBottom:3,textTransform:'uppercase'}}>Fecha recibido</label><input type="date" value={form.fecha_recibido} onChange={e=>setForm(f=>({...f,fecha_recibido:e.target.value}))} /></div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving||!form.monto}>{saving?'Guardando...':'Registrar'}</button>
        </div>
      </div>
    </div>
  );
}
