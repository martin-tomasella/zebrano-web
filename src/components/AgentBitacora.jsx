
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Mismo umbral que Dashboard.jsx usa para "proyecto estancado en Cotizado".
const DIAS_ESTANCADO = 7;

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—';
const formatHora = d => d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });

// ─── Bitácora de Zebrano ────────────────────────────────────────────────────
// Panel global (montado desde Layout.jsx) con un log de avisos proactivos —
// reusa exactamente la misma lógica de "estancados" y "resumenSemana" que ya
// vive en Dashboard.jsx, en vez de reimplementarla con matices distintos.
//
// El input de abajo NO llama a ningún LLM: es un matcher de intención local
// sobre los datos ya cargados acá. zebrano-cotizador es una función aparte,
// atada al flujo de diseño/cotización (NOGAL) — conectarla a preguntas de
// operaciones generaría sesiones de cotización basura y respuestas sin sentido.
export default function AgentBitacora({ collapsed, onToggle }) {
  const [loading, setLoading] = useState(true);
  const [estancados, setEstancados] = useState([]);
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

      const log = [];
      if (estanc.length > 0) {
        log.push({
          id: 'estancados',
          texto: estanc.length === 1
            ? `${estanc[0].clientes?.nombre || 'Un proyecto'} lleva ${estanc[0].dias} días en "Cotizado" sin avanzar.`
            : `${estanc.length} proyectos llevan ${DIAS_ESTANCADO}+ días en "Cotizado" sin avanzar: ${estanc.slice(0, 3).map(e => e.clientes?.nombre || 'sin nombre').join(', ')}${estanc.length > 3 ? '…' : ''}.`,
          hora: new Date(),
        });
      }
      if (resumen.entregados > 0 || resumen.cotizados > 0) {
        log.push({
          id: 'resumen',
          texto: `Esta semana: ${resumen.entregados} entregado${resumen.entregados !== 1 ? 's' : ''}, ${resumen.cotizados} cotizado${resumen.cotizados !== 1 ? 's' : ''} nuevo${resumen.cotizados !== 1 ? 's' : ''} por ${fmt(resumen.valorCotizado)}.`,
          hora: new Date(),
        });
      }
      if (log.length === 0) {
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

  if (collapsed) {
    return (
      <div style={{
        width: 44, minWidth: 44, height: '100vh', overflow: 'hidden',
        borderLeft: '1px solid var(--z-border)', background: 'var(--z-sidebar-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 16, gap: 14, flexShrink: 0,
      }}>
        <button onClick={onToggle} title="Expandir Bitácora" style={{
          background: 'none', border: 'none', color: 'var(--z-text-3)', cursor: 'pointer', fontSize: 14, padding: 4,
        }}>‹</button>
        <div style={{ position: 'relative' }} title="Bitácora">
          <span style={{ fontSize: 16 }}>🪵</span>
          {estancados.length > 0 && (
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
      width: 280, minWidth: 280, height: '100vh', overflow: 'hidden',
      borderLeft: '1px solid var(--z-border)', background: 'var(--z-sidebar-bg)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        height: 56, padding: '0 16px', flexShrink: 0, borderBottom: '1px solid var(--z-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: 'var(--z-primary-light)',
            boxShadow: '0 0 6px var(--z-primary-light)', flexShrink: 0, animation: 'zbitacora-pulse 2s ease infinite',
          }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--z-text)' }}>Bitácora</span>
        </div>
        <button onClick={onToggle} title="Colapsar" style={{
          background: 'none', border: 'none', color: 'var(--z-text-3)', cursor: 'pointer', fontSize: 14, padding: 4,
        }}>›</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--z-text-muted)' }}>Cargando...</div>
        ) : entradas.map(en => (
          <div key={en.id} style={{
            background: en.esRespuesta ? 'rgba(176,123,48,0.06)' : 'var(--z-card)',
            border: '1px solid var(--z-border)', borderLeft: '2px solid var(--z-secondary)',
            borderRadius: 8, padding: '9px 11px',
          }}>
            <div style={{ fontSize: 9.5, color: 'var(--z-text-muted)', marginBottom: 4 }}>{formatHora(en.hora)}</div>
            <div style={{ fontSize: 12, color: 'var(--z-text-2)', lineHeight: 1.45 }}>{en.texto}</div>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} style={{ flexShrink: 0, borderTop: '1px solid var(--z-border)', padding: 10, display: 'flex', gap: 6 }}>
        <input
          value={pregunta}
          onChange={e => setPregunta(e.target.value)}
          placeholder="Preguntale algo a Zebrano..."
          style={{
            flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 8,
            border: '1px solid var(--z-border)', background: 'var(--z-bg-2)', color: 'var(--z-text)', outline: 'none',
          }}
        />
        <button type="submit" style={{
          background: 'var(--z-secondary)', color: '#E8DFD0', border: 'none', borderRadius: 8,
          padding: '0 12px', fontSize: 12, cursor: 'pointer',
        }}>➤</button>
      </form>
      <style>{`@keyframes zbitacora-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
    </div>
  );
}
