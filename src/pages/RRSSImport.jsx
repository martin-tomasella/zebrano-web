
import { useState } from 'react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function RRSSImport() {
  const [estado, setEstado] = useState('idle'); // idle | procesando | listo | error
  const [resultado, setResultado] = useState(null);
  const [msg, setMsg] = useState('');

  const procesar = async () => {
    setEstado('procesando');
    setMsg('Buscando fotos nuevas en Google Drive...');
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/fotos-classifier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ limite: 20 }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Error desconocido');

      if (data.procesadas === 0) {
        setMsg(data.mensaje || 'No hay fotos nuevas para procesar.');
        setEstado('listo');
        return;
      }

      setMsg(`Clasificadas ${data.procesadas} fotos. Generando captions...`);

      if (data.aptas > 0) {
        const r2 = await fetch(`${SUPABASE_URL}/functions/v1/rrss-content-generator`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ limite: data.aptas }),
        });
        const d2 = await r2.json();
        setResultado({ ...data, borradores: d2.generadas || 0 });
      } else {
        setResultado({ ...data, borradores: 0 });
      }
      setEstado('listo');
    } catch (e) {
      setMsg(e.message);
      setEstado('error');
    }
  };

  const s = {
    page: { padding: '40px 24px', maxWidth: 560, margin: '0 auto', color: '#E8DFD0' },
    h1: { fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 300, fontStyle: 'italic', color: '#E8DFD0', marginBottom: 6 },
    sub: { fontSize: 12, color: '#3A5030', marginBottom: 36, lineHeight: 1.6 },
    card: { background: '#080B06', border: '1px solid rgba(74,107,54,0.15)', borderRadius: 14, padding: '28px 24px', textAlign: 'center' },
    btnPrimary: { padding: '14px 32px', fontSize: 14, background: '#4A6B36', color: '#C8D9B8', border: 'none', borderRadius: 10, cursor: 'pointer', width: '100%', letterSpacing: '0.02em' },
    btnSecondary: { padding: '10px 24px', fontSize: 13, background: 'transparent', color: '#7AAE5A', border: '1px solid rgba(74,107,54,0.3)', borderRadius: 10, cursor: 'pointer', marginTop: 14, display: 'inline-block', textDecoration: 'none' },
    stat: (c) => ({ fontSize: 32, fontWeight: 300, color: c, marginBottom: 2 }),
    statLabel: { fontSize: 10, color: '#3A5030', textTransform: 'uppercase', letterSpacing: '0.08em' },
  };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Sincronizar fotos</h1>
      <p style={s.sub}>
        Trae las fotos nuevas de Google Drive, las clasifica con IA y genera los borradores para Instagram y Facebook.
        <br />Las fotos originales nunca se modifican.
      </p>

      <div style={s.card}>
        {estado === 'idle' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📸</div>
            <button style={s.btnPrimary} onClick={procesar}>
              Buscar y procesar fotos nuevas
            </button>
            <p style={{ fontSize: 11, color: '#2E4A22', marginTop: 14 }}>
              Procesa hasta 20 fotos por vez · Las fotos ya procesadas se omiten
            </p>
          </>
        )}

        {estado === 'procesando' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
            <p style={{ color: '#8A9E82', fontSize: 14 }}>{msg}</p>
            <p style={{ color: '#3A5030', fontSize: 11, marginTop: 10 }}>Esto puede tardar 1-2 minutos...</p>
          </>
        )}

        {estado === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p style={{ color: '#f87171', fontSize: 13, marginBottom: 20 }}>{msg}</p>
            <button style={s.btnPrimary} onClick={() => setEstado('idle')}>Reintentar</button>
          </>
        )}

        {estado === 'listo' && resultado && (
          <>
            <div style={{ fontSize: 40, marginBottom: 20 }}>✅</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
              <div>
                <div style={s.stat('#7AAE5A')}>{resultado.aptas}</div>
                <div style={s.statLabel}>Aptas</div>
              </div>
              <div>
                <div style={s.stat('#fbbf24')}>{resultado.descartadas}</div>
                <div style={s.statLabel}>Descartadas</div>
              </div>
              <div>
                <div style={s.stat('#C8D9B8')}>{resultado.borradores}</div>
                <div style={s.statLabel}>Borradores</div>
              </div>
            </div>
            <a href="/rrss" style={{ ...s.btnSecondary, padding: '12px 28px', fontSize: 13, background: '#4A6B36', color: '#C8D9B8', borderRadius: 10, textDecoration: 'none', display: 'block' }}>
              Ver publicaciones →
            </a>
            <button style={{ ...s.btnSecondary, display: 'block', width: '100%', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => { setEstado('idle'); setResultado(null); }}>
              Procesar más fotos
            </button>
          </>
        )}

        {estado === 'listo' && !resultado && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <p style={{ color: '#8A9E82', fontSize: 14, marginBottom: 20 }}>{msg}</p>
            <button style={s.btnPrimary} onClick={() => setEstado('idle')}>Volver</button>
          </>
        )}
      </div>

      {estado === 'error' && msg.includes('Sin tokens') && (
        <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 10, fontSize: 12, color: '#fbbf24' }}>
          ⚠️ Google Drive no está conectado. Activá la sincronización de Google Fotos con Drive en el celular primero.
        </div>
      )}
    </div>
  );
}
