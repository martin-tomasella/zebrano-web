import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ESTADOS_COLOR = {
  borrador: 'bg-yellow-100 text-yellow-800',
  aprobado: 'bg-blue-100 text-blue-800',
  publicado: 'bg-green-100 text-green-800',
  descartado: 'bg-gray-100 text-gray-500',
};

export default function RRSS() {
  const [tab, setTab] = useState('borradores');
  const [publicaciones, setPublicaciones] = useState([]);
  const [galeria, setGaleria] = useState([]);
  const [stats, setStats] = useState({ total: 0, aptas: 0, borradores: 0, aprobadas: 0, publicadas: 0 });
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [msg, setMsg] = useState(null);

  const mostrarMsg = (texto, tipo = 'ok') => {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(null), 3500);
  };

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const [pubRes, galRes] = await Promise.all([
      supabase.from('roble_publicaciones')
        .select('*, galeria_trabajos(thumbnail_url, tipo_trabajo, score_calidad, titulo)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('galeria_trabajos')
        .select('id, thumbnail_url, tipo_trabajo, score_calidad, apto_rrss, procesado_ai, titulo, motivo_descarte')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    const pubs = pubRes.data || [];
    const gals = galRes.data || [];
    setPublicaciones(pubs);
    setGaleria(gals);
    setStats({
      total: gals.length,
      aptas: gals.filter(g => g.apto_rrss === true).length,
      noAptas: gals.filter(g => g.apto_rrss === false).length,
      sinProcesar: gals.filter(g => g.procesado_ai === false || g.procesado_ai === null).length,
      borradores: pubs.filter(p => p.estado === 'borrador').length,
      aprobadas: pubs.filter(p => p.estado === 'aprobado').length,
      publicadas: pubs.filter(p => p.estado === 'publicado').length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const cambiarEstado = async (id, nuevoEstado) => {
    const update = { estado: nuevoEstado };
    if (nuevoEstado === 'aprobado' && !publicaciones.find(p => p.id === id)?.programado_at) {
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(10, 0, 0, 0);
      update.programado_at = manana.toISOString();
    }
    const { error } = await supabase.from('roble_publicaciones').update(update).eq('id', id);
    if (error) { mostrarMsg('Error: ' + error.message, 'error'); return; }
    mostrarMsg(`Publicacion ${nuevoEstado === 'aprobado' ? 'aprobada' : nuevoEstado === 'descartado' ? 'descartada' : 'actualizada'}`);
    cargarDatos();
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    const { error } = await supabase.from('roble_publicaciones').update({
      caption_instagram: editando.caption_instagram,
      caption_facebook: editando.caption_facebook,
      caption_historia: editando.caption_historia,
      contenido: editando.caption_instagram,
      programado_at: editando.programado_at,
    }).eq('id', editando.id);
    if (error) { mostrarMsg('Error guardando: ' + error.message, 'error'); return; }
    mostrarMsg('Guardado');
    setEditando(null);
    cargarDatos();
  };

  const clasificarFotos = async () => {
    setProcesando(true);
    mostrarMsg('Procesando fotos... (puede tardar 1-2 min)', 'info');
    try {
      const resp = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/fotos-classifier`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ limite: 10 }) }
      );
      const data = await resp.json();
      if (data.ok) { mostrarMsg(`Procesadas: ${data.procesadas} | Aptas: ${data.aptas_rrss} | Descartadas: ${data.descartadas}`); cargarDatos(); }
      else { mostrarMsg('Error: ' + (data.error || 'desconocido'), 'error'); }
    } catch (e) { mostrarMsg('Error: ' + e.message, 'error'); }
    setProcesando(false);
  };

  const generarContenido = async () => {
    setProcesando(true);
    mostrarMsg('Generando captions con IA...', 'info');
    try {
      const resp = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/rrss-content-generator`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ limite: 5 }) }
      );
      const data = await resp.json();
      if (data.ok) { mostrarMsg(`Generados ${data.generadas} borradores nuevos`); cargarDatos(); }
      else { mostrarMsg('Error: ' + (data.error || 'desconocido'), 'error'); }
    } catch (e) { mostrarMsg('Error: ' + e.message, 'error'); }
    setProcesando(false);
  };

  const filtradas = publicaciones.filter(p => {
    if (tab === 'borradores') return p.estado === 'borrador';
    if (tab === 'aprobadas') return p.estado === 'aprobado';
    if (tab === 'publicadas') return p.estado === 'publicado';
    return true;
  });

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto', color: '#E8DFD0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, fontWeight: 300, fontStyle: 'italic', color: '#E8DFD0', margin: 0 }}>Publicaciones RRSS</h1>
          <p style={{ color: '#3A5030', fontSize: 12, marginTop: 4 }}>Gestion de contenido para Instagram y Facebook</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/google-oauth-callback`} target="_blank" rel="noreferrer"
            style={{ padding: '8px 14px', fontSize: 12, border: '1px solid rgba(74,107,54,0.3)', borderRadius: 8, color: '#8A9E82', textDecoration: 'none', background: 'transparent' }}>
            Conectar Google Fotos
          </a>
          <button onClick={clasificarFotos} disabled={procesando}
            style={{ padding: '8px 14px', fontSize: 12, background: '#4A6B36', color: '#C8D9B8', border: 'none', borderRadius: 8, cursor: procesando ? 'not-allowed' : 'pointer', opacity: procesando ? 0.6 : 1 }}>
            {procesando ? 'Procesando...' : 'Clasificar fotos'}
          </button>
          <button onClick={generarContenido} disabled={procesando}
            style={{ padding: '8px 14px', fontSize: 12, background: '#2E4A22', color: '#C8D9B8', border: '1px solid rgba(74,107,54,0.3)', borderRadius: 8, cursor: procesando ? 'not-allowed' : 'pointer', opacity: procesando ? 0.6 : 1 }}>
            {procesando ? 'Generando...' : 'Generar contenido'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: msg.tipo === 'error' ? 'rgba(220,38,38,0.1)' : msg.tipo === 'info' ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
          color: msg.tipo === 'error' ? '#f87171' : msg.tipo === 'info' ? '#93c5fd' : '#86efac',
          border: `1px solid ${msg.tipo === 'error' ? 'rgba(220,38,38,0.2)' : msg.tipo === 'info' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)'}`
        }}>{msg.texto}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total fotos', value: stats.total },
          { label: 'Aptas RRSS', value: stats.aptas },
          { label: 'No aptas', value: stats.noAptas },
          { label: 'Sin procesar', value: stats.sinProcesar },
          { label: 'Borradores', value: stats.borradores },
          { label: 'Publicadas', value: stats.publicadas },
        ].map(s => (
          <div key={s.label} style={{ background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 300, color: '#7AAE5A' }}>{s.value ?? 0}</div>
            <div style={{ fontSize: 10, color: '#3A5030', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['borradores', 'aprobadas', 'publicadas', 'todas'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', fontSize: 12, borderRadius: 8, border: 'none', cursor: 'pointer', textTransform: 'capitalize',
            background: tab === t ? 'rgba(74,107,54,0.2)' : 'transparent',
            color: tab === t ? '#C8D9B8' : '#3A5030',
          }}>
            {t}{t === 'borradores' && stats.borradores > 0 ? ` (${stats.borradores})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#3A5030' }}>Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, border: '1px dashed rgba(74,107,54,0.2)', borderRadius: 12, color: '#3A5030' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>&#128237;</div>
          <p>No hay publicaciones en esta categoria</p>
          {tab === 'borradores' && <p style={{ fontSize: 12, marginTop: 8 }}>Conecta Google Fotos &rarr; Clasificar fotos &rarr; Generar contenido</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtradas.map(pub => (
            <div key={pub.id} style={{ background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 12, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: 110, minWidth: 110, height: 110, background: '#0A0D08', flexShrink: 0 }}>
                {pub.galeria_trabajos?.thumbnail_url || pub.imagen_url
                  ? <img src={pub.galeria_trabajos?.thumbnail_url || pub.imagen_url} alt="trabajo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#2E4A22' }}>&#129749;</div>}
              </div>
              <div style={{ flex: 1, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: pub.estado === 'borrador' ? 'rgba(234,179,8,0.15)' : pub.estado === 'aprobado' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)', color: pub.estado === 'borrador' ? '#fbbf24' : pub.estado === 'aprobado' ? '#93c5fd' : '#86efac' }}>{pub.estado}</span>
                  {pub.galeria_trabajos?.tipo_trabajo && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(74,107,54,0.1)', color: '#8A9E82', textTransform: 'capitalize' }}>{pub.galeria_trabajos.tipo_trabajo}</span>}
                  {pub.programado_at && <span style={{ fontSize: 10, color: '#3A5030', marginLeft: 'auto' }}>{new Date(pub.programado_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                {editando?.id === pub.id ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {[['Instagram', 'caption_instagram'], ['Facebook', 'caption_facebook'], ['Historia', 'caption_historia']].map(([lbl, field]) => (
                      <div key={field}>
                        <div style={{ fontSize: 10, color: '#3A5030', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</div>
                        <textarea rows={field === 'caption_historia' ? 1 : 2} style={{ width: '100%', background: '#0A0D08', border: '1px solid rgba(74,107,54,0.3)', borderRadius: 6, padding: '6px 10px', color: '#C8D9B8', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
                          value={editando[field] || ''} onChange={e => setEditando(p => ({ ...p, [field]: e.target.value }))} />
                      </div>
                    ))}
                    <div>
                      <div style={{ fontSize: 10, color: '#3A5030', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha programada</div>
                      <input type="datetime-local" style={{ background: '#0A0D08', border: '1px solid rgba(74,107,54,0.3)', borderRadius: 6, padding: '6px 10px', color: '#C8D9B8', fontSize: 12 }}
                        value={editando.programado_at ? new Date(editando.programado_at).toISOString().slice(0,16) : ''}
                        onChange={e => setEditando(p => ({ ...p, programado_at: new Date(e.target.value).toISOString() }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={guardarEdicion} style={{ padding: '6px 14px', fontSize: 12, background: '#4A6B36', color: '#C8D9B8', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
                      <button onClick={() => setEditando(null)} style={{ padding: '6px 14px', fontSize: 12, background: 'transparent', color: '#3A5030', border: '1px solid rgba(74,107,54,0.2)', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: '#8A9E82', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {pub.caption_instagram || pub.contenido}
                  </p>
                )}
              </div>
              {editando?.id !== pub.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderLeft: '1px solid rgba(74,107,54,0.1)', justifyContent: 'center', minWidth: 90 }}>
                  <button onClick={() => setEditando(pub)} style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', color: '#8A9E82', border: '1px solid rgba(74,107,54,0.2)', borderRadius: 6, cursor: 'pointer' }}>Editar</button>
                  {pub.estado === 'borrador' && <button onClick={() => cambiarEstado(pub.id, 'aprobado')} style={{ padding: '5px 10px', fontSize: 11, background: '#4A6B36', color: '#C8D9B8', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Aprobar</button>}
                  {pub.estado === 'aprobado' && <button onClick={() => cambiarEstado(pub.id, 'borrador')} style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, cursor: 'pointer' }}>Borrador</button>}
                  {pub.estado !== 'descartado' && pub.estado !== 'publicado' && <button onClick={() => cambiarEstado(pub.id, 'descartado')} style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', color: '#3A5030', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 6, cursor: 'pointer' }}>Descartar</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
