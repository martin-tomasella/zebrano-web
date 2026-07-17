
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Mismo umbral que Dashboard.jsx usa para "proyecto estancado en Cotizado".
const DIAS_ESTANCADO = 7;

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—';
const formatHora = d => d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });

// ─── Agent Zebrano (Bitácora) ───────────────────────────────────────────────
// Panel global (montado desde Layout.jsx). Reusa exactamente la misma lógica
// de "estancados" y "resumenSemana" que ya vive en Dashboard.jsx — no se
// reimplementan las queries, solo cambia cómo se presentan.
//
// El hallazgo de "estancados" ahora se presenta como una insight card real con
// 2 acciones reales: navegar a /proyectos (mismo router que el resto de la app)
// y "Descartar" (oculta la card client-side para esta sesión, sin tocar backend).
//
// El input de abajo NO llama a ningún LLM: es un matcher de intención local
// sobre los datos ya cargados acá. zebrano-cotizador es una función aparte,
// atada al flujo de diseño/cotización (NOGAL) — conectarla a preguntas de
// operaciones generaría sesiones de cotización basura y respuestas sin sentido.
export default function AgentBitacora({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [estancados, setEstancados] = useState([]);
  const [estancadosDescartado, setEstancadosDescartado] = useState(false);
  const [resumenSemana, setResumenSemana] = useState(null);
  const [pipelineTotal, setPipelineTotal] = useState(0);
  const [entradas, setEntradas] = useState([]);
  const [pregunta, setPregunta] = useState('');

  useEffect(() => {
    let activo = true;
    const load = async () => {
      const { data: proyectosData } = await supabase
        .from('proyectos')
        .select('id, nombre, estado, fecha_cotizado, fecha_entrega_real, valor_final, valor_estimado, clientes(nombre)');
      if (!activo) return;
      const proyectos = proyectosData || [];
      const hoy = new Date();

      // Proactivo #1 (idéntico a Dashboard.jsx): cotizado sin avanzar por >= DIAS_ESTANCADO días.
      const estanc = proyectos.filter(pr => {
        if (pr.estado !== 'cotizado' || !pr.fecha_cotizado) return false;
        const dias = Math.floor((hoy - new Date(pr.fecha_cotizado)) / 86400000);
        return dias >= DIAS_ESTANCADO;
      }).map(pr => ({ ...pr, dias: Math.floor((hoy - new Date(pr.fecha_cotizado)) / 86400000) }))
        .sort((a, b) => b.dias - a.dias);

      // Proactivo #2 (idéntico a Dashboard.jsx): resumen de la semana.
      const inicioSemana = new Date();
      inicioSemana.setHours(0, 0, 0, 0);
      inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
      const entregadosSemana = proyectos.filter(pr => pr.estado === 'entregado' && pr.fecha_entrega_real && new Date(pr.fecha_entrega_real) >= inicioSemana);
      const cotizadosSemana = proyectos.filter(pr => pr.fecha_cotizado && new Date(pr.fecha_cotizado) >= inicioSemana);
      const valorCotizadoSemana = cotizadosSemana.reduce((s, pr) => s + Number(pr.valor_final || pr.valor_estimado || 0), 0);
      const resumen = { entregados: entregadosSemana.length, cotizados: cotizadosSemana.length, valorCotizado: valorCotizadoSemana };

      // Pipeline activo total (para la pregunta rápida "cuánto pipeline tenemos").
      const pipeline = proyectos
        .filter(pr => pr.estado !== 'entregado' && pr.estado !== 'cancelado')
        .reduce((s, pr) => s + Number(pr.valor_final || pr.valor_estimado || 0), 0);

      // Log de eventos del sistema (todo lo que NO es la insight card accionable de estancados).
      const log = [];
      if (resumen.entregados > 0 || resumen.cotizados > 0) {
        log.push({
          id: 'resumen',
          texto: `Esta semana: ${resumen.entregados} entregado${resumen.entregados !== 1 ? 's' : ''}, ${resumen.cotizados} cotizado${resumen.cotizados !== 1 ? 's' : ''} nuevo${resumen.cotizados !== 1 ? 's' : ''} por ${fmt(resumen.valorCotizado)}.`,
          hora: new Date(),
        });
      }
      if (log.length === 0 && estanc.length === 0) {
        log.push({ id: 'ok', texto: 'Todo al día — sin proyectos estancados ni novedades esta semana.', hora: new Date() });
      }

      setEstancados(estanc);
      setResumenSemana(resumen);
      setPipelineTotal(pipeline);
      setEntradas(log);
      setLoading(false);
    };
    load();
    return () => { activo = false; };
  }, []);

  function responder(texto) {
    const t = texto.trim();
    if (!t) return;
    let respuesta;
    if (/atrasad|estancad/i.test(t)) {
      respuesta = estancados.length === 0
        ? 'No hay proyectos estancados en este momento.'
        : `${estancados.length} estancado${estancados.length !== 1 ? 's' : ''} en "Cotizado": ${estancados.slice(0, 5).map(e => `${e.clientes?.nombre || 'sin nombre'} (${e.dias}d)`).join(', ')}.`;
    } else if (/resumen|semana/i.test(t)) {
      respuesta = resumenSemana
        ? `Esta semana: ${resumenSemana.entregados} entregado${resumenSemana.entregados !== 1 ? 's' : ''}, ${resumenSemana.cotizados} cotizado${resumenSemana.cotizados !== 1 ? 's' : ''} nuevo${resumenSemana.cotizados !== 1 ? 's' : ''} por ${fmt(resumenSemana.valorCotizado)}.`
        : 'Todavía no tengo el resumen de la semana.';
    } else if (/pipeline|cuanto|cuánto|total/i.test(t)) {
      respuesta = `Pipeline activo total: ${fmt(pipelineTotal)}.`;
    } else {
      respuesta = 'Todavía no tengo una IA conversacional conectada acá — por ahora respondo con datos puntuales. Probá preguntando por "estancados", "resumen de la semana" o "pipeline".';
    }
    setEntradas(e => [{ id: `q-${Date.now()}`, texto: respuesta, hora: new Date(), esRespuesta: true }, ...e]);
  }

  function onSubmit(e) {
    e.preventDefault();
    responder(pregunta);
    setPregunta('');
  }

  const mostrarInsight = estancados.length > 0 && !estancadosDescartado;

  if (collapsed) {
    return (
      <div style={{
        width: 44, minWidth: 44, height: '100vh', overflow: 'hidden',
        borderLeft: '1px solid var(--z-border)', background: 'var(--z-sidebar-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 16, gap: 14, flexShrink: 0,
      }}>
        <button onClick={onToggle} title="Expandir Agent Zebrano" style={{
          background: 'none', border: 'none', color: 'var(--z-text-3)', cursor: 'pointer', fontSize: 14, padding: 4,
        }}>‹</button>
        <div style={{ position: 'relative' }} title="Agent Zebrano">
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--z-secondary)' }}>smart_toy</span>
          {mostrarInsight && (
            <span style={{
              position: 'absolute', top: -3, right: -5, width: 7, height: 7, borderRadius: '50%',
              background: 'var(--z-warning)', border: '1px solid var(--z-sidebar-bg)',
            }} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: 320, minWidth: 320, height: '100vh', overflow: 'hidden',
      borderLeft: '1px solid var(--z-border)', background: 'var(--z-card)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 64, padding: '0 16px', flexShrink: 0, borderBottom: '1px solid var(--z-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 'var(--radius-sm)', flexShrink: 0,
            background: 'rgba(248,178,217,0.15)', border: '1px solid rgba(248,178,217,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--z-secondary)' }}>smart_toy</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--z-secondary)', lineHeight: 1.1 }}>Agent Zebrano</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--z-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Assistant</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: 'var(--z-primary)',
            boxShadow: '0 0 6px var(--z-primary)', flexShrink: 0, animation: 'zbitacora-pulse 2s ease infinite',
          }} />
          <button onClick={onToggle} title="Colapsar" style={{
            background: 'none', border: 'none', color: 'var(--z-text-3)', cursor: 'pointer', fontSize: 14, padding: 4,
          }}>›</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--z-text-muted)' }}>Cargando...</div>
        ) : (
          <>
            {/* Insight card accionable: proyectos estancados */}
            {mostrarInsight && (
              <div style={{
                background: 'var(--z-card-hover)', border: '1px solid var(--z-border)',
                borderLeft: '3px solid var(--z-secondary)', borderRadius: 'var(--radius-md)',
                padding: '12px 13px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--z-warning)' }}>priority_high</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--z-text)', letterSpacing: '0.02em' }}>
                    Proyectos estancados detectados
                  </span>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--z-text-2)', lineHeight: 1.5, margin: 0 }}>
                  {estancados.length === 1
                    ? `${estancados[0].clientes?.nombre || 'Un proyecto'} lleva ${estancados[0].dias} días en "Cotizado" sin avanzar.`
                    : `${estancados.length} proyectos llevan ${DIAS_ESTANCADO}+ días en "Cotizado" sin avanzar: ${estancados.slice(0, 3).map(e => e.clientes?.nombre || 'sin nombre').join(', ')}${estancados.length > 3 ? '…' : ''}.`}
                </p>
                <div style={{ marginTop: 10, display: 'flex', gap: 7 }}>
                  <button
                    onClick={() => navigate('/proyectos')}
                    style={{
                      flex: 1, background: 'rgba(248,178,217,0.15)', color: 'var(--z-secondary)',
                      border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 0',
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
                    }}
                  >
                    Ver proyectos
                  </button>
                  <button
                    onClick={() => setEstancadosDescartado(true)}
                    style={{
                      padding: '6px 12px', background: 'var(--z-bg-2)', color: 'var(--z-text-3)',
                      border: '1px solid var(--z-border)', borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
                      textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {/* Log de eventos del sistema (mono timestamps) */}
            {entradas.map(en => (
              <div key={en.id} style={{
                background: en.esRespuesta ? 'rgba(248,178,217,0.06)' : 'transparent',
                borderLeft: '2px solid var(--z-border)', paddingLeft: 10,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--z-text-muted)', marginBottom: 3, letterSpacing: '0.03em' }}>
                  {formatHora(en.hora)} · {en.esRespuesta ? 'Respuesta' : 'Sistema'}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--z-text-2)', lineHeight: 1.45 }}>{en.texto}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Ask Assistant */}
      <form onSubmit={onSubmit} style={{ flexShrink: 0, borderTop: '1px solid var(--z-border)', padding: 12 }}>
        <div style={{ position: 'relative' }}>
          <input
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
            placeholder="Preguntale algo a Zebrano..."
            style={{
              width: '100%', padding: '9px 40px 9px 12px', fontSize: 12, borderRadius: 999,
              border: '1px solid var(--z-border)', background: 'var(--z-bg-2)', color: 'var(--z-text)',
              outline: 'none', fontFamily: 'var(--font-mono)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--z-secondary)'}
            onBlur={e => e.target.style.borderColor = 'var(--z-border)'}
          />
          <button type="submit" style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            width: 26, height: 26, borderRadius: '50%',
            background: 'rgba(248,178,217,0.18)', color: 'var(--z-secondary)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
          </button>
        </div>
      </form>
      <style>{`@keyframes zbitacora-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
    </div>
  );
}
