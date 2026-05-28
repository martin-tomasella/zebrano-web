
import { useState } from 'react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const INSTRUCCIONES = `Cómo obtener las URLs de tus fotos:

1. Abrí Google Fotos en el navegador (photos.google.com)
2. Abrí una foto → click derecho sobre la imagen → "Copiar dirección de imagen"
3. Pegá cada URL acá (una por línea)

Las URLs tienen este formato:
https://lh3.googleusercontent.com/XXXX...

También podés pegar el link directo de cada foto de Google Fotos.`;

export default function RRSSImport() {
  const [urlsText, setUrlsText] = useState('');
  const [fase, setFase] = useState('idle');
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, aptas: 0, descartadas: 0, errores: 0 });
  const [log, setLog] = useState([]);
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false);

  const addLog = (msg, tipo = 'info') =>
    setLog(prev => [...prev.slice(-99), { msg, tipo, ts: new Date().toLocaleTimeString('es-AR') }]);

  const parsearURLs = (texto) => {
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    const urls = [];
    for (const linea of lineas) {
      // URL directa de lh3.googleusercontent.com
      if (linea.startsWith('https://lh3.googleusercontent.com/')) {
        urls.push(linea.split('=')[0]); // sacar parámetros de tamaño
      }
      // Link de Google Fotos (photos.google.com/photo/...)
      else if (linea.includes('photos.google.com')) {
        urls.push(linea); // se procesará como link de fotos
      }
    }
    return [...new Set(urls)]; // deduplicar
  };

  const clasificarFotos = async () => {
    const fotos = parsearURLs(urlsText);
    if (fotos.length === 0) {
      addLog('No se encontraron URLs válidas. Revisá el formato.', 'error');
      return;
    }

    setFase('clasificando');
    setProgreso({ actual: 0, total: fotos.length, aptas: 0, descartadas: 0, errores: 0 });
    addLog(`Iniciando clasificación de ${fotos.length} fotos...`, 'info');

    let aptas = 0, descartadas = 0, errores = 0;

    for (let i = 0; i < fotos.length; i++) {
      const url = fotos[i];
      try {
        // Agregar parámetro de tamaño para optimizar la descarga
        const urlConTamaño = url.includes('lh3.googleusercontent.com')
          ? url + '=w1200-h1200'
          : url;

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/fotos-classifier-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ image_url: urlConTamaño }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const result = await resp.json();

        if (result.ya_procesada) {
          addLog(`[${i+1}/${fotos.length}] Ya procesada anteriormente`, 'info');
        } else if (result.ok) {
          if (result.apto_rrss) {
            aptas++;
            addLog(`✓ [${i+1}/${fotos.length}] APTA — ${result.tipo_trabajo || 'trabajo'} · score ${result.score_calidad}/5`, 'ok');
          } else {
            descartadas++;
            addLog(`✗ [${i+1}/${fotos.length}] Descartada: ${result.motivo_descarte || 'no apta para RRSS'}`, 'warn');
          }
        } else {
          errores++;
          addLog(`! [${i+1}/${fotos.length}] Error: ${result.error}`, 'error');
        }
      } catch (e) {
        errores++;
        addLog(`! [${i+1}/${fotos.length}] ${e.message}`, 'error');
      }

      setProgreso({ actual: i + 1, total: fotos.length, aptas, descartadas, errores });
      await new Promise(r => setTimeout(r, 600));
    }

    addLog(`─── Terminado: ${aptas} aptas · ${descartadas} descartadas · ${errores} errores`, 'info');
    setFase('clasificado');
  };

  const generarContenido = async () => {
    setFase('generando');
    addLog('Generando captions con IA...', 'info');
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/rrss-content-generator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ limite: 20 }),
      });
      const data = await resp.json();
      if (data.ok) {
        addLog(`✓ ${data.generadas} borradores creados`, 'ok');
        setFase('listo');
      } else {
        addLog('Error: ' + (data.error || 'desconocido'), 'error');
        setFase('clasificado');
      }
    } catch (e) {
      addLog('Error: ' + e.message, 'error');
      setFase('clasificado');
    }
  };

  const pct = progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0;

  const st = {
    page:  { padding: 24, maxWidth: 860, margin: '0 auto', color: '#E8DFD0' },
    h1:    { fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, fontWeight: 300, fontStyle: 'italic', color: '#E8DFD0', margin: '0 0 4px' },
    sub:   { color: '#3A5030', fontSize: 12, marginBottom: 28 },
    card:  { background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
    lbl:   { fontSize: 10, color: '#3A5030', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, display: 'block' },
    btn:   (bg, dis) => ({ padding: '9px 18px', fontSize: 12, background: dis ? '#111' : bg, color: dis ? '#2E4A22' : '#C8D9B8', border: 'none', borderRadius: 8, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.5 : 1, transition: 'opacity 0.15s' }),
    ghost: { padding: '7px 14px', fontSize: 11, background: 'transparent', color: '#3A5030', border: '1px solid rgba(74,107,54,0.2)', borderRadius: 8, cursor: 'pointer' },
    bar:   { background: 'rgba(74,107,54,0.1)', borderRadius: 20, height: 5, overflow: 'hidden', marginTop: 8 },
    fill:  { background: '#4A6B36', height: '100%', width: pct + '%', transition: 'width 0.3s', borderRadius: 20 },
    log:   { background: '#050805', border: '1px solid rgba(74,107,54,0.08)', borderRadius: 8, padding: '10px 14px', maxHeight: 280, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11 },
  };

  const logC = { ok: '#7AAE5A', warn: '#fbbf24', error: '#f87171', info: '#4A6B36' };

  const urlCount = parsearURLs(urlsText).length;

  return (
    <div style={st.page}>
      <h1 style={st.h1}>Importar fotos</h1>
      <p style={st.sub}>Clasificá fotos desde Google Fotos y generá contenido para RRSS</p>

      {/* Paso 1: pegar URLs */}
      <div style={st.card}>
        <span style={st.lbl}>Paso 1 — Pegá las URLs de las fotos</span>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: '#3A5030', margin: 0 }}>
            Pegá una URL por línea (formato <code style={{ color: '#4A6B36', fontSize: 11 }}>lh3.googleusercontent.com/...</code>)
          </p>
          <button style={st.ghost} onClick={() => setMostrarInstrucciones(v => !v)}>
            {mostrarInstrucciones ? 'Ocultar ayuda' : '? Cómo obtener las URLs'}
          </button>
        </div>

        {mostrarInstrucciones && (
          <pre style={{ background: 'rgba(74,107,54,0.06)', border: '1px solid rgba(74,107,54,0.1)', borderRadius: 8, padding: 14, fontSize: 11, color: '#8A9E82', whiteSpace: 'pre-wrap', marginBottom: 12, lineHeight: 1.7 }}>
            {INSTRUCCIONES}
          </pre>
        )}

        <textarea
          value={urlsText}
          onChange={e => setUrlsText(e.target.value)}
          placeholder={'https://lh3.googleusercontent.com/abc123...\nhttps://lh3.googleusercontent.com/def456...\n...'}
          rows={8}
          style={{
            width: '100%', background: '#050805', border: '1px solid rgba(74,107,54,0.2)',
            borderRadius: 8, padding: '10px 14px', color: '#C8D9B8', fontSize: 12,
            fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box',
            outline: 'none', lineHeight: 1.6,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          {urlCount > 0 && (
            <span style={{ fontSize: 12, color: '#7AAE5A' }}>
              ✓ {urlCount} URL{urlCount !== 1 ? 's' : ''} válida{urlCount !== 1 ? 's' : ''}
            </span>
          )}
          {urlsText && (
            <button style={st.ghost} onClick={() => { setUrlsText(''); setLog([]); setFase('idle'); }}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Paso 2: clasificar */}
      <div style={{ ...st.card, opacity: urlCount === 0 ? 0.4 : 1 }}>
        <span style={st.lbl}>Paso 2 — Clasificar con Claude Vision</span>
        <p style={{ fontSize: 12, color: '#3A5030', marginBottom: 12 }}>
          La IA analiza cada foto y decide si es apta para publicar. Las fotos originales no se modifican.
        </p>
        <button
          style={st.btn('#4A6B36', urlCount === 0 || fase === 'clasificando')}
          onClick={clasificarFotos}
          disabled={urlCount === 0 || fase === 'clasificando'}>
          {fase === 'clasificando' ? '⏳ Clasificando...' : `🤖 Clasificar ${urlCount > 0 ? urlCount + ' fotos' : ''}`}
        </button>

        {(fase === 'clasificando' || fase === 'clasificado') && progreso.total > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#3A5030', marginBottom: 4 }}>
              <span>{progreso.actual} / {progreso.total}</span>
              <span>{pct}%</span>
            </div>
            <div style={st.bar}><div style={st.fill} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
              {[['Aptas', progreso.aptas, '#7AAE5A'], ['Descartadas', progreso.descartadas, '#fbbf24'], ['Errores', progreso.errores, '#f87171']].map(([l, v, c]) => (
                <div key={l} style={{ background: 'rgba(74,107,54,0.05)', borderRadius: 8, padding: '10px 8px', textAlign: 'center', border: '1px solid rgba(74,107,54,0.1)' }}>
                  <div style={{ fontSize: 22, fontWeight: 300, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: '#3A5030', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Paso 3: generar contenido */}
      <div style={{ ...st.card, opacity: fase !== 'clasificado' && fase !== 'generando' && fase !== 'listo' ? 0.4 : 1 }}>
        <span style={st.lbl}>Paso 3 — Generar captions con IA</span>
        <p style={{ fontSize: 12, color: '#3A5030', marginBottom: 12 }}>
          Genera texto para Instagram y Facebook de cada foto apta. Quedan como borradores para revisar.
        </p>
        <button
          style={st.btn('#4A6B36', fase !== 'clasificado')}
          onClick={generarContenido}
          disabled={fase !== 'clasificado'}>
          {fase === 'generando' ? '⏳ Generando...' : fase === 'listo' ? '✓ Captions generados' : '✨ Generar captions'}
        </button>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div style={st.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={st.lbl}>Log</span>
            <button style={{ ...st.ghost, padding: '3px 10px', fontSize: 10 }} onClick={() => setLog([])}>Limpiar</button>
          </div>
          <div style={st.log} ref={el => el && (el.scrollTop = el.scrollHeight)}>
            {log.map((l, i) => (
              <div key={i} style={{ color: logC[l.tipo], marginBottom: 2, lineHeight: 1.5 }}>
                <span style={{ color: '#1E3014' }}>[{l.ts}]</span> {l.msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listo */}
      {fase === 'listo' && (
        <div style={{ ...st.card, borderColor: 'rgba(122,174,90,0.3)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <p style={{ color: '#7AAE5A', fontSize: 14, marginBottom: 16 }}>
            Proceso completo. Los borradores están listos para revisar y aprobar.
          </p>
          <a href="/rrss" style={{ padding: '9px 18px', background: '#4A6B36', color: '#C8D9B8', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>
            Ver publicaciones →
          </a>
        </div>
      )}
    </div>
  );
}
