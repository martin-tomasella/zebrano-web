
import { useState } from 'react';
import { supabase } from '../lib/supabase';

const ALBUM_URL = 'https://photos.google.com/share/AF1QipOOB5AQIT1GG1yAza1F3YpdF1iC6OfN7w7sDNFMoT2vCifURQfbstbmvaOcKMKagQ?key=TzdjSzVsdm1XY2k2ajBnaXZtZlI2a3BKUVY1bW5R';
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function RRSSImport() {
  const [fase, setFase] = useState('idle'); // idle | extrayendo | clasificando | generando | listo | error
  const [fotos, setFotos] = useState([]);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, aptas: 0, descartadas: 0, errores: 0 });
  const [log, setLog] = useState([]);

  const addLog = (msg, tipo = 'info') => {
    setLog(prev => [...prev, { msg, tipo, ts: new Date().toLocaleTimeString('es-AR') }]);
  };

  // Paso 1: extraer URLs del album compartido desde el browser
  const extraerFotos = async () => {
    setFase('extrayendo');
    setLog([]);
    addLog('Cargando álbum de Google Fotos...', 'info');

    try {
      // Usar un proxy CORS para acceder al álbum compartido
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(ALBUM_URL)}`;
      const resp = await fetch(proxyUrl);
      const data = await resp.json();
      const html = data.contents || '';

      // Extraer URLs de imágenes (formato lh3.googleusercontent.com)
      const urlSet = new Set();
      const regex = /https:\/\/lh3\.googleusercontent\.com\/([A-Za-z0-9_\-]+)/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        urlSet.add(`https://lh3.googleusercontent.com/${match[1]}`);
      }

      const urls = Array.from(urlSet);

      if (urls.length === 0) {
        addLog('No se encontraron fotos. El álbum puede requerir login.', 'error');
        addLog('Alternativa: usá el botón "Pegar URLs manualmente"', 'warn');
        setFase('error');
        return;
      }

      addLog(`✓ ${urls.length} fotos encontradas en el álbum`, 'ok');
      setFotos(urls);
      setFase('listo_clasificar');
    } catch (e) {
      addLog('Error extrayendo fotos: ' + e.message, 'error');
      setFase('error');
    }
  };

  // Paso 2: clasificar con Claude Vision via Edge Function
  const clasificarFotos = async (listaFotos, limite = 10) => {
    setFase('clasificando');
    const lote = listaFotos.slice(0, limite);
    setProgreso({ actual: 0, total: lote.length, aptas: 0, descartadas: 0, errores: 0 });

    addLog(`Clasificando ${lote.length} fotos con Claude Vision...`, 'info');

    let aptas = 0, descartadas = 0, errores = 0;

    for (let i = 0; i < lote.length; i++) {
      const url = lote[i];
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/fotos-classifier-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ image_url: url + '=w1200-h1200' }),
        });
        const result = await resp.json();

        if (result.ok) {
          if (result.apto_rrss) {
            aptas++;
            addLog(`✓ [${i+1}/${lote.length}] ${result.tipo_trabajo || 'trabajo'} — score ${result.score_calidad}/5`, 'ok');
          } else {
            descartadas++;
            addLog(`✗ [${i+1}/${lote.length}] Descartada: ${result.motivo_descarte}`, 'warn');
          }
        } else {
          errores++;
          addLog(`! [${i+1}/${lote.length}] Error: ${result.error}`, 'error');
        }

        setProgreso({ actual: i + 1, total: lote.length, aptas, descartadas, errores });
        // Pausa entre requests para no saturar
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        errores++;
        addLog(`! [${i+1}] Error de red: ${e.message}`, 'error');
        setProgreso(p => ({ ...p, actual: i + 1, errores }));
      }
    }

    addLog(`— Clasificación completa: ${aptas} aptas, ${descartadas} descartadas, ${errores} errores`, 'info');
    setFase('clasificado');
  };

  // Paso 3: generar contenido para las fotos aptas
  const generarContenido = async () => {
    setFase('generando');
    addLog('Generando captions con IA...', 'info');
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/rrss-content-generator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ limite: 10 }),
      });
      const data = await resp.json();
      if (data.ok) {
        addLog(`✓ ${data.generadas} borradores generados`, 'ok');
        setFase('listo');
      } else {
        addLog('Error: ' + data.error, 'error');
        setFase('error');
      }
    } catch (e) {
      addLog('Error: ' + e.message, 'error');
      setFase('error');
    }
  };

  const pct = progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0;

  const s = {
    page: { padding: 24, maxWidth: 800, margin: '0 auto', color: '#E8DFD0' },
    h1: { fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, fontWeight: 300, fontStyle: 'italic', color: '#E8DFD0', margin: '0 0 4px' },
    sub: { color: '#3A5030', fontSize: 12, marginBottom: 24 },
    card: { background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
    label: { fontSize: 10, color: '#3A5030', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' },
    btn: (color = '#4A6B36', disabled = false) => ({
      padding: '10px 20px', fontSize: 13, background: disabled ? '#1a1a1a' : color,
      color: disabled ? '#3A5030' : '#C8D9B8', border: 'none', borderRadius: 8,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }),
    bar: { background: 'rgba(74,107,54,0.1)', borderRadius: 20, height: 6, overflow: 'hidden', marginTop: 8 },
    barFill: { background: '#4A6B36', height: '100%', width: pct + '%', transition: 'width 0.3s', borderRadius: 20 },
    logBox: { background: '#050805', border: '1px solid rgba(74,107,54,0.1)', borderRadius: 8, padding: 12, maxHeight: 260, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11 },
    stat: { background: 'rgba(74,107,54,0.06)', borderRadius: 8, padding: '10px 16px', textAlign: 'center' },
  };

  const logColor = { ok: '#7AAE5A', warn: '#fbbf24', error: '#f87171', info: '#8A9E82' };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Importar fotos</h1>
      <p style={s.sub}>Clasifica y genera contenido desde el álbum de Google Fotos</p>

      {/* Paso 1 */}
      <div style={s.card}>
        <span style={s.label}>Paso 1 — Extraer fotos del álbum</span>
        <p style={{ fontSize: 12, color: '#3A5030', marginBottom: 12 }}>
          Lee el álbum compartido de Google Fotos. Las fotos originales no se modifican.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={s.btn('#4A6B36', fase === 'extrayendo')}
            onClick={extraerFotos} disabled={fase === 'extrayendo'}>
            {fase === 'extrayendo' ? '⏳ Extrayendo...' : '📷 Leer álbum'}
          </button>
          {fotos.length > 0 && (
            <span style={{ fontSize: 12, color: '#7AAE5A' }}>✓ {fotos.length} fotos cargadas</span>
          )}
        </div>
      </div>

      {/* Paso 2 */}
      <div style={{ ...s.card, opacity: fotos.length === 0 ? 0.4 : 1 }}>
        <span style={s.label}>Paso 2 — Clasificar con IA</span>
        <p style={{ fontSize: 12, color: '#3A5030', marginBottom: 12 }}>
          Claude Vision analiza cada foto y determina si es apta para publicar.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button style={s.btn('#4A6B36', fotos.length === 0 || fase === 'clasificando')}
            onClick={() => clasificarFotos(fotos, 10)}
            disabled={fotos.length === 0 || fase === 'clasificando'}>
            {fase === 'clasificando' ? '⏳ Clasificando...' : '🤖 Clasificar (10 fotos)'}
          </button>
          <button style={s.btn('#2E4A22', fotos.length === 0 || fase === 'clasificando')}
            onClick={() => clasificarFotos(fotos, 30)}
            disabled={fotos.length === 0 || fase === 'clasificando'}>
            Clasificar (30 fotos)
          </button>
        </div>

        {fase === 'clasificando' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#3A5030' }}>
              <span>{progreso.actual}/{progreso.total} procesadas</span>
              <span>{pct}%</span>
            </div>
            <div style={s.bar}><div style={s.barFill} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
              {[['✓ Aptas', progreso.aptas, '#7AAE5A'], ['✗ Descartadas', progreso.descartadas, '#fbbf24'], ['! Errores', progreso.errores, '#f87171']].map(([l, v, c]) => (
                <div key={l} style={s.stat}>
                  <div style={{ fontSize: 20, fontWeight: 300, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: '#3A5030', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Paso 3 */}
      <div style={{ ...s.card, opacity: fase !== 'clasificado' && fase !== 'generando' && fase !== 'listo' ? 0.4 : 1 }}>
        <span style={s.label}>Paso 3 — Generar contenido</span>
        <p style={{ fontSize: 12, color: '#3A5030', marginBottom: 12 }}>
          Genera captions para Instagram y Facebook de las fotos aptas.
        </p>
        <button
          style={s.btn('#4A6B36', fase !== 'clasificado')}
          onClick={generarContenido}
          disabled={fase !== 'clasificado'}>
          {fase === 'generando' ? '⏳ Generando...' : fase === 'listo' ? '✓ Contenido generado' : '✨ Generar captions'}
        </button>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div style={s.card}>
          <span style={s.label}>Log</span>
          <div style={s.logBox}>
            {log.map((l, i) => (
              <div key={i} style={{ color: logColor[l.tipo], marginBottom: 3 }}>
                <span style={{ color: '#2E4A22' }}>[{l.ts}]</span> {l.msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {fase === 'listo' && (
        <div style={{ ...s.card, borderColor: 'rgba(122,174,90,0.3)', background: 'rgba(74,107,54,0.05)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <p style={{ color: '#7AAE5A', fontSize: 14 }}>Proceso completo. Los borradores están listos en la sección Publicaciones.</p>
          <a href="/rrss" style={{ display: 'inline-block', marginTop: 12, padding: '8px 16px', background: '#4A6B36', color: '#C8D9B8', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>
            Ver publicaciones →
          </a>
        </div>
      )}
    </div>
  );
}
