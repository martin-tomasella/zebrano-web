
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent } from '../components/Layout';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const EC = {
  borrador:   { bg:'rgba(251,191,36,0.1)',  text:'#fbbf24' },
  programado: { bg:'rgba(96,165,250,0.1)',  text:'#60a5fa' },
  publicando: { bg:'rgba(167,139,250,0.1)', text:'#a78bfa' },
  publicado:  { bg:'rgba(74,222,128,0.1)',  text:'#4ade80' },
  error:      { bg:'rgba(248,113,113,0.1)', text:'#f87171' },
};

export default function TikTok() {
  const [conectado, setConectado] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState(null);

  const flash = (texto, tipo = 'ok') => { setMsg({ texto, tipo }); setTimeout(() => setMsg(null), 4000); };

  const cargar = async () => {
    setLoading(true);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-manager`, {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ANON_KEY}`},
      body: JSON.stringify({ accion:'status' }),
    });
    const s = await resp.json();
    setConectado(s.conectado); setTokenInfo(s.token);
    const { data } = await supabase.from('tiktok_publicaciones').select('*, galeria_trabajos(thumbnail_url,tipo_trabajo,score_calidad)').order('created_at',{ascending:false}).limit(50);
    setPubs(data || []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const conectar = () => {
    window.open(`${SUPABASE_URL}/functions/v1/tiktok-oauth-callback`, '_blank', 'width=600,height=700');
    const interval = setInterval(async () => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-manager`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ANON_KEY}`}, body:JSON.stringify({accion:'status'}) });
      const d = await r.json();
      if (d.conectado) { clearInterval(interval); setConectado(true); setTokenInfo(d.token); flash('TikTok conectado ✓'); cargar(); }
    }, 3000);
    setTimeout(() => clearInterval(interval), 120000);
  };

  const generarBorradores = async () => {
    setProcesando(true); flash('Generando con IA...', 'info');
    const r = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-manager`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ANON_KEY}`}, body:JSON.stringify({accion:'generar',limite:10}) });
    const d = await r.json();
    setProcesando(false);
    if (d.ok) { flash(`${d.generadas} borradores generados ✓`); cargar(); }
    else flash('Error: ' + d.error, 'error');
  };

  const publicar = async (pubId) => {
    if (!conectado) { flash('Conectá TikTok primero', 'error'); return; }
    setProcesando(true); flash('Publicando...', 'info');
    const r = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-manager`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ANON_KEY}`}, body:JSON.stringify({accion:'publicar',pub_id:pubId}) });
    const d = await r.json();
    setProcesando(false);
    if (d.ok) { flash('Publicado ✓'); cargar(); } else flash('Error: ' + d.error, 'error');
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    await supabase.from('tiktok_publicaciones').update({
      titulo: editando.titulo, descripcion: editando.descripcion,
      hashtags: editando.hashtags_texto?.split('\n').map(h => h.replace('#','').trim()).filter(Boolean),
      programado_at: editando.programado_at || null,
      estado: editando.programado_at ? 'programado' : 'borrador',
    }).eq('id', editando.id);
    flash('Guardado ✓'); setEditando(null); cargar();
  };

  const borradores = pubs.filter(p => p.estado === 'borrador').length;
  const publicados = pubs.filter(p => p.estado === 'publicado').length;

  return (
    <Layout>
      <Topbar
        title="TikTok"
        subtitle="@zebrano.ma"
        actions={
          <>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20, background: conectado ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border:`1px solid ${conectado ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background: conectado ? '#4ade80' : '#f87171' }} />
              <span style={{ fontSize:11, color: conectado ? '#4ade80' : '#f87171' }}>{conectado ? `Conectado` : 'No conectado'}</span>
            </div>
            {!conectado && <button className="btn btn-sm" style={{ background:'#ef444422', color:'#ef4444', border:'1px solid #ef444433' }} onClick={conectar}>🎵 Conectar</button>}
            <button className="btn btn-primary btn-sm" disabled={procesando} onClick={generarBorradores}>✨ Generar borradores</button>
          </>
        }
      />
      <PageContent>
        {msg && (
          <div style={{ padding:'10px 16px', borderRadius:8, marginBottom:16, fontSize:13, background: msg.tipo==='error'?'rgba(248,113,113,0.08)':msg.tipo==='info'?'rgba(96,165,250,0.08)':'rgba(74,222,128,0.08)', color: msg.tipo==='error'?'#f87171':msg.tipo==='info'?'#93c5fd':'#86efac', border:`1px solid ${msg.tipo==='error'?'rgba(248,113,113,0.2)':msg.tipo==='info'?'rgba(96,165,250,0.2)':'rgba(74,222,128,0.2)'}` }}>
            {msg.texto}
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
          {[['Total', pubs.length, '#8F2FFE'], ['Borradores', borradores, '#fbbf24'], ['Programados', pubs.filter(p=>p.estado==='programado').length, '#60a5fa'], ['Publicados', publicados, '#4ade80']].map(([l,v,c]) => (
            <div key={l} style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', padding:'16px', textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--z-text-3)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
        ) : pubs.length === 0 ? (
          <div style={{ textAlign:'center', padding:64, border:'1px dashed var(--z-border)', borderRadius:'var(--z-radius-xl)', color:'var(--z-text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎵</div>
            <p>Importá fotos primero y generá borradores.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {pubs.map(pub => (
              <div key={pub.id} style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', overflow:'hidden', display:'flex' }}>
                {/* Thumbnail */}
                <div style={{ width:80, minWidth:80, background:'rgba(143,47,254,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {pub.imagen_url || pub.galeria_trabajos?.thumbnail_url
                    ? <img src={pub.imagen_url||pub.galeria_trabajos?.thumbnail_url} alt="" style={{ width:'100%', height:80, objectFit:'cover' }} />
                    : <span style={{ fontSize:28 }}>🎵</span>}
                </div>

                {/* Contenido */}
                <div style={{ flex:1, padding:'12px 16px' }}>
                  {editando?.id === pub.id ? (
                    <div style={{ display:'grid', gap:8 }}>
                      <input value={editando.titulo||''} onChange={e => setEditando(p => ({...p,titulo:e.target.value}))} placeholder="Título" />
                      <textarea rows={2} style={{ resize:'vertical' }} value={editando.descripcion||''} onChange={e => setEditando(p => ({...p,descripcion:e.target.value}))} placeholder="Descripción" />
                      <textarea rows={3} style={{ resize:'vertical', fontFamily:'monospace', fontSize:11 }} value={editando.hashtags_texto||''} onChange={e => setEditando(p => ({...p,hashtags_texto:e.target.value}))} placeholder="Hashtags (uno por línea)" />
                      <input type="datetime-local" style={{ width:'auto' }} value={editando.programado_at ? new Date(editando.programado_at).toISOString().slice(0,16) : ''} onChange={e => setEditando(p => ({...p,programado_at:e.target.value?new Date(e.target.value).toISOString():null}))} />
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-primary btn-sm" onClick={guardarEdicion}>Guardar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
                        <span className="badge" style={{ background:EC[pub.estado]?.bg, color:EC[pub.estado]?.text }}>{pub.estado}</span>
                        {pub.galeria_trabajos?.tipo_trabajo && <span style={{ fontSize:11, color:'var(--z-text-3)', textTransform:'capitalize' }}>{pub.galeria_trabajos.tipo_trabajo}</span>}
                        {pub.programado_at && <span style={{ fontSize:11, color:'#60a5fa', marginLeft:'auto' }}>📅 {new Date(pub.programado_at).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>}
                      </div>
                      <div style={{ fontSize:13, color:'var(--z-text)', fontWeight:500, marginBottom:4 }}>{pub.titulo||'—'}</div>
                      <div style={{ fontSize:12, color:'var(--z-text-2)', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{pub.descripcion}</div>
                      {pub.hashtags?.length > 0 && <div style={{ fontSize:11, color:'#8F2FFE', marginTop:4 }}>#{pub.hashtags.slice(0,4).join(' #')}</div>}
                    </>
                  )}
                </div>

                {/* Acciones */}
                {editando?.id !== pub.id && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'10px', borderLeft:'1px solid var(--z-border)', justifyContent:'center', minWidth:90 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditando({...pub, hashtags_texto:(pub.hashtags||[]).join('\n')})}>✏️ Editar</button>
                    {(pub.estado === 'borrador' || pub.estado === 'programado') && (
                      <button className="btn btn-sm" style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }} disabled={procesando||!conectado} onClick={() => publicar(pub.id)}>🎵 Publicar</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </Layout>
  );
}
