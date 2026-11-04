
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase'
import { authFetch as fetch } from '../lib/authFetch';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Avatar } from '../components/ui';

const COLUMNAS = [
  { id:'cotizado',       label:'Cotizado',        color:'#B07418' },
  { id:'aprobado',       label:'Aprobado',        color:'#2563D6' },
  { id:'sena_pagada',    label:'Seña pagada',     color:'#B07418' },
  { id:'en_fabricacion', label:'En fabricación',  color:'#1A854A' },
  { id:'entregado',      label:'Entregado',       color:'#0D7665' },
];
const ESTADO_LABEL = { prospecto:'Prospecto', cotizado:'Cotizado', aprobado:'Aprobado', sena_pagada:'Seña pagada', en_fabricacion:'En fabricación', entregado:'Entregado', cancelado:'Cancelado' };

// Mismos colores que BADGE_MAP en components/ui.jsx, pero como estilos literales
// (esta página ya no importa Badge de ui.jsx, sólo reutiliza su paleta de estado).
const BADGE_STYLE = {
  prospecto:      { bg:'rgb(var(--z-ink-3-c) / 0.15)', color:'#687482', border:'rgb(var(--z-ink-3-c) / 0.3)' },
  cotizado:       { bg:'rgb(var(--z-warning-c) / 0.15)',  color:'#B4700E', border:'rgb(var(--z-warning-c) / 0.3)' },
  aprobado:       { bg:'rgb(37 99 214 / 0.15)', color:'#2563D6', border:'rgb(37 99 214 / 0.3)' },
  sena_pagada:    { bg:'rgb(var(--z-success-c) / 0.15)', color:'#1A854A', border:'rgb(var(--z-success-c) / 0.3)' },
  en_fabricacion: { bg:'rgb(var(--z-primary-c) / 0.15)', color:'#0D7665', border:'rgb(var(--z-primary-c) / 0.3)' },
  entregado:      { bg:'rgb(var(--z-success-c) / 0.18)',  color:'#1A854A', border:'rgb(var(--z-success-c) / 0.32)' },
  cancelado:      { bg:'rgb(var(--z-danger-c) / 0.15)', color:'#C43428', border:'rgb(var(--z-danger-c) / 0.3)' },
};

// Mapa de avance: desde qué estado se puede pasar a cuál, y qué fecha real se sella.
const SIGUIENTE = {
  cotizado:       { estado:'aprobado',       label:'Aprobar (genera la OT)', campoFecha:'fecha_aprobado' },
  aprobado:       { estado:'sena_pagada',    label:'Marcar seña pagada',   campoFecha:'fecha_sena_pagada' },
  sena_pagada:    { estado:'en_fabricacion', label:'Iniciar fabricación',  campoFecha:'fecha_inicio_fabricacion' },
  en_fabricacion: { estado:'entregado',      label:'Marcar entregado',     campoFecha:'fecha_entrega_real' },
};

// Mismo umbral que Dashboard.jsx usa para "proyecto estancado en Cotizado".
const DIAS_ESTANCADO = 7;

const STAGE_PCT = { cotizado:15, aprobado:25, sena_pagada:40, en_fabricacion:70, entregado:100 };

function fechaEntradaEtapa(p) {
  if (p.estado === 'aprobado') return p.fecha_aprobado;
  if (p.estado === 'sena_pagada') return p.fecha_sena_pagada;
  if (p.estado === 'en_fabricacion') return p.fecha_inicio_fabricacion;
  if (p.estado === 'entregado') return p.fecha_entrega_real;
  return p.fecha_cotizado || p.created_at;
}
function diasEnEtapa(p) {
  const f = fechaEntradaEtapa(p);
  if (!f) return 0;
  return Math.floor((new Date() - new Date(f)) / 86400000);
}
// Misma definición que Dashboard.jsx: cotizado sin avanzar por >= DIAS_ESTANCADO días.
function esEstancado(p) {
  if (p.estado !== 'cotizado' || !p.fecha_cotizado) return false;
  return Math.floor((new Date() - new Date(p.fecha_cotizado)) / 86400000) >= DIAS_ESTANCADO;
}
// % de avance en el recorrido cotizado -> entregado. Dentro de "en fabricación",
// se nudgea con horas reales/estimadas de la OT vinculada cuando existe.
function calcPct(p) {
  if (p.estado === 'entregado') return 100;
  let base = STAGE_PCT[p.estado] ?? 10;
  if (p.estado === 'en_fabricacion') {
    const ot = Array.isArray(p.ordenes_trabajo) ? p.ordenes_trabajo[0] : p.ordenes_trabajo;
    const est = Number(ot?.horas_fabricacion_estimadas || 0);
    const real = Number(ot?.horas_fabricacion_reales || 0);
    if (est > 0) base += Math.min(real / est, 1) * 20;
  }
  return Math.min(base, 98);
}

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—';
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—';

function diasPara(fecha) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha) - new Date()) / 86400000);
}

