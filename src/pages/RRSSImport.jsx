
import { useState, useRef, useCallback } from 'react';
import { Layout, Topbar, PageContent } from '../components/Layout';

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
    setResultados([]); setListo(false);
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
          method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ANON_KEY}`},
          body: JSON.stringify({ base64, media_type: file.type, filename: file.name }),
        });
        const data = await resp.json();
        res.push({ nombre: file.name, file, ...data });
      } catch(e) {
        res.push({ nombre: file.name, file, ok: false, error: e.message });
      }
      setResultados([...res]);
    }
    setProcesando(false);
  };

  const generar = async () => {
    setGenerando(true);
    await fetch(`${SUPABASE_URL}/functions/v1/rrss-content-generator`, {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ANON_KEY}`},
      body: JSON.stringify({ limite: 20 }),
    });
    setGenerando(false); setListo(true);
  };

  const aptas = resultados.filter(r => r.apto_rrss === true).length;
  const descartadas = resultados.filter(r => r.apto_rrss === false).length;
  const errores = resultados.filter(r => r.ok === false).length;
  const terminado = resultados.length === archivos.length && archivos.length > 0 && !procesando;
  const pct = archivos.length > 0 ? Math.round((resultados.length / archivos.length) * 100) : 0;

  return (
    <Layout>
      <Topbar title="Importar fotos" subtitle="Clasificación automática con IA" />
      <PageContent>
        <div style={{ maxWidth:680, margin:'0 auto' }}>

          {/* Zona drag & drop */}
          <div
            style={{ border:`2px dashed ${drag ? 'var(--z-primary)' : 'var(--z-border)'}`, borderRadius:'var(--z-radius-xl)', padding:'48px 32px', textAlign:'center', cursor:'pointer', transition:'var(--z-transition)', marginBottom:20, background: drag ? 'rgba(74,107,54,0.04)' : 'transparent' }}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div style={{ fontSize:44, marginBottom:14 }}>📸</div>
            <div style={{ fontSize:15, color:'var(--z-text)', fontWeight:500, marginBottom:6 }}>Arrastrá fotos acá o hacé click para seleccionar</div>
            <div style={{ fontSize:12, color:'var(--z-text-muted)' }}>Seleccioná múltiples fotos · JPG, PNG, WEBP</div>
            <input ref={inputRef} type="file" multiple accept="image/*" style={{ display:'none' }} onChange={e => agregarArchivos(e.target.files)} />
          </div>

          {/* Vista previa */}
          {archivos.length > 0 && (
            <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', padding:'16px 20px', marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ fontSize:13, color:'var(--z-text)', fontWeight:500 }}>{archivos.length} foto{archivos.length!==1?'s':''}</span>
                <button onClick={() => { setArchivos([]); setResultados([]); setListo(false); }} style={{ background:'none', border:'none', color:'var(--z-text-3)', cursor:'pointer', fontSize:12 }}>✕ Limpiar</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(72px,1fr))', gap:8, marginBottom: procesando||resultados.length>0?16:0 }}>
                {archivos.map((f, i) => {
                  const r = resultados[i];
                  const url = URL.createObjectURL(f);
                  return (
                    <div key={i} style={{ position:'relative', borderRadius:8, overflow:'hidden', aspectRatio:'1', background:'var(--z-bg-2)', border:'1px solid var(--z-border)' }}>
                      <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      {r && (
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background: r.ok===false?'rgba(239,68,68,0.65)':r.apto_rrss?'rgba(74,222,128,0.55)':'rgba(0,0,0,0.65)', fontSize:18, fontWeight:'bold' }}>
                          {r.ok===false?'✗':r.apto_rrss?'✓':'—'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {(procesando||(resultados.length>0&&resultados.length<=archivos.length)) && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--z-text-3)', marginBottom:4 }}>
                    <span>{resultados.length}/{archivos.length} analizadas</span><span>{pct}%</span>
                  </div>
                  <div style={{ background:'var(--z-border)', borderRadius:20, height:4, overflow:'hidden' }}>
                    <div style={{ background:'var(--z-gradient)', height:'100%', width:pct+'%', transition:'width 0.3s', borderRadius:20 }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          {resultados.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {[['✓ Aptas',aptas,'var(--z-success)'],['— Descartadas',descartadas,'var(--z-warning)'],['✗ Errores',errores,'var(--z-error)']].map(([l,v,c])=>(
                <div key={l} style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', padding:'14px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:26, fontWeight:700, color:c }}>{v}</div>
                  <div style={{ fontSize:10, color:'var(--z-text-3)', marginTop:3, textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Acciones */}
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button className="btn btn-primary" disabled={!archivos.length||procesando} onClick={analizar}>
              {procesando ? `⏳ Analizando ${resultados.length}/${archivos.length}...` : `🤖 Analizar ${archivos.length>0?archivos.length+' fotos':''}`}
            </button>
            {terminado && aptas > 0 && !listo && (
              <button className="btn btn-ghost" disabled={generando} onClick={generar}>
                {generando ? '⏳ Generando...' : `✨ Generar captions (${aptas})`}
              </button>
            )}
            {listo && (
              <a href="/rrss" className="btn btn-primary">Ver publicaciones →</a>
            )}
          </div>
        </div>
      </PageContent>
    </Layout>
  );
}
