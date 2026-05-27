
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

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
      // Por defecto programar para mañana 10am
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(10, 0, 0, 0);
      update.programado_at = manana.toISOString();
    }
    const { error } = await supabase.from('roble_publicaciones').update(update).eq('id', id);
    if (error) { mostrarMsg('Error: ' + error.message, 'error'); return; }
    mostrarMsg(`Publicación ${nuevoEstado === 'aprobado' ? 'aprobada ✓' : nuevoEstado === 'descartado' ? 'descartada' : 'actualizada'}`);
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
    mostrarMsg('Guardado ✓');
    setEditando(null);
    cargarDatos();
  };

  const clasificarFotos = async () => {
    setProcesando(true);
    mostrarMsg('Procesando fotos... (puede tardar 1-2 min)', 'info');
    try {
      const resp = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/fotos-classifier`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ limite: 10 }),
        }
      );
      const data = await resp.json();
      if (data.ok) {
        mostrarMsg(`Procesadas: ${data.procesadas} | Aptas: ${data.aptas_rrss} | Descartadas: ${data.descartadas}`);
        cargarDatos();
      } else {
        mostrarMsg('Error: ' + (data.error || 'desconocido'), 'error');
      }
    } catch (e) {
      mostrarMsg('Error de red: ' + e.message, 'error');
    }
    setProcesando(false);
  };

  const generarContenido = async () => {
    setProcesando(true);
    mostrarMsg('Generando captions con IA...', 'info');
    try {
      const resp = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/rrss-content-generator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ limite: 5 }),
        }
      );
      const data = await resp.json();
      if (data.ok) {
        mostrarMsg(`Generados ${data.generadas} borradores nuevos ✓`);
        cargarDatos();
      } else {
        mostrarMsg('Error: ' + (data.error || 'desconocido'), 'error');
      }
    } catch (e) {
      mostrarMsg('Error: ' + e.message, 'error');
    }
    setProcesando(false);
  };

  const filtradas = publicaciones.filter(p => {
    if (tab === 'borradores') return p.estado === 'borrador';
    if (tab === 'aprobadas') return p.estado === 'aprobado';
    if (tab === 'publicadas') return p.estado === 'publicado';
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publicaciones RRSS</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de contenido para Instagram y Facebook</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/google-oauth-callback`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            📷 Conectar Google Fotos
          </a>
          <button
            onClick={clasificarFotos}
            disabled={procesando}
            className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
          >
            {procesando ? '⏳' : '🤖'} Clasificar fotos nuevas
          </button>
          <button
            onClick={generarContenido}
            disabled={procesando}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
          >
            {procesando ? '⏳' : '✨'} Generar contenido
          </button>
        </div>
      </div>

      {/* Mensaje flash */}
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          msg.tipo === 'error' ? 'bg-red-50 text-red-700' :
          msg.tipo === 'info' ? 'bg-blue-50 text-blue-700' :
          'bg-green-50 text-green-700'
        }`}>
          {msg.texto}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total fotos', value: stats.total, color: 'gray' },
          { label: 'Aptas RRSS', value: stats.aptas, color: 'green' },
          { label: 'No aptas', value: stats.noAptas, color: 'red' },
          { label: 'Sin procesar', value: stats.sinProcesar, color: 'yellow' },
          { label: 'Borradores', value: stats.borradores, color: 'yellow' },
          { label: 'Publicadas', value: stats.publicadas, color: 'green' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
            <div className={`text-2xl font-bold text-${s.color}-600`}>{s.value ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {['borradores', 'aprobadas', 'publicadas', 'todas'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-lg capitalize transition-all ${
              tab === t ? 'bg-white shadow font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t} {t === 'borradores' && stats.borradores > 0 && (
              <span className="ml-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full">{stats.borradores}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de publicaciones */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500">No hay publicaciones en esta categoría</p>
          {tab === 'borradores' && (
            <p className="text-sm text-gray-400 mt-1">
              Conectá Google Fotos → Clasificar fotos → Generar contenido
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtradas.map(pub => (
            <div key={pub.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex">
                {/* Imagen */}
                <div className="w-32 h-32 flex-shrink-0 bg-gray-100">
                  {pub.galeria_trabajos?.thumbnail_url || pub.imagen_url ? (
                    <img
                      src={pub.galeria_trabajos?.thumbnail_url || pub.imagen_url}
                      alt={pub.galeria_trabajos?.tipo_trabajo || 'trabajo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🪵</div>
                  )}
                </div>

                {/* Contenido */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADOS_COLOR[pub.estado]}`}>
                        {pub.estado}
                      </span>
                      {pub.canal_instagram && <span className="text-xs bg-pink-50 text-pink-600 px-2 py-1 rounded-full">📸 Instagram</span>}
                      {pub.canal_facebook && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">👍 Facebook</span>}
                      {pub.galeria_trabajos?.tipo_trabajo && (
                        <span className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-full capitalize">
                          {pub.galeria_trabajos.tipo_trabajo}
                        </span>
                      )}
                      {pub.galeria_trabajos?.score_calidad && (
                        <span className="text-xs text-amber-600">{'⭐'.repeat(pub.galeria_trabajos.score_calidad)}</span>
                      )}
                    </div>
                    {pub.programado_at && (
                      <span className="text-xs text-gray-400">
                        🕐 {new Date(pub.programado_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {editando?.id === pub.id ? (
                    // Modo edición
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">📸 Instagram</label>
                        <textarea
                          rows={3}
                          className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={editando.caption_instagram || ''}
                          onChange={e => setEditando(prev => ({ ...prev, caption_instagram: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">👍 Facebook</label>
                        <textarea
                          rows={3}
                          className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={editando.caption_facebook || ''}
                          onChange={e => setEditando(prev => ({ ...prev, caption_facebook: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">⚡ Historia (corto)</label>
                        <input
                          type="text"
                          className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={editando.caption_historia || ''}
                          onChange={e => setEditando(prev => ({ ...prev, caption_historia: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">📅 Fecha programada</label>
                        <input
                          type="datetime-local"
                          className="text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={editando.programado_at ? new Date(editando.programado_at).toISOString().slice(0,16) : ''}
                          onChange={e => setEditando(prev => ({ ...prev, programado_at: new Date(e.target.value).toISOString() }))}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={guardarEdicion} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                          Guardar
                        </button>
                        <button onClick={() => setEditando(null)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Modo vista
                    <div className="mt-2">
                      <p className="text-sm text-gray-700 line-clamp-2">{pub.caption_instagram || pub.contenido}</p>
                      {pub.hashtags?.length > 0 && (
                        <p className="text-xs text-blue-500 mt-1 line-clamp-1">
                          #{pub.hashtags.slice(0,5).join(' #')}
                          {pub.hashtags.length > 5 && ` +${pub.hashtags.length - 5}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                {editando?.id !== pub.id && (
                  <div className="flex flex-col gap-1.5 p-3 border-l border-gray-50 justify-center min-w-[100px]">
                    <button
                      onClick={() => setEditando(pub)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
                    >
                      ✏️ Editar
                    </button>
                    {pub.estado === 'borrador' && (
                      <button
                        onClick={() => cambiarEstado(pub.id, 'aprobado')}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 text-center"
                      >
                        ✓ Aprobar
                      </button>
                    )}
                    {pub.estado === 'aprobado' && (
                      <button
                        onClick={() => cambiarEstado(pub.id, 'borrador')}
                        className="px-3 py-1.5 text-xs border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 text-center"
                      >
                        ↩ Borrador
                      </button>
                    )}
                    {pub.estado !== 'descartado' && pub.estado !== 'publicado' && (
                      <button
                        onClick={() => cambiarEstado(pub.id, 'descartado')}
                        className="px-3 py-1.5 text-xs border border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50 text-center"
                      >
                        🗑 Descartar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
