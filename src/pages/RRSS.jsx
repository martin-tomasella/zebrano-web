
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent } from '../components/Layout';
import { useNavigate } from 'react-router-dom';

const ESTADOS = ['borrador','aprobado','programado','publicado','descartado'];
const EC = { borrador:'#fbbf24', aprobado:'#60a5fa', programado:'#a78bfa', publicado:'#4ade80', descartado:'#f87171' };

export default function RRSS() {
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [editando, setEditando] = useState(null);
  const navigate = useNavigate();

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase.from('roble_publicaciones').select('*, galeria_trabajos(thumbnail_url, tipo_trabajo, score_calidad)').order('created_at',{ascending:false}).limit(60);
    setPubs(data || []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const cambiarEstado = async (id, estado) => {
    await supabase.from('roble_publicaciones').update({ estado }).eq('id', id);
    setPubs(prev => prev.map(p => p.id === id ? {...p, estado} : p));
  };

  const guardar = async () => {
    if (!editando) return;
    await supabase.from('roble_publicaciones').update({ caption_instagram: editando.caption_instagram, caption_facebook: editando.caption_facebook, hashtags: editando.hashtags?.split('\n').map(h=>h.replace('#','').trim()).filter(Boolean), programado_para: editando.programado_para || null }).eq('id', editando.id);
    setEditando(null); cargar();
  };

  const filtradas = filtro === 'todos' ? pubs : pubs.filter(p => p.estado === filtro);

  return (
    <Layout>
      <Topbar
        title="Instagram / Facebook"
        subtitle={`${pubs.length} publicaciones`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/rrss/importar')}>+ Importar fotos</button>
        }
      />

      {/* Filtros */}
      <div style={{ padding:'10px 24px', borderBottom:'1px solid var(--z-border)', display:'flex', gap:6, background:'var(--z-sidebar-bg)', flexShrink:0 }}>
        {['todos',...ESTADOS].map(e => (
          <button key={e} onClick={() => setFiltro(e)} style={{ padding:'4px 12px', fontSize:11, borderRadius:20, cursor:'pointer', textTransform:'capitalize', background: filtro===e?'rgba(74,107,54,0.2)':'transparent', color: filtro===e?'var(--z-text)':'var(--z-text-3)', border:`1px solid ${filtro===e?'rgba(74,107,54,0.4)':'var(--z-border)'}` }}>
            {e} {e!=='todos'&&`(${pubs.filter(p=>p.estado===e).length})`}
          </button>
        ))}
      </div>

      <PageContent>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign:'center', padding:64, border:'1px dashed var(--z-border)', borderRadius:'var(--z-radius-xl)', color:'var(--z-text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📸</div>
            <p style={{ marginBottom:16 }}>No hay publicaciones. Importá fotos para empezar.</p>
            <button className="btn btn-primary" onClick={() => navigate('/rrss/importar')}>Importar fotos</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
            {filtradas.map(pub => (
              <div key={pub.id} style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
                {/* Imagen */}
                {(pub.galeria_trabajos?.thumbnail_url) && (
                  <div style={{ height:180, overflow:'hidden' }}>
                    <img src={pub.galeria_trabajos.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                )}

                <div style={{ padding:'14px 16px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Estado badge + tipo */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span className="badge" style={{ background:EC[pub.estado]+'18', color:EC[pub.estado], border:`1px solid ${EC[pub.estado]}33`, textTransform:'capitalize' }}>{pub.estado}</span>
                    {pub.galeria_trabajos?.tipo_trabajo && <span style={{ fontSize:11, color:'var(--z-text-3)', textTransform:'capitalize' }}>{pub.galeria_trabajos.tipo_trabajo}</span>}
                  </div>

                  {editando?.id === pub.id ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <textarea rows={3} style={{ resize:'vertical', fontSize:12 }} value={editando.caption_instagram||''} onChange={e => setEditando(p=>({...p,caption_instagram:e.target.value}))} placeholder="Caption Instagram" />
                      <textarea rows={2} style={{ resize:'vertical', fontSize:12 }} value={editando.hashtags||''} onChange={e => setEditando(p=>({...p,hashtags:e.target.value}))} placeholder="Hashtags (uno por línea)" />
                      <input type="datetime-local" style={{ fontSize:12 }} value={editando.programado_para?new Date(editando.programado_para).toISOString().slice(0,16):''} onChange={e => setEditando(p=>({...p,programado_para:e.target.value?new Date(e.target.value).toISOString():null}))} />
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-primary btn-sm" onClick={guardar}>Guardar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize:12, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                        {pub.caption_instagram || pub.caption_facebook || 'Sin caption'}
                      </p>
                      {pub.programado_para && <div style={{ fontSize:11, color:'#a78bfa' }}>📅 {new Date(pub.programado_para).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>}
                    </>
                  )}

                  {/* Acciones */}
                  {editando?.id !== pub.id && (
                    <div style={{ display:'flex', gap:6, marginTop:'auto', paddingTop:8, borderTop:'1px solid var(--z-border)', flexWrap:'wrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditando({...pub, hashtags:(pub.hashtags||[]).join('\n')})}>✏️ Editar</button>
                      {pub.estado === 'borrador' && <button className="btn btn-sm" style={{ background:'rgba(96,165,250,0.1)',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.2)' }} onClick={() => cambiarEstado(pub.id,'aprobado')}>✓ Aprobar</button>}
                      {pub.estado === 'aprobado' && <button className="btn btn-sm" style={{ background:'rgba(74,107,54,0.1)',color:'#4A6B36',border:'1px solid rgba(74,107,54,0.2)' }} onClick={() => cambiarEstado(pub.id,'programado')}>📅 Programar</button>}
                      {pub.estado !== 'publicado' && pub.estado !== 'descartado' && <button className="btn btn-sm" style={{ background:'rgba(248,113,113,0.1)',color:'#f87171',border:'1px solid rgba(248,113,113,0.2)' }} onClick={() => cambiarEstado(pub.id,'descartado')}>✕</button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </Layout>
  );
}
