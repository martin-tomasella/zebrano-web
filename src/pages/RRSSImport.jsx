
import { useState, useRef, useCallback } from 'react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function RRSSImport() {
  const [archivos, setArchivos] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [drag, setDrag] = useState(false);
  const [listo, setListo] = useState(false);
  const inputRef = useRef();

  const agregarArchivos = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    setArchivos(prev => {
      const existe = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...imgs.filter(f => !existe.has(f.name + f.size))];
    });
    setResultados([]);
    setListo(false);
  }, []);

  const onDrop = (e) => { e.preventDefault(); setDrag(false); agregarArchivos(e.dataTransfer.files); };

  const analizar = async () => {
    if (!archivos.length || procesando) return;
    setProcesando(true);
    const res = [];
    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i];
      try {
        const base64 = await new Promise((ok, err) => {
          const r = new FileReader();
          r.onload = e => ok(e.target.result.split(',')[1]);
          r.onerror = err;
          r.readAsDataURL(file);
        });
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/fotos-classifier-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ base64, media_type: file.type, filename: file.name }),
        });
        const data = await resp.json();
        res.push({ nombre: file.name, file, ...data });
      } catch (e) {
        res.push({ nombre: file.name, file, ok: false, error: e.message });
      }
      setResultados([...res]);
    }
    setProcesando(false);
  };

  const generar = async () => {
    setGenerando(true);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/rrss-content-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ limite: 20 }),
    });
    const data = await resp.json();
    setGenerando(false);
    if (data.ok) setListo(true);
  };

  const aptas = resultados.filter(r => r.apto_rrss === true).length;
  const descartadas = resultados.filter(r => r.apto_rrss === false).length;
  const errores = resultados.filter(r => r.ok === false).length;
  const terminado = resultados.length === archivos.length && archivos.length > 0 && !procesando;
  const pct = archivos.length > 0 ? Math.round((resultados.length / archivos.length) * 100) : 0;

  const st = {
    page: { padding: '32px 24px', maxWidth: 760, margin: '0 auto', color: '#E8DFD0' },
    h1: { fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 300, fontStyle: 'italic', color: '#E8DFD0', margin: '0 0 6px' },
    sub: { fontSize: 12, color: '#3A5030', marginBottom: 28 },
    zona: { border: `2px dashed ${drag ? '#4A6B36' : 'rgba(74,107,54,0.2)'}`, borderRadius: 16, padding: '40px 32px', textAlign: 'center', background: drag ? 'rgba(74,107,54,0.05)' : 'rgba(74,107,54,0.02)', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 20 },
    btn: (bg, dis) => ({ padding: '10px 22px', fontSize: 13, background: dis ? '#0d1209' : bg, color: dis ? '#2E4A22' : '#C8D9B8', border: 'none', borderRadius: 8, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.6 : 1 }),
    card: { background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 14 },
  };

  return (
    <div style={st.page}>
      <h1 style={st.h1}>Importar fotos</h1>
      <p style={st.sub}>Seleccioná fotos desde tu computadora o Google Fotos. La IA las clasifica y genera captions automáticamente.</p>

      {/* Zona drag & drop */}
      <div style={st.zona}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📸</div>
        <div style={{ fontSize: 14, color: '#C8D9B8', marginBottom: 6 }}>Arrastrá las fotos acá o tocá para seleccionar</div>
        <div style={{ fontSize: 11, color: '#2E4A22' }}>Podés seleccionar múltiples fotos a la vez · JPG, PNG, WEBP</div>
        <input ref={inputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => agregarArchivos(e.target.files)} />
      </div>

      {/* Vista previa en grid */}
      {archivos.length > 0 && (
        <div style={st.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#C8D9B8' }}>{archivos.length} foto{archivos.length !== 1 ? 's' : ''} seleccionada{archivos.length !== 1 ? 's' : ''}</span>
            <button onClick={() => { setArchivos([]); setResultados([]); setListo(false); }} style={{ background: 'none', border: 'none', color: '#3A5030', cursor: 'pointer', fontSize: 12 }}>✕ Limpiar</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8, marginBottom: procesando || resultados.length > 0 ? 16 : 0 }}>
            {archivos.map((f, i) => {
              const r = resultados[i];
              const url = URL.createObjectURL(f);
              return (
                <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', background: '#0A0D08', border: '1px solid rgba(74,107,54,0.1)' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {r && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.ok === false ? 'rgba(239,68,68,0.65)' : r.apto_rrss ? 'rgba(74,222,128,0.55)' : 'rgba(0,0,0,0.65)', fontSize: 18, fontWeight: 'bold' }}>
                      {r.ok === false ? '✗' : r.apto_rrss ? '✓' : '—'}
                    </div>
                  )}
                  {procesando && !r && i === resultados.length && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏳</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Barra de progreso */}
          {(procesando || (resultados.length > 0 && resultados.length <= archivos.length)) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#3A5030', marginBottom: 4 }}>
                <span>{resultados.length}/{archivos.length} analizadas</span>
                <span>{pct}%</span>
              </div>
              <div style={{ background: 'rgba(74,107,54,0.1)', borderRadius: 20, height: 4, overflow: 'hidden' }}>
                <div style={{ background: '#4A6B36', height: '100%', width: pct + '%', transition: 'width 0.3s', borderRadius: 20 }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {resultados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {[['✓ Aptas', aptas, '#7AAE5A'], ['— Descartadas', descartadas, '#fbbf24'], ['✗ Errores', errores, '#f87171']].map(([l, v, c]) => (
            <div key={l} style={{ background: '#080B06', border: '1px solid rgba(74,107,54,0.12)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 300, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: '#2E4A22', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button style={st.btn('#4A6B36', !archivos.length || procesando)} onClick={analizar} disabled={!archivos.length || procesando}>
          {procesando ? `⏳ Analizando ${resultados.length}/${archivos.length}...` : `🤖 Analizar ${archivos.length > 0 ? archivos.length + ' fotos' : ''}`}
        </button>
        {terminado && aptas > 0 && !listo && (
          <button style={st.btn('#2E4A22', generando)} onClick={generar} disabled={generando}>
            {generando ? '⏳ Generando captions...' : `✨ Generar captions para ${aptas} fotos`}
          </button>
        )}
        {listo && (
          <a href="/rrss" style={{ padding: '10px 22px', fontSize: 13, background: '#4A6B36', color: '#C8D9B8', borderRadius: 8, textDecoration: 'none' }}>
            Ver publicaciones →
          </a>
        )}
      </div>

      {/* Detalle de resultados */}
      {terminado && resultados.some(r => r.tipo_trabajo || r.error) && (
        <div style={{ marginTop: 20 }}>
          {resultados.map((r, i) => (
            <div key={i} style={{ background: '#080B06', border: '1px solid rgba(74,107,54,0.08)', borderRadius: 8, padding: '8px 14px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#4A6B36', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</span>
              {r.ok === false
                ? <span style={{ color: '#f87171' }}>{r.error}</span>
                : <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {r.tipo_trabajo && <span style={{ color: '#3A5030', textTransform: 'capitalize' }}>{r.tipo_trabajo}</span>}
                    <span style={{ color: '#3A5030' }}>{'⭐'.repeat(r.score_calidad || 0)}</span>
                    <span style={{ color: r.apto_rrss ? '#7AAE5A' : '#fbbf24', fontWeight: 500 }}>{r.apto_rrss ? 'APTA' : r.motivo_descarte || 'no apta'}</span>
                  </div>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
