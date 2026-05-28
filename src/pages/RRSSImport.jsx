
import { useState, useRef, useCallback } from 'react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function RRSSImport() {
  const [archivos, setArchivos] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const agregarArchivos = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    setArchivos(prev => {
      const existentes = new Set(prev.map(f => f.name + f.size));
      const nuevos = imgs.filter(f => !existentes.has(f.name + f.size));
      return [...prev, ...nuevos];
    });
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    agregarArchivos(e.dataTransfer.files);
  };

  const clasificar = async () => {
    if (!archivos.length) return;
    setProcesando(true);
    setResultados([]);
    const res = [];

    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i];
      try {
        // Convertir a base64
        const base64 = await new Promise((ok, err) => {
          const reader = new FileReader();
          reader.onload = e => ok(e.target.result.split(',')[1]);
          reader.onerror = err;
          reader.readAsDataURL(file);
        });

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/fotos-classifier-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({
            base64,
            media_type: file.type,
            filename: file.name,
          }),
        });
        const data = await resp.json();
        res.push({ nombre: file.name, ...data });
      } catch (e) {
        res.push({ nombre: file.name, ok: false, error: e.message });
      }
      setResultados([...res]);
    }

    setProcesando(false);
  };

  const generarCaptions = async () => {
    setProcesando(true);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/rrss-content-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ limite: 20 }),
    });
    const data = await resp.json();
    setProcesando(false);
    if (data.ok) {
      window.location.href = '/rrss';
    }
  };

  const aptas = resultados.filter(r => r.apto_rrss === true).length;
  const descartadas = resultados.filter(r => r.apto_rrss === false).length;
  const errores = resultados.filter(r => r.ok === false).length;
  const terminado = resultados.length === archivos.length && archivos.length > 0 && !procesando;

  const s = {
    page: { padding: '32px 24px', maxWidth: 700, margin: '0 auto', color: '#E8DFD0' },
    titulo: { fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 300, fontStyle: 'italic', color: '#E8DFD0', marginBottom: 4 },
    sub: { fontSize: 12, color: '#3A5030', marginBottom: 32 },
    zona: {
      border: `2px dashed ${drag ? '#4A6B36' : 'rgba(74,107,54,0.25)'}`,
      borderRadius: 16, padding: '48px 32px', textAlign: 'center',
      background: drag ? 'rgba(74,107,54,0.06)' : 'transparent',
      cursor: 'pointer', transition: 'all 0.2s', marginBottom: 20,
    },
    btn: (bg, dis) => ({
      padding: '10px 22px', fontSize: 13, background: dis ? '#111' : bg,
      color: dis ? '#2E4A22' : '#C8D9B8', border: 'none', borderRadius: 8,
      cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.5 : 1,
    }),
  };

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Subir fotos</h1>
      <p style={s.sub}>Seleccioná fotos desde tu computadora o arrástralas acá</p>

      {/* Zona de drop */}
      <div
        style={s.zona}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current.click()}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
        <div style={{ fontSize: 14, color: '#C8D9B8', marginBottom: 6 }}>
          Arrastrá las fotos acá o hacé click para seleccionar
        </div>
        <div style={{ fontSize: 11, color: '#3A5030' }}>
          JPG, PNG, WEBP — podés seleccionar varias a la vez
        </div>
        <input ref={inputRef} type="file" multiple accept="image/*"
          style={{ display: 'none' }}
          onChange={e => agregarArchivos(e.target.files)} />
      </div>

      {/* Lista de archivos */}
      {archivos.length > 0 && (
        <div style={{ background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: '#C8D9B8' }}>{archivos.length} foto{archivos.length !== 1 ? 's' : ''} seleccionada{archivos.length !== 1 ? 's' : ''}</span>
            <button onClick={() => { setArchivos([]); setResultados([]); }}
              style={{ background: 'none', border: 'none', color: '#3A5030', cursor: 'pointer', fontSize: 11 }}>
              Limpiar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
            {archivos.map((f, i) => {
              const r = resultados[i];
              return (
                <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', background: '#0A0D08' }}>
                  <img src={URL.createObjectURL(f)} alt={f.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {r && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: r.ok === false ? 'rgba(239,68,68,0.7)' : r.apto_rrss ? 'rgba(34,197,94,0.6)' : 'rgba(0,0,0,0.6)',
                      fontSize: 20,
                    }}>
                      {r.ok === false ? '✗' : r.apto_rrss ? '✓' : '—'}
                    </div>
                  )}
                  {procesando && !r && i === resultados.length && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      ⏳
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progreso */}
      {resultados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {[['✓ Aptas', aptas, '#7AAE5A'], ['— Descartadas', descartadas, '#fbbf24'], ['✗ Errores', errores, '#f87171']].map(([l, v, c]) => (
            <div key={l} style={{ background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 300, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: '#3A5030', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={s.btn('#4A6B36', !archivos.length || procesando)}
          onClick={clasificar} disabled={!archivos.length || procesando}>
          {procesando && !terminado ? `⏳ Analizando ${resultados.length}/${archivos.length}...` : '🤖 Analizar con IA'}
        </button>

        {terminado && aptas > 0 && (
          <button style={s.btn('#2E4A22', procesando)} onClick={generarCaptions} disabled={procesando}>
            {procesando ? '⏳ Generando...' : `✨ Generar captions (${aptas} fotos aptas)`}
          </button>
        )}
      </div>

      {/* Resultados individuales */}
      {resultados.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {resultados.filter(r => r.ok !== false && r.tipo_trabajo).map((r, i) => (
            <div key={i} style={{ background: '#080B06', border: '1px solid rgba(74,107,54,0.1)', borderRadius: 8, padding: '8px 14px', marginBottom: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8A9E82', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {r.tipo_trabajo && <span style={{ color: '#3A5030', textTransform: 'capitalize' }}>{r.tipo_trabajo}</span>}
                <span style={{ color: r.apto_rrss ? '#7AAE5A' : '#3A5030' }}>{'⭐'.repeat(r.score_calidad || 0)}</span>
                <span style={{ color: r.apto_rrss ? '#7AAE5A' : '#fbbf24', fontWeight: 500 }}>
                  {r.apto_rrss ? 'APTA' : r.motivo_descarte || 'no apta'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
