
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const ESTADO_COLOR = {
  borrador: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
  programado: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa' },
  publicando: { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa' },
  publicado: { bg: 'rgba(74,222,128,0.12)', text: '#4ade80' },
  error: { bg: 'rgba(248,113,113,0.12)', text: '#f87171' },
};

export default function TikTok() {
  const [conectado, setConectado] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState(null);

  const flash = (texto, tipo = 'ok') => {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(null), 4000);
  };

  const cargar = async () => {
    setLoading(true);
    // Verificar estado de conexión
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ accion: 'status' }),
    });
    const statusData = await resp.json();
    setConectado(statusData.conectado);
    setTokenInfo(statusData.token);

    // Cargar publicaciones
    const { data } = await supabase
      .from('tiktok_publicaciones')
      .select('*, galeria_trabajos(thumbnail_url, tipo_trabajo, score_calidad)')
      .order('created_at', { ascending: false })
      .limit(50);
    setPubs(data || []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const conectar = () => {
    window.open(`${SUPABASE_URL}/functions/v1/tiktok-oauth-callback`, '_blank', 'width=600,height=700');
    // Polling para detectar cuando se conectó
    const interval = setInterval(async () => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ accion: 'status' }),
      });
      const d = await r.json();
      if (d.conectado) {
        clearInterval(interval);
        setConectado(true);
        setTokenInfo(d.token);
        flash('TikTok conectado ✓');
        cargar();
      }
    }, 3000);
    setTimeout(() => clearInterval(interval), 120000);
  };

  const generarBorradores = async () => {
    setProcesando(true);
    flash('Generando borradores con IA...', 'info');
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ accion: 'generar', limite: 10 }),
    });
    const data = await resp.json();
    setProcesando(false);
    if (data.ok) { flash(`${data.generadas} borradores generados ✓`); cargar(); }
    else flash('Error: ' + data.error, 'error');
  };

  const publicar = async (pubId) => {
    if (!conectado) { flash('Conectá TikTok primero', 'error'); return; }
    setProcesando(true);
    flash('Publicando en TikTok...', 'info');
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ accion: 'publicar', pub_id: pubId }),
    });
    const data = await resp.json();
    setProcesando(false);
    if (data.ok) { flash('Publicado en TikTok ✓'); cargar(); }
    else flash('Error: ' + data.error, 'error');
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    await supabase.from('tiktok_publicaciones').update({
      titulo: editando.titulo,
      descripcion: editando.descripcion,
      hashtags: editando.hashtags_texto?.split('\n').map(h => h.replace('#','').trim()).filter(Boolean),
      programado_at: editando.programado_at || null,
      estado: editando.programado_at ? 'programado' : 'borrador',
    }).eq('id', editando.id);
    flash('Guardado ✓');
    setEditando(null);
    cargar();
  };

  const borradores = pubs.filter(p => p.estado === 'borrador');
  const programados = pubs.filter(p => p.estado === 'programado');
  const publicados = pubs.filter(p => p.estado === 'publicado');

  const s = {
    page: { padding: '28px 24px', maxWidth: 900, margin: '0 auto', color: '#E8DFD0' },
    h1: { fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 300, fontStyle: 'italic', color: '#E8DFD0', margin: '0 0 4px' },
    sub: { fontSize: 12, color: '#3A5030', marginBottom: 28 },
    card: { background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 12, overflow: 'hidden', marginBottom: 10, display: 'flex' },
    btn: (bg = '#4A6B36', dis = false) => ({ padding: '8px 16px', fontSize: 12, background: dis ? '#111' : bg, color: dis ? '#2E4A22' : '#C8D9B8', border: 'none', borderRadius: 8, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.6 : 1 }),
    input: { width: '100%', background: '#0A0D08', border: '1px solid rgba(74,107,54,0.2)', borderRadius: 8, padding: '8px 12px', color: '#C8D9B8', fontSize: 12, outline: 'none', boxSizing: 'border-box' },
    lbl: { fontSize: 10, color: '#2E4A22', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={s.h1}>TikTok</h1>
          <p style={s.sub}>Gestión de publicaciones para @zebrano.ma</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {conectado !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: conectado ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${conectado ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: conectado ? '#4ade80' : '#f87171' }} />
              <span style={{ fontSize: 12, color: conectado ? '#4ade80' : '#f87171' }}>{conectado ? `Conectado · ${tokenInfo?.open_id?.slice(0, 12)}...` : 'No conectado'}</span>
            </div>
          )}
          {!conectado && <button style={s.btn('#ef4444')} onClick={conectar}>🎵 Conectar TikTok</button>}
          <button style={s.btn('#4A6B36', procesando)} onClick={generarBorradores} disabled={procesando}>
            {procesando ? '⏳' : '✨'} Generar borradores
          </button>
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.tipo === 'error' ? 'rgba(248,113,113,0.08)' : msg.tipo === 'info' ? 'rgba(96,165,250,0.08)' : 'rgba(74,222,128,0.08)', color: msg.tipo === 'error' ? '#f87171' : msg.tipo === 'info' ? '#93c5fd' : '#86efac', border: `1px solid ${msg.tipo === 'error' ? 'rgba(248,113,113,0.2)' : msg.tipo === 'info' ? 'rgba(96,165,250,0.2)' : 'rgba(74,222,128,0.2)'}` }}>
          {msg.texto}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        {[['Total', pubs.length, '#8A9E82'], ['Borradores', borradores.length, '#fbbf24'], ['Programados', programados.length, '#60a5fa'], ['Publicados', publicados.length, '#4ade80']].map(([l, v, c]) => (
          <div key={l} style={{ background: '#080B06', border: '1px solid rgba(74,107,54,0.12)', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 300, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: '#2E4A22', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#3A5030' }}>Cargando...</div>
      ) : pubs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, border: '1px dashed rgba(74,107,54,0.15)', borderRadius: 12, color: '#3A5030' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎵</div>
          <p>No hay publicaciones. Importá fotos primero y después generá borradores.</p>
        </div>
      ) : (
        pubs.map(pub => (
          <div key={pub.id} style={s.card}>
            {/* Thumbnail */}
            <div style={{ width: 90, minWidth: 90, background: '#0A0D08', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pub.imagen_url || pub.galeria_trabajos?.thumbnail_url
                ? <img src={pub.imagen_url || pub.galeria_trabajos?.thumbnail_url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover' }} />
                : <span style={{ fontSize: 28 }}>🎵</span>}
            </div>

            {/* Contenido */}
            <div style={{ flex: 1, padding: '12px 16px' }}>
              {editando?.id === pub.id ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div><label style={s.lbl}>Título</label><input style={s.input} value={editando.titulo || ''} onChange={e => setEditando(p => ({ ...p, titulo: e.target.value }))} /></div>
                  <div><label style={s.lbl}>Descripción</label><textarea rows={2} style={{ ...s.input, resize: 'vertical' }} value={editando.descripcion || ''} onChange={e => setEditando(p => ({ ...p, descripcion: e.target.value }))} /></div>
                  <div><label style={s.lbl}>Hashtags (uno por línea)</label><textarea rows={3} style={{ ...s.input, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }} value={editando.hashtags_texto || ''} onChange={e => setEditando(p => ({ ...p, hashtags_texto: e.target.value }))} /></div>
                  <div><label style={s.lbl}>Programar publicación</label><input type="datetime-local" style={{ ...s.input, width: 'auto' }} value={editando.programado_at ? new Date(editando.programado_at).toISOString().slice(0, 16) : ''} onChange={e => setEditando(p => ({ ...p, programado_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={s.btn()} onClick={guardarEdicion}>Guardar</button>
                    <button style={{ ...s.btn('transparent'), color: '#3A5030', border: '1px solid rgba(74,107,54,0.2)' }} onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, background: ESTADO_COLOR[pub.estado]?.bg, color: ESTADO_COLOR[pub.estado]?.text, textTransform: 'capitalize' }}>{pub.estado}</span>
                    {pub.galeria_trabajos?.tipo_trabajo && <span style={{ fontSize: 10, color: '#3A5030', textTransform: 'capitalize' }}>{pub.galeria_trabajos.tipo_trabajo}</span>}
                    {pub.programado_at && <span style={{ fontSize: 10, color: '#60a5fa', marginLeft: 'auto' }}>📅 {new Date(pub.programado_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#C8D9B8', marginBottom: 4, fontWeight: 400 }}>{pub.titulo || '—'}</div>
                  <div style={{ fontSize: 12, color: '#8A9E82', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{pub.descripcion}</div>
                  {pub.hashtags?.length > 0 && (
                    <div style={{ fontSize: 11, color: '#4A6B36', marginTop: 4 }}>
                      #{pub.hashtags.slice(0, 4).join(' #')}{pub.hashtags.length > 4 && ` +${pub.hashtags.length - 4}`}
                    </div>
                  )}
                  {pub.estado === 'error' && pub.error_detalle && <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>⚠ {pub.error_detalle}</div>}
                </>
              )}
            </div>

            {/* Acciones */}
            {editando?.id !== pub.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 10px', borderLeft: '1px solid rgba(74,107,54,0.08)', justifyContent: 'center', minWidth: 100 }}>
                <button style={s.btn('transparent')} onClick={() => setEditando({ ...pub, hashtags_texto: (pub.hashtags || []).join('\n') })}>✏️ Editar</button>
                {(pub.estado === 'borrador' || pub.estado === 'programado') && (
                  <button style={s.btn('#ef4444', procesando || !conectado)} onClick={() => publicar(pub.id)} disabled={procesando || !conectado}>
                    🎵 Publicar
                  </button>
                )}
                {pub.tiktok_video_id && (
                  <a href={`https://www.tiktok.com/@zebrano.ma/video/${pub.tiktok_video_id}`} target="_blank" rel="noreferrer"
                    style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, textDecoration: 'none', textAlign: 'center' }}>
                    Ver →
                  </a>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