// ─── Badge de estado (chip: dot + mono ), literal Tailwind ───────────
function EstadoBadge({ value }) {
  const s = BADGE_STYLE[value] || { bg:'rgb(var(--z-ink-3-c) / 0.15)', color:'#687482', border:'rgb(var(--z-ink-3-c) / 0.3)' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11.5px] font-medium "
      style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}` }}
    >
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background:s.color }} />
      {ESTADO_LABEL[value] || value}
    </span>
  );
}

// ─── Input literal (reemplaza <Input/> de ui.jsx) ─────────────────────────────
function Campo({ label, ...props }) {
  return (
    <div>
      {label && <label className="block font-mono text-[11.5px] text-z-ink-3 mb-1.5">{label}</label>}
      <input
        {...props}
        className="w-full px-3 py-2 rounded border border-z-line bg-z-inset text-z-ink text-[13px] font-mono outline-none focus:border-z-primary transition-colors placeholder:text-z-ink-4"
      />
    </div>
  );
}

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('activos');
  const [seleccionado, setSeleccionado] = useState(null);
  const [avanzando, setAvanzando] = useState(false);
  const [formTiempos, setFormTiempos] = useState(null);
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false);
  const [arrastrado, setArrastrado] = useState(null);
  const [destino, setDestino] = useState(null);
  const [nueva, setNueva] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre, telefono, email), ordenes_trabajo(numero_ot, horas_fabricacion_estimadas, horas_fabricacion_reales)')
      .order('created_at', { ascending:false });
    if (error) console.error('Error cargando proyectos:', error);
    setProyectos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cancelados = proyectos.filter(p => p.estado === 'cancelado');
  const activos = proyectos.filter(p => p.estado !== 'cancelado');
  const listado = filtro === 'cancelados' ? cancelados : activos;
  const porEstado = (estado) => listado.filter(p => p.estado === estado);

  const valorPipeline = activos.filter(p => p.estado !== 'entregado').reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0);
  const mesActual = new Date().toISOString().slice(0,7);
  const entregadosMes = proyectos.filter(p => p.estado === 'entregado' && p.fecha_entrega_real?.slice(0,7) === mesActual).length;

  // Paso simple: cotizado -> sena_pagada, y en_fabricacion -> entregado. No piden datos extra.
  async function avanzarEstado(proyecto) {
    const paso = SIGUIENTE[proyecto.estado];
    if (!paso) return;
    setAvanzando(true);
    const { error } = paso.estado === 'aprobado'
      ? await supabase.rpc('aprobar_proyecto', { p_proyecto: proyecto.id })
      : await supabase.from('proyectos').update({
          estado: paso.estado,
          [paso.campoFecha]: new Date().toISOString().slice(0,10),
        }).eq('id', proyecto.id);
    setAvanzando(false);
    if (error) { alert('No se pudo avanzar el estado: ' + error.message); return; }
    await cargar();
    setSeleccionado(s => s ? { ...s, estado: paso.estado, [paso.campoFecha]: new Date().toISOString().slice(0,10) } : s);
  }

  // Paso especial: sena_pagada -> en_fabricacion. Antes de avanzar, pide horas
  // estimadas de fabricacion e instalacion, sugeridas por el agente si hay
  // suficiente historial (5+ casos del mismo tipo_trabajo cargados por un usuario).
  async function abrirFormTiempos(proyecto) {
    setCargandoSugerencia(true);
    const { data } = await supabase
      .from('zebrano_conocimiento_tiempos')
      .select('horas_fabricacion, horas_instalacion')
      .eq('tipo_trabajo', proyecto.tipo_trabajo)
      .eq('fuente', 'usuario');
    setCargandoSugerencia(false);
    let sugerido = false, hf = '', hi = '';
    if (data && data.length >= 5) {
      hf = (data.reduce((s,d) => s + Number(d.horas_fabricacion||0), 0) / data.length).toFixed(1);
      hi = (data.reduce((s,d) => s + Number(d.horas_instalacion||0), 0) / data.length).toFixed(1);
      sugerido = true;
    }
    setFormTiempos({ horasFabricacion: hf, horasInstalacion: hi, multiTramo:false, tramos:[{ nombre:'', horas:'' }], sugerido, basadoEn: data?.length || 0 });
  }

  async function confirmarTiempos(proyecto) {
    if (!formTiempos.horasFabricacion || !formTiempos.horasInstalacion) { alert('Completá las horas estimadas de fabricación e instalación.'); return; }
    setAvanzando(true);

    let { data: otExistente } = await supabase.from('ordenes_trabajo').select('id').eq('proyecto_id', proyecto.id).limit(1).maybeSingle();
    let otId = otExistente?.id;
    if (!otId) {
      const { count } = await supabase.from('ordenes_trabajo').select('id', { count:'exact', head:true });
      const numero_ot = `OT-${new Date().getFullYear()}-${String((count||0)+1).padStart(3,'0')}`;
      const { data: nuevaOt, error: eOt } = await supabase.from('ordenes_trabajo').insert({
        proyecto_id: proyecto.id, tipo_trabajo: proyecto.tipo_trabajo, numero_ot, estado:'pendiente',
      }).select('id').single();
      if (eOt) { setAvanzando(false); alert('No se pudo crear la orden de trabajo: ' + eOt.message); return; }
      otId = nuevaOt.id;
    }

    const tramos = formTiempos.multiTramo ? formTiempos.tramos.filter(t => t.nombre && t.horas) : null;

    const { error: eUpd } = await supabase.from('ordenes_trabajo').update({
      horas_fabricacion_estimadas: Number(formTiempos.horasFabricacion),
      horas_instalacion_estimadas: Number(formTiempos.horasInstalacion),
      tramos_instalacion: tramos,
    }).eq('id', otId);
    if (eUpd) { setAvanzando(false); alert('No se pudieron guardar los tiempos: ' + eUpd.message); return; }

    await supabase.from('zebrano_conocimiento_tiempos').insert({
      orden_trabajo_id: otId,
      tipo_trabajo: proyecto.tipo_trabajo,
      horas_fabricacion: Number(formTiempos.horasFabricacion),
      horas_instalacion: Number(formTiempos.horasInstalacion),
      fuente: formTiempos.sugerido ? 'agente' : 'usuario',
      validado_por_usuario: true,
    });

    // Mismo camino que "Iniciar fabricación" en Producción: OT en proceso, corre el tiempo, proyecto en fabricación.
    const { error: eProy } = await supabase.rpc('ot_iniciar', { p_ot: otId });
    setAvanzando(false);
    if (eProy) { alert('No se pudo avanzar el proyecto: ' + eProy.message); return; }
    setFormTiempos(null);
    await cargar();
    setSeleccionado(null);
  }

  async function cancelarProyecto(proyecto) {
    if (!window.confirm(`¿Cancelar el proyecto de ${proyecto.clientes?.nombre || 'este cliente'}?`)) return;
    setAvanzando(true);
    const { error } = await supabase.from('proyectos').update({ estado:'cancelado' }).eq('id', proyecto.id);
    setAvanzando(false);
    if (error) { alert('No se pudo cancelar: ' + error.message); return; }
    await cargar();
    setSeleccionado(null);
  }

  function seleccionar(p) {
    setSeleccionado(p);
    setFormTiempos(null);
  }

  return (
    <Layout>
      <Topbar
        title="Proyectos"
        subtitle={`${activos.length} activos · ${fmt(valorPipeline)} abiertos · ${entregadosMes} entregados este mes · Arrastrá una tarjeta a la etapa siguiente para avanzarla`}
        actions={
          <div className="flex items-center gap-2">
          <button onClick={() => setNueva(true)} className="bg-z-primary text-z-on-primary px-3.5 py-1.5 rounded text-[12.5px] font-medium hover:brightness-110 inline-flex items-center gap-1"><Icon name="add" size={16} />Nueva cotización</button>
          <div className="z-seg" role="group" aria-label="Filtro">
            {[['activos','Activos'],['cancelados',`Cancelados (${cancelados.length})`]].map(([v,l]) => (
              <button
                key={v}
                onClick={() => setFiltro(v)}
                aria-pressed={filtro===v}
              >
                {l}
              </button>
            ))}
          </div>
          </div>
        }
      />
      <PageContent pad={filtro === 'activos' ? '16px 24px' : 24}>
        {loading ? (
          <div className="text-center py-12 text-z-ink-4">Cargando...</div>
        ) : listado.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-z-line rounded-xl text-z-ink-4">
            <div className="text-4xl mb-3">📋</div>
            <p>{filtro === 'cancelados' ? 'Sin proyectos cancelados' : 'Sin proyectos activos todavía'}</p>
          </div>
        ) : filtro === 'cancelados' ? (
          <div className="flex flex-col gap-2.5">
            {listado.map(p => (
              <div
                key={p.id}
                onClick={() => seleccionar(p)}
                className="bg-z-subtle/80 backdrop-blur-sm border border-z-line rounded p-3 flex justify-between items-center cursor-pointer opacity-75 hover:opacity-100 hover:border-z-primary transition-all duration-200"
              >
                <div>
                  <div className="text-sm font-medium text-z-ink">{p.clientes?.nombre || 'Sin nombre'}</div>
                  <div className="text-xs text-z-ink-3 capitalize mt-0.5">{p.tipo_trabajo || p.descripcion || '—'}</div>
                </div>
                <EstadoBadge value="cancelado" />
              </div>
            ))}
          </div>
        ) : (
          // ── Kanban: arrastrar una tarjeta a la etapa siguiente la avanza (mismas reglas que el detalle) ──
          <div className="flex gap-4 overflow-x-auto pb-2 items-start">
            {COLUMNAS.map(col => {
              const cards = porEstado(col.id)
                .map(p => ({ ...p, _dias: diasEnEtapa(p), _estancado: esEstancado(p) }))
                .sort((a,b) => b._dias - a._dias);
              const total = cards.reduce((s, p) => s + Number(p.valor_final || p.valor_estimado || 0), 0);
              const valido = arrastrado && SIGUIENTE[arrastrado.estado]?.estado === col.id;
              const soltar = () => {
                const p = arrastrado; setArrastrado(null); setDestino(null);
                if (!p || !valido) return;
                if (col.id === 'en_fabricacion') { seleccionar(p); abrirFormTiempos(p); }
                else avanzarEstado(p);
              };
              return (
                <div key={col.id}
                  onDragOver={e => { if (valido) { e.preventDefault(); setDestino(col.id); } }}
                  onDragLeave={() => setDestino(d => d === col.id ? null : d)}
                  onDrop={e => { e.preventDefault(); soltar(); }}
                  className={`flex-1 min-w-[260px] flex flex-col rounded-xl p-2 transition-colors ${destino === col.id ? 'bg-z-primary/10 ring-2 ring-z-primary/40' : valido ? 'bg-z-primary/[0.04] ring-1 ring-dashed ring-z-primary/30' : 'bg-z-inset/60'}`}>
                  <div className="flex items-center gap-2 px-2 pt-1 pb-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                    <span className="text-[13.5px] text-z-ink font-semibold">{col.label}</span>
                    <span className="text-[12.5px] text-z-ink-3">{cards.length}</span>
                    <span className="ml-auto text-[12.5px] font-semibold text-z-ink-2">{fmt(total)}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                    {cards.length === 0 ? (
                      <div className="text-[12.5px] text-z-ink-3 text-center py-6 px-2 border border-dashed border-z-line-2 rounded-lg">
                        {valido ? 'Soltá acá para avanzar' : 'Sin proyectos en esta etapa'}
                      </div>
                    ) : cards.map(p => {
                      const pct = calcPct(p);
                      const ot = Array.isArray(p.ordenes_trabajo) ? p.ordenes_trabajo[0] : p.ordenes_trabajo;
                      const restante = p.fecha_entrega_estimada && p.estado !== 'entregado' ? diasPara(p.fecha_entrega_estimada) : null;
                      const atraso = restante != null && restante < 0;
                      const puede = !!SIGUIENTE[p.estado];
                      return (
                        <div
                          key={p.id}
                          draggable={puede}
                          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setArrastrado(p); }}
                          onDragEnd={() => { setArrastrado(null); setDestino(null); }}
                          onClick={() => seleccionar(p)}
                          className={`bg-z-surface rounded-lg p-3 shadow-z-sm border transition-all duration-150 hover:shadow-z ${puede ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${arrastrado?.id === p.id ? 'opacity-40' : ''} ${p._estancado ? 'border-z-warning/50' : 'border-z-line hover:border-z-line-2'}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <Avatar name={p.clientes?.nombre || p.nombre} size={28} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[13.5px] font-semibold text-z-ink truncate">{p.clientes?.nombre || 'Sin nombre'}</div>
                              <div className="text-[12.5px] text-z-ink-3 capitalize truncate">{(p.tipo_trabajo || p.descripcion || '—').replace(/_/g,' ')}{ot?.numero_ot ? ` · ${ot.numero_ot}` : ''}{p.historico ? ' · histórico' : ''}</div>
                            </div>
                            <div className="text-[13px] font-semibold text-z-ink whitespace-nowrap">{fmt(p.valor_final || p.valor_estimado)}</div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <div className="flex-1 h-1 rounded-full bg-z-inset overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p._estancado ? 'rgb(var(--z-warning-c))' : col.color }} />
                            </div>
                            {p._estancado ? (
                              <span className="text-[12px] font-semibold text-z-warning inline-flex items-center gap-0.5"><Icon name="hourglass_top" size={14} />{p._dias} d sin avanzar</span>
                            ) : atraso ? (
                              <span className="text-[12px] font-semibold text-z-danger inline-flex items-center gap-0.5"><Icon name="event_busy" size={14} />{Math.abs(restante)} d de atraso</span>
                            ) : restante != null ? (
                              <span className="text-[12px] text-z-ink-3">Entrega en {restante} d</span>
                            ) : (
                              <span className="text-[12px] text-z-ink-3">{p._dias} d en etapa</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContent>

      {nueva && <NuevaCotizacion onClose={() => setNueva(false)} onCreada={() => { setNueva(false); cargar(); }} />}

      {seleccionado && (
        <DetalleModal
          proyecto={seleccionado}
          avanzando={avanzando}
          formTiempos={formTiempos}
          cargandoSugerencia={cargandoSugerencia}
          setFormTiempos={setFormTiempos}
          onClose={() => { setSeleccionado(null); setFormTiempos(null); }}
          onAvanzar={() => avanzarEstado(seleccionado)}
          onAbrirTiempos={() => abrirFormTiempos(seleccionado)}
          onConfirmarTiempos={() => confirmarTiempos(seleccionado)}
          onCancelar={() => cancelarProyecto(seleccionado)}
        />
      )}
    </Layout>
  );
}

function DetalleModal({ proyecto: p, avanzando, formTiempos, cargandoSugerencia, setFormTiempos, onClose, onAvanzar, onAbrirTiempos, onConfirmarTiempos, onCancelar }) {
  const paso = SIGUIENTE[p.estado];
  const esPasoTiempos = paso?.estado === 'en_fabricacion';
  const [pagoMonto, setPagoMonto] = useState(p.valor_final || p.valor_estimado || '');
  const [pagoConcepto, setPagoConcepto] = useState('Seña');
  const [generandoPago, setGenerandoPago] = useState(false);
  const [linkPago, setLinkPago] = useState(null);
  const [errorPago, setErrorPago] = useState(null);

  async function generarLinkPago() {
    setGenerandoPago(true);
    setErrorPago(null);
    try {
      const r = await fetch('https://xsciujuvkbubnhhnpcix.supabase.co/functions/v1/zebrano-pagos-mp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'crear_link_pago', proyecto_id: p.id, concepto: pagoConcepto, monto: Number(pagoMonto) }),
      });
      const d = await r.json();
      if (!d.ok) { setErrorPago(d.error || 'No se pudo generar el link de pago.'); return; }
      setLinkPago(d.init_point);
    } catch (e) {
      setErrorPago('Error de conexión al generar el link de pago.');
    } finally {
      setGenerandoPago(false);
    }
  }
  const timeline = [
    { label:'Cotizado',       fecha: p.fecha_cotizado },
    { label:'Aprobado',       fecha: p.fecha_aprobado },
    { label:'Seña pagada',    fecha: p.fecha_sena_pagada },
    { label:'En fabricación', fecha: p.fecha_inicio_fabricacion },
    { label:'Entregado',      fecha: p.fecha_entrega_real },
  ].filter(t => t.fecha);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]" onClick={onClose}>
      <div
        className="bg-z-surface border border-z-line rounded-xl p-7 w-[500px] max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-1.5">
          <div>
            <h2 className="text-lg font-semibold text-z-ink m-0">{p.clientes?.nombre || 'Sin nombre'}</h2>
            <div className="text-xs text-z-ink-3 capitalize mt-0.5">{p.tipo_trabajo || p.descripcion || '—'}</div>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-z-ink-3 hover:text-z-ink cursor-pointer text-lg leading-none transition-colors">✕</button>
        </div>
        <div className="my-2.5 mb-4"><EstadoBadge value={p.estado} /></div>

        <div className="grid grid-cols-2 gap-3 mb-[18px]">
          <div className="bg-z-surface border border-z-line rounded-lg px-[18px] py-[14px]">
            <div className="font-mono text-[11.5px] text-z-ink-3 mb-[5px]">Valor</div>
            <div className="font-mono text-2xl font-bold text-z-ink leading-none">{fmt(p.valor_final || p.valor_estimado)}</div>
          </div>
          <div className="bg-z-surface border border-z-line rounded-lg px-[18px] py-[14px]">
            <div className="font-mono text-[11.5px] text-z-ink-3 mb-[5px]">Entrega estimada</div>
            <div className="font-mono text-2xl font-bold text-z-ink leading-none">{fechaFmt(p.fecha_entrega_estimada)}</div>
          </div>
        </div>

        {(p.clientes?.telefono || p.clientes?.email) && (
          <div className="text-xs text-z-ink-2 mb-4 flex gap-3.5">
            {p.clientes?.telefono && <span>📞 {p.clientes.telefono}</span>}
            {p.clientes?.email && <span>✉️ {p.clientes.email}</span>}
          </div>
        )}

        {timeline.length > 0 && (
          <div className="mb-5">
            <div className="font-mono text-[11.5px] text-z-ink-3 mb-2.5">Línea de tiempo</div>
            <div className="flex flex-col gap-2">
              {timeline.map((t,i) => (
                <div key={i} className="flex justify-between text-[12.5px]">
                  <span className="text-z-ink-2">{t.label}</span>
                  <span className="text-z-ink-3">{fechaFmt(t.fecha)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {p.notas_internas && (
          <div className="mb-[18px]">
            <div className="font-mono text-[11.5px] text-z-ink-3 mb-1.5">Notas</div>
            <div className="text-[12.5px] text-z-ink-2 whitespace-pre-wrap">{p.notas_internas}</div>
          </div>
        )}

        <FichaCostos p={p} />

        {p.estado !== 'cancelado' && (
          <div className="bg-z-inset border border-z-line rounded-xl p-4 mb-[18px]">
            <div className="font-mono text-[11.5px] text-z-ink-3 mb-2.5">
              Cobro online (Mercado Pago)
            </div>
            {linkPago ? (
              <div className="flex flex-col gap-2">
                <div className="text-[11.5px] text-z-primary bg-z-primary/[0.14] px-2.5 py-1.5 rounded-lg">
                  Link generado. Copialo y mandaselo al cliente por WhatsApp.
                </div>
                <div className="flex gap-2">
                  <input readOnly value={linkPago} className="flex-1 px-3 py-2 rounded border border-z-line bg-z-surface text-z-ink text-[12px] font-mono outline-none" />
                  <button
                    onClick={() => navigator.clipboard.writeText(linkPago)}
                    className="bg-z-primary text-z-on-primary px-3.5 py-2 rounded font-mono text-[12px] hover:brightness-110 transition-all"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-2.5">
                  <Campo label="Concepto" value={pagoConcepto} onChange={e => setPagoConcepto(e.target.value)} />
                  <Campo label="Monto (ARS)" type="number" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} />
                </div>
                {errorPago && <div className="text-[11.5px] text-z-danger mb-2.5">{errorPago}</div>}
                <button
                  onClick={generarLinkPago}
                  disabled={generandoPago || !pagoMonto}
                  className="bg-transparent border border-z-line text-z-ink-2 px-3.5 py-1.5 rounded font-mono text-[12px] hover:border-z-primary hover:text-z-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {generandoPago ? 'Generando...' : 'Generar link de pago'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Formulario de tiempos: aparece solo al iniciar fabricación */}
        {esPasoTiempos && formTiempos && (
          <div className="bg-z-inset border border-z-line rounded-xl p-4 mb-[18px]">
            <div className="font-mono text-[11.5px] text-z-ink-3 mb-2.5">
              Tiempos estimados para producción
            </div>
            {formTiempos.sugerido && (
              <div className="text-[11.5px] text-z-primary mb-3 bg-z-primary/[0.14] px-2.5 py-1.5 rounded-lg">
                🤖 Sugerencia del agente, basada en {formTiempos.basadoEn} trabajos similares de "{p.tipo_trabajo}". Podés editarla.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-2.5">
              <Campo label="Horas fabricación" type="number" value={formTiempos.horasFabricacion}
                onChange={e => setFormTiempos(f => ({ ...f, horasFabricacion:e.target.value, sugerido:false }))} />
              <Campo label="Horas instalación (total)" type="number" value={formTiempos.horasInstalacion}
                onChange={e => setFormTiempos(f => ({ ...f, horasInstalacion:e.target.value, sugerido:false }))} />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-z-ink-2 mb-2.5">
              <input type="checkbox" checked={formTiempos.multiTramo} className="w-auto"
                onChange={e => setFormTiempos(f => ({ ...f, multiTramo:e.target.checked }))} />
              Instalación en varios tramos (ej. varios departamentos)
            </label>
            {formTiempos.multiTramo && (
              <div className="flex flex-col gap-2 mb-2">
                {formTiempos.tramos.map((t,i) => (
                  <div key={i} className="flex gap-2">
                    <input placeholder="Ej: Depto 3B" value={t.nombre}
                      className="flex-1 px-3 py-2 rounded border border-z-line bg-z-inset text-z-ink text-[13px] font-mono outline-none focus:border-z-primary transition-colors placeholder:text-z-ink-4"
                      onChange={e => setFormTiempos(f => { const tr=[...f.tramos]; tr[i]={...tr[i],nombre:e.target.value}; return {...f,tramos:tr}; })} />
                    <input placeholder="Horas" type="number"
                      className="w-[90px] px-3 py-2 rounded border border-z-line bg-z-inset text-z-ink text-[13px] font-mono outline-none focus:border-z-primary transition-colors placeholder:text-z-ink-4"
                      value={t.horas}
                      onChange={e => setFormTiempos(f => { const tr=[...f.tramos]; tr[i]={...tr[i],horas:e.target.value}; return {...f,tramos:tr}; })} />
                  </div>
                ))}
                <button
                  onClick={() => setFormTiempos(f => ({ ...f, tramos:[...f.tramos, { nombre:'', horas:'' }] }))}
                  className="self-start bg-transparent border border-z-line text-z-ink-2 px-3.5 py-1.5 rounded font-mono text-[12px] hover:border-z-primary hover:text-z-ink transition-colors"
                >
                  + Agregar tramo
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2.5 justify-end mt-2">
          {p.estado !== 'entregado' && (
            <button
              onClick={onCancelar}
              disabled={avanzando}
              className="bg-z-danger text-z-on-primary px-[18px] py-2 rounded text-[12.5px] font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Cancelar proyecto
            </button>
          )}
          {paso && esPasoTiempos && !formTiempos && (
            <button
              onClick={onAbrirTiempos}
              disabled={cargandoSugerencia}
              className="bg-z-primary text-z-on-primary px-[18px] py-2 rounded text-[12.5px] font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {cargandoSugerencia ? 'Buscando datos...' : paso.label}
            </button>
          )}
          {paso && esPasoTiempos && formTiempos && (
            <button
              onClick={onConfirmarTiempos}
              disabled={avanzando}
              className="bg-z-primary text-z-on-primary px-[18px] py-2 rounded text-[12.5px] font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {avanzando ? 'Guardando...' : 'Confirmar e iniciar fabricación'}
            </button>
          )}
          {paso && !esPasoTiempos && (
            <button
              onClick={onAvanzar}
              disabled={avanzando}
              className="bg-z-primary text-z-on-primary px-[18px] py-2 rounded text-[12.5px] font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {avanzando ? 'Guardando...' : paso.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Nueva cotización manual (o trabajo histórico) ─────────────────────────────
const TIPOS = [['cocina','Cocina'],['dormitorio','Dormitorio / placard'],['vestidor','Vestidor'],['living','Living'],['home_office','Home office'],['bano','Baño'],['custom','Otro']];
const RUBROS = [['material','Material (placas)'],['herraje','Herrajes'],['mano_obra','Mano de obra'],['flete','Flete'],['colocacion','Colocación'],['otro','Otro']];
const inputCls = 'w-full px-3 py-2 rounded border border-z-line bg-z-inset text-z-ink text-[13px] outline-none focus:border-z-primary transition-colors placeholder:text-z-ink-4';
const renglonVacio = () => ({ rubro:'material', descripcion:'', insumo_id:'', cantidad:'1', unidad:'placa', precio_unit:'' });

function NuevaCotizacion({ onClose, onCreada }) {
  const hoy = new Date().toISOString().slice(0,10);
  const [clientes, setClientes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [f, setF] = useState({ clienteId:'', clienteNombre:'', telefono:'', email:'', nombre:'', tipo:'cocina', monto:'', fecha:hoy, estado:'cotizado', historico:false, descripcion:'' });
  const [renglones, setRenglones] = useState([renglonVacio()]);
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => setClientes(data || []));
    supabase.from('insumos_resumen').select('insumo_id, nombre, unidad, precio_neto').order('nombre').then(({ data }) => setInsumos(data || []));
  }, []);

  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setR = (i, k, v) => setRenglones(rs => rs.map((r, j) => {
    if (j !== i) return r;
    const n = { ...r, [k]: v };
    if (k === 'insumo_id' && v) { const ins = insumos.find(x => x.insumo_id === v); if (ins) { n.descripcion = ins.nombre; n.unidad = ins.unidad || n.unidad; n.precio_unit = ins.precio_neto ?? n.precio_unit; } }
    return n;
  }));
  const costo = renglones.reduce((s, r) => s + Number(r.cantidad || 0) * Number(r.precio_unit || 0), 0);
  const margen = Number(f.monto) > 0 && costo > 0 ? Math.round((1 - costo / Number(f.monto)) * 100) : null;

  async function guardar() {
    if (!f.clienteId && !f.clienteNombre.trim()) { setError('Elegí o escribí el cliente.'); return; }
    if (!f.nombre.trim()) { setError('Poné un nombre al trabajo (ej: Cocina y lavadero).'); return; }
    if (!Number(f.monto)) { setError('Falta el monto sin IVA.'); return; }
    setGuardando(true); setError('');
    let path = null;
    if (archivo) {
      path = `presupuestos/${Date.now()}_${archivo.name.replace(/[^\w.-]/g, '_')}`;
      const { error: eu } = await supabase.storage.from('zebrano-proyectos').upload(path, archivo);
      if (eu) { setGuardando(false); setError('No se pudo subir el archivo: ' + eu.message); return; }
    }
    const { error: e } = await supabase.rpc('crear_cotizacion_manual', {
      p_cliente_id: f.clienteId || null, p_cliente_nombre: f.clienteNombre, p_telefono: f.telefono, p_email: f.email,
      p_nombre: f.nombre, p_descripcion: f.descripcion || null, p_tipo: f.tipo, p_monto: Number(f.monto), p_fecha: f.fecha,
      p_estado: f.estado, p_historico: f.historico, p_presupuesto_url: path,
      p_renglones: renglones.filter(r => r.descripcion.trim()).map(r => ({ ...r, cantidad: Number(r.cantidad || 0), precio_unit: Number(r.precio_unit || 0) })),
    });
    setGuardando(false);
    if (e) { setError(e.message); return; }
    onCreada();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]" onClick={onClose}>
      <div className="bg-z-surface border border-z-line rounded-xl p-7 w-[760px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-z-ink m-0">Nueva cotización</h2>
            <div className="text-xs text-z-ink-3 mt-0.5">Montos sin IVA. Si el trabajo ya se hizo, elegí el estado y marcá "histórico".</div>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-z-ink-3 hover:text-z-ink cursor-pointer text-lg leading-none">✕</button>
        </div>

        <div className="font-mono text-[11.5px] text-z-ink-3 mb-1.5">Cliente</div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <select className={inputCls} value={f.clienteId} onChange={e => set('clienteId', e.target.value)}>
            <option value="">+ Cliente nuevo</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {!f.clienteId && <input className={inputCls} placeholder="Nombre del cliente" value={f.clienteNombre} onChange={e => set('clienteNombre', e.target.value)} />}
          {!f.clienteId && <input className={inputCls} placeholder="Teléfono" value={f.telefono} onChange={e => set('telefono', e.target.value)} />}
          {!f.clienteId && <input className={inputCls} placeholder="Email" value={f.email} onChange={e => set('email', e.target.value)} />}
        </div>

        <div className="font-mono text-[11.5px] text-z-ink-3 mb-1.5">Trabajo</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input className={inputCls} placeholder="Nombre (ej: Cocina y lavadero)" value={f.nombre} onChange={e => set('nombre', e.target.value)} />
          <select className={inputCls} value={f.tipo} onChange={e => set('tipo', e.target.value)}>{TIPOS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input className={inputCls} type="number" placeholder="Monto cotizado sin IVA" value={f.monto} onChange={e => set('monto', e.target.value)} />
          <input className={inputCls} type="date" value={f.fecha} onChange={e => set('fecha', e.target.value)} />
          <select className={inputCls} value={f.estado} onChange={e => set('estado', e.target.value)}>
            {[['cotizado','Cotizado (esperando respuesta)'],['aprobado','Aprobado por el cliente'],['en_fabricacion','En fabricación'],['entregado','Entregado'],['cancelado','No se hizo']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[12.5px] text-z-ink-2"><input type="checkbox" className="w-auto" checked={f.historico} onChange={e => set('historico', e.target.checked)} />Trabajo histórico (cargado después)</label>
        </div>
        <textarea className={inputCls + ' mb-3'} rows={2} placeholder="Descripción / notas (opcional)" value={f.descripcion} onChange={e => set('descripcion', e.target.value)} />
        <label className="block text-[12.5px] text-z-ink-2 mb-4">Presupuesto (PDF, Excel o foto): <input type="file" className="ml-2 text-[12px]" onChange={e => setArchivo(e.target.files?.[0] || null)} /></label>

        <div className="flex items-center justify-between mb-1.5">
          <div className="font-mono text-[11.5px] text-z-ink-3">Renglones de costo (opcional: sirven para saber qué comprar y comparar con lo real)</div>
          <div className="text-[12px] text-z-ink-2">Costo {fmt(costo)}{margen != null ? ` · margen ${margen}%` : ''}</div>
        </div>
        <div className="flex flex-col gap-2 mb-2">
          {renglones.map((r, i) => (
            <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns:'130px 1fr 70px 70px 100px 24px' }}>
              <select className={inputCls} value={r.rubro} onChange={e => setR(i, 'rubro', e.target.value)}>{RUBROS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
              {(r.rubro === 'material' || r.rubro === 'herraje') && insumos.length > 0 ? (
                <select className={inputCls} value={r.insumo_id} onChange={e => setR(i, 'insumo_id', e.target.value)}>
                  <option value="">{r.descripcion || 'Elegir material…'}</option>
                  {insumos.map(x => <option key={x.insumo_id} value={x.insumo_id}>{x.nombre}</option>)}
                </select>
              ) : (
                <input className={inputCls} placeholder="Descripción" value={r.descripcion} onChange={e => setR(i, 'descripcion', e.target.value)} />
              )}
              <input className={inputCls} type="number" placeholder="Cant." value={r.cantidad} onChange={e => setR(i, 'cantidad', e.target.value)} />
              <input className={inputCls} placeholder="Unidad" value={r.unidad} onChange={e => setR(i, 'unidad', e.target.value)} />
              <input className={inputCls} type="number" placeholder="$ unit." value={r.precio_unit} onChange={e => setR(i, 'precio_unit', e.target.value)} />
              <button onClick={() => setRenglones(rs => rs.filter((_, j) => j !== i))} className="bg-transparent border-none text-z-ink-3 hover:text-z-danger cursor-pointer">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => setRenglones(rs => [...rs, renglonVacio()])} className="bg-transparent border border-z-line text-z-ink-2 px-3.5 py-1.5 rounded text-[12px] hover:border-z-primary hover:text-z-ink mb-4">+ Agregar renglón</button>

        {error && <div className="text-[12px] text-z-danger mb-3">{error}</div>}
        <div className="flex gap-2.5 justify-end">
          <button onClick={onClose} className="bg-transparent border border-z-line text-z-ink-2 px-[18px] py-2 rounded text-[12.5px]">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="bg-z-primary text-z-on-primary px-[18px] py-2 rounded text-[12.5px] font-medium hover:brightness-110 disabled:opacity-40">{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Ficha de costos: cotizado vs real, cobros y materiales ─────────────────────
function FichaCostos({ p }) {
  const [c, setC] = useState(null);
  const [mats, setMats] = useState([]);
  const [cobro, setCobro] = useState({ concepto:'Seña', monto:'' });
  const [gasto, setGasto] = useState({ categoria:'flete', descripcion:'', monto:'' });
  const [msg, setMsg] = useState('');
  const cargar = useCallback(() => {
    supabase.from('proyecto_costos').select('*').eq('proyecto_id', p.id).maybeSingle().then(({ data }) => setC(data));
    supabase.from('proyecto_materiales').select('*').eq('proyecto_id', p.id).then(({ data }) => setMats(data || []));
  }, [p.id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function verPresupuesto() {
    const { data, error } = await supabase.storage.from('zebrano-proyectos').createSignedUrl(p.presupuesto_url, 300);
    if (error) { setMsg('No se pudo abrir el archivo: ' + error.message); return; }
    window.open(data.signedUrl, '_blank');
  }
  async function registrarCobro() {
    if (!Number(cobro.monto)) return;
    const { error } = await supabase.from('pagos').insert({ proyecto_id: p.id, cliente_id: p.cliente_id, concepto: cobro.concepto, monto: Number(cobro.monto), estado:'recibido', fecha_recibido: new Date().toISOString().slice(0,10) });
    if (error) { setMsg('No se pudo registrar el cobro: ' + error.message); return; }
    setCobro({ concepto:'Saldo', monto:'' }); setMsg('Cobro registrado.'); cargar();
  }
  async function registrarGasto() {
    if (!Number(gasto.monto) || !gasto.descripcion.trim()) { setMsg('Completá descripción y monto del gasto.'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const [{ data: emp }, { data: ot }] = await Promise.all([
      supabase.from('empleados').select('id').eq('auth_user_id', user.id).maybeSingle(),
      supabase.from('ordenes_trabajo').select('id').eq('proyecto_id', p.id).order('created_at').limit(1).maybeSingle(),
    ]);
    if (!ot) { setMsg('Primero aprobá el proyecto: los gastos se cargan a su orden de trabajo.'); return; }
    const { error } = await supabase.from('caja_chica').insert({ ot_id: ot.id, categoria: gasto.categoria, descripcion: gasto.descripcion, monto: Number(gasto.monto), creado_por: emp?.id || null, estado:'pendiente' });
    if (error) { setMsg('No se pudo registrar el gasto: ' + error.message); return; }
    setGasto({ categoria:'flete', descripcion:'', monto:'' }); setMsg('Gasto cargado a la obra.'); cargar();
  }
  if (!c) return null;
  const n = v => Number(v || 0);
  const filas = [
    ['Materiales y herrajes', n(c.cot_material) + n(c.cot_herrajes), n(c.material_real)],
    ['Mano de obra', n(c.cot_mano_obra), n(c.mo_real)],
    ['Flete, colocación y otros', n(c.cot_otros), n(c.otros_gastos_real)],
    ['Estructura (gastos fijos)', null, n(c.estructura_real)],
  ];
  return (
    <div className="bg-z-inset border border-z-line rounded-xl p-4 mb-[18px]">
      <div className="flex justify-between items-center mb-2.5">
        <div className="font-mono text-[11.5px] text-z-ink-3">Rentabilidad (sin IVA)</div>
        {p.presupuesto_url && <button onClick={verPresupuesto} className="bg-transparent border-none text-z-primary text-[12px] cursor-pointer">Ver presupuesto</button>}
      </div>
      <table className="w-full text-[12.5px] mb-2">
        <thead><tr className="text-z-ink-3"><th className="text-left font-normal">Rubro</th><th className="text-right font-normal">Cotizado</th><th className="text-right font-normal">Real</th></tr></thead>
        <tbody>
          {filas.map(([l, cot, real]) => <tr key={l}><td className="text-z-ink-2">{l}</td><td className="text-right">{cot != null && cot > 0 ? fmt(cot) : '—'}</td><td className="text-right">{fmt(real)}</td></tr>)}
          <tr className="font-semibold text-z-ink"><td>Costo total</td><td className="text-right">{n(c.cot_total) > 0 ? fmt(c.cot_total) : '—'}</td><td className="text-right">{fmt(c.costo_real)}</td></tr>
          <tr className="font-semibold" style={{ color: n(c.margen) < 0 ? 'rgb(var(--z-danger-c))' : 'rgb(var(--z-success-c))' }}><td>Margen</td><td></td><td className="text-right">{fmt(c.margen)}{c.margen_pct != null ? ` · ${c.margen_pct}%` : ''}</td></tr>
        </tbody>
      </table>
      <div className="text-[11.5px] text-z-ink-3 mb-3">{n(c.horas_reales)} h cargadas · {c.facturas} factura(s) imputada(s)</div>

      {mats.length > 0 && (
        <div className="mb-3">
          <div className="font-mono text-[11.5px] text-z-ink-3 mb-1.5">Materiales: necesario vs comprado para esta obra</div>
          {mats.map((m, i) => { const falta = n(m.necesario) - n(m.imputado); return (
            <div key={i} className="flex justify-between text-[12.5px]"><span className="text-z-ink-2">{m.material}</span><span className={falta > 0 ? 'text-z-warning' : 'text-z-ink-3'}>{n(m.imputado)} / {n(m.necesario)} {m.unidad || ''}{falta > 0 ? ` · faltan ${falta}` : ' ✓'}</span></div>
          ); })}
        </div>
      )}

      <div className="flex justify-between text-[12.5px] mb-2"><span className="text-z-ink-2">Cobrado {fmt(c.cobrado)}</span><span className="font-semibold text-z-ink">Saldo {fmt(c.saldo_pendiente)}</span></div>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Concepto" value={cobro.concepto} onChange={e => setCobro(x => ({ ...x, concepto:e.target.value }))} />
        <input className={inputCls} type="number" placeholder="Monto cobrado" value={cobro.monto} onChange={e => setCobro(x => ({ ...x, monto:e.target.value }))} />
        <button onClick={registrarCobro} className="bg-transparent border border-z-line text-z-ink-2 px-3 rounded text-[12px] whitespace-nowrap hover:border-z-primary hover:text-z-ink">Registrar cobro</button>
      </div>
      <div className="font-mono text-[11.5px] text-z-ink-3 mt-3 mb-1.5">Gasto de la obra (flete, herrajes en efectivo, colocación…)</div>
      <div className="flex gap-2">
        <select className={inputCls} style={{ maxWidth:130 }} value={gasto.categoria} onChange={e => setGasto(x => ({ ...x, categoria:e.target.value }))}>
          {[['flete','Flete'],['herrajes','Herrajes'],['colocacion','Colocación'],['viaticos','Viáticos'],['otro','Otro']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className={inputCls} placeholder="Descripción" value={gasto.descripcion} onChange={e => setGasto(x => ({ ...x, descripcion:e.target.value }))} />
        <input className={inputCls} style={{ maxWidth:120 }} type="number" placeholder="Monto" value={gasto.monto} onChange={e => setGasto(x => ({ ...x, monto:e.target.value }))} />
        <button onClick={registrarGasto} className="bg-transparent border border-z-line text-z-ink-2 px-3 rounded text-[12px] whitespace-nowrap hover:border-z-primary hover:text-z-ink">Cargar gasto</button>
      </div>
      {msg && <div className="text-[11.5px] text-z-ink-3 mt-2">{msg}</div>}
    </div>
  );
}
