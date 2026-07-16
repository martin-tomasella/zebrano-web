
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent } from '../components/Layout';
import { Card, KpiCard, Btn, Badge, Input } from '../components/ui';

const COLUMNAS = [
  { id:'cotizado',       label:'Cotizado',        color:'#B07B30' },
  { id:'sena_pagada',    label:'Seña pagada',     color:'#C99A55' },
  { id:'en_fabricacion', label:'En fabricación',  color:'#7AAE5A' },
  { id:'entregado',      label:'Entregado',       color:'#4A6B36' },
];
const ESTADO_LABEL = { prospecto:'Prospecto', cotizado:'Cotizado', sena_pagada:'Seña pagada', en_fabricacion:'En fabricación', entregado:'Entregado', cancelado:'Cancelado' };

// Mapa de avance: desde qué estado se puede pasar a cuál, y qué fecha real se sella.
const SIGUIENTE = {
  cotizado:       { estado:'sena_pagada',    label:'Marcar seña pagada',   campoFecha:'fecha_sena_pagada' },
  sena_pagada:    { estado:'en_fabricacion', label:'Iniciar fabricación',  campoFecha:'fecha_inicio_fabricacion' },
  en_fabricacion: { estado:'entregado',      label:'Marcar entregado',     campoFecha:'fecha_entrega_real' },
};

// ─── Río + carriles: constantes de la nueva visualización ─────────────────────
// Paleta teal/cyan específica de esta vista (no se agrega a los tokens --z-* globales:
// el resto de la app se mantiene en la identidad verde/cobre ya shippeada).
const RIO_DESDE = '#2DD4BF';
const RIO_HASTA = '#22D3EE';

// Mismo umbral que Dashboard.jsx usa para "proyecto estancado en Cotizado".
const DIAS_ESTANCADO = 7;

const STAGE_ORDER_IDX = { cotizado:0, sena_pagada:1, en_fabricacion:2, entregado:3 };
const STAGE_PCT = { cotizado:15, sena_pagada:40, en_fabricacion:70, entregado:100 };

function fechaEntradaEtapa(p) {
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

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('activos');
  const [seleccionado, setSeleccionado] = useState(null);
  const [avanzando, setAvanzando] = useState(false);
  const [formTiempos, setFormTiempos] = useState(null);
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false);

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

  // Carriles del río: solo proyectos en alguna de las 4 etapas del funnel,
  // ordenados por etapa y, dentro de cada etapa, por más tiempo estancado primero.
  const carriles = listado
    .filter(p => STAGE_ORDER_IDX[p.estado] !== undefined)
    .map(p => ({ ...p, _dias: diasEnEtapa(p), _estancado: esEstancado(p) }))
    .sort((a, b) => {
      const ia = STAGE_ORDER_IDX[a.estado] ?? 99;
      const ib = STAGE_ORDER_IDX[b.estado] ?? 99;
      if (ia !== ib) return ia - ib;
      return b._dias - a._dias;
    });

  const valorPipeline = activos.filter(p => p.estado !== 'entregado').reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0);
  const mesActual = new Date().toISOString().slice(0,7);
  const entregadosMes = proyectos.filter(p => p.estado === 'entregado' && p.fecha_entrega_real?.slice(0,7) === mesActual).length;

  // Paso simple: cotizado -> sena_pagada, y en_fabricacion -> entregado. No piden datos extra.
  async function avanzarEstado(proyecto) {
    const paso = SIGUIENTE[proyecto.estado];
    if (!paso) return;
    setAvanzando(true);
    const { error } = await supabase.from('proyectos').update({
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
        proyecto_id: proyecto.id, tipo_trabajo: proyecto.tipo_trabajo, numero_ot, estado:'en_progreso',
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

    const { error: eProy } = await supabase.from('proyectos').update({
      estado: 'en_fabricacion',
      fecha_inicio_fabricacion: new Date().toISOString().slice(0,10),
    }).eq('id', proyecto.id);
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
        subtitle={`${activos.length} activos · ${fmt(valorPipeline)} en pipeline · ${entregadosMes} entregados este mes`}
        actions={
          <div style={{ display:'flex', gap:2, background:'rgba(74,107,54,0.08)', borderRadius:8, padding:3 }}>
            {[['activos','Activos'],['cancelados',`Cancelados (${cancelados.length})`]].map(([v,l]) => (
              <button key={v} onClick={() => setFiltro(v)} style={{ padding:'5px 12px', fontSize:11, background: filtro===v ? 'rgba(74,107,54,0.2)' : 'transparent', color: filtro===v ? 'var(--z-text)' : 'var(--z-text-3)', border:'none', borderRadius:6, cursor:'pointer' }}>{l}</button>
            ))}
          </div>
        }
      />
      <PageContent pad={filtro === 'activos' ? '16px 24px' : 24}>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
        ) : listado.length === 0 ? (
          <div style={{ textAlign:'center', padding:64, border:'1px dashed var(--z-border)', borderRadius:'var(--z-radius-xl)', color:'var(--z-text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <p>{filtro === 'cancelados' ? 'Sin proyectos cancelados' : 'Sin proyectos activos todavía'}</p>
          </div>
        ) : filtro === 'cancelados' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {listado.map(p => (
              <Card key={p.id} style={{ cursor:'pointer', opacity:0.75 }}>
                <div onClick={() => seleccionar(p)} style={{ display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight:500, color:'var(--z-text)' }}>{p.clientes?.nombre || 'Sin nombre'}</div>
                    <div style={{ fontSize:12, color:'var(--z-text-3)', textTransform:'capitalize' }}>{p.tipo_trabajo || p.descripcion || '—'}</div>
                  </div>
                  <Badge value="cancelado" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div>
            {/* ── Río: vista general de las 4 etapas del funnel ─────────────────── */}
            <div style={{ marginBottom:22 }}>
              <div style={{
                height:8, borderRadius:99, overflow:'hidden',
                background:'rgba(45,212,191,0.12)', border:'1px solid rgba(45,212,191,0.18)',
              }}>
                <div style={{
                  height:'100%', width:'100%', opacity:0.85,
                  background:`linear-gradient(90deg, ${RIO_DESDE} 0%, ${RIO_HASTA} 100%)`,
                }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                {COLUMNAS.map((col, i) => (
                  <span key={col.id} style={{
                    fontSize:10, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.06em',
                    flex:1, textAlign: i === 0 ? 'left' : i === COLUMNAS.length - 1 ? 'right' : 'center',
                  }}>
                    {col.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Carriles: un renglón por proyecto activo ──────────────────────── */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {carriles.map(p => {
                const pct = calcPct(p);
                const ot = Array.isArray(p.ordenes_trabajo) ? p.ordenes_trabajo[0] : p.ordenes_trabajo;
                return (
                  <div key={p.id} onClick={() => seleccionar(p)}
                    style={{
                      background:'var(--z-card)',
                      border: `1px solid ${p._estancado ? 'rgba(176,123,48,0.35)' : 'var(--z-border)'}`,
                      borderRadius:10, padding:'12px 16px', cursor:'pointer', transition:'var(--z-transition)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = p._estancado ? 'var(--z-warning)' : 'var(--z-border-hover)'; e.currentTarget.style.boxShadow = 'var(--z-shadow-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = p._estancado ? 'rgba(176,123,48,0.35)' : 'var(--z-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:'var(--z-text)' }}>{p.clientes?.nombre || 'Sin nombre'}</span>
                      {ot?.numero_ot && (
                        <span style={{ fontSize:10.5, fontFamily:'monospace', color:'var(--z-text-3)' }}>{ot.numero_ot}</span>
                      )}
                      <Badge value={p.estado} />
                      {p._estancado && (
                        <span style={{ fontSize:10, color:'var(--z-warning)', display:'inline-flex', alignItems:'center', gap:3 }}>
                          🚩 {p._dias}d estancado
                        </span>
                      )}
                      <span style={{ marginLeft:'auto', fontSize:12.5, color:'var(--z-success)', fontWeight:500 }}>
                        {fmt(p.valor_final || p.valor_estimado)}
                      </span>
                    </div>
                    <div style={{ height:5, borderRadius:99, background:'var(--z-bg-2)', overflow:'hidden' }}>
                      <div style={{
                        height:'100%', width:`${pct}%`, borderRadius:99, transition:'width 0.3s',
                        background: p._estancado ? 'var(--z-warning)' : `linear-gradient(90deg, ${RIO_DESDE}, ${RIO_HASTA})`,
                      }} />
                    </div>
                  </div>
                );
              })}
              {carriles.length === 0 && (
                <div style={{ fontSize:12, color:'var(--z-text-muted)', textAlign:'center', padding:24 }}>Sin proyectos en el funnel</div>
              )}
            </div>
          </div>
        )}
      </PageContent>

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
  const timeline = [
    { label:'Cotizado',       fecha: p.fecha_cotizado },
    { label:'Seña pagada',    fecha: p.fecha_sena_pagada },
    { label:'En fabricación', fecha: p.fecha_inicio_fabricacion },
    { label:'Entregado',      fecha: p.fecha_entrega_real },
  ].filter(t => t.fecha);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }} onClick={onClose}>
      <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-xl)', padding:28, width:500, maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
          <div>
            <h2 style={{ margin:0, fontSize:18 }}>{p.clientes?.nombre || 'Sin nombre'}</h2>
            <div style={{ fontSize:12, color:'var(--z-text-3)', textTransform:'capitalize', marginTop:2 }}>{p.tipo_trabajo || p.descripcion || '—'}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--z-text-3)', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>
        <div style={{ margin:'10px 0 16px' }}><Badge value={p.estado} /></div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
          <KpiCard label="Valor" value={fmt(p.valor_final || p.valor_estimado)} />
          <KpiCard label="Entrega estimada" value={fechaFmt(p.fecha_entrega_estimada)} />
        </div>

        {(p.clientes?.telefono || p.clientes?.email) && (
          <div style={{ fontSize:12, color:'var(--z-text-2)', marginBottom:16, display:'flex', gap:14 }}>
            {p.clientes?.telefono && <span>📞 {p.clientes.telefono}</span>}
            {p.clientes?.email && <span>✉️ {p.clientes.email}</span>}
          </div>
        )}

        {timeline.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:9, fontWeight:400, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:10 }}>Línea de tiempo</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {timeline.map((t,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5 }}>
                  <span style={{ color:'var(--z-text-2)' }}>{t.label}</span>
                  <span style={{ color:'var(--z-text-3)' }}>{fechaFmt(t.fecha)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {p.notas_internas && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:9, fontWeight:400, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:6 }}>Notas</div>
            <div style={{ fontSize:12.5, color:'var(--z-text-2)', whiteSpace:'pre-wrap' }}>{p.notas_internas}</div>
          </div>
        )}

        {/* Formulario de tiempos: aparece solo al iniciar fabricación */}
        {esPasoTiempos && formTiempos && (
          <div style={{ background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:12, padding:16, marginBottom:18 }}>
            <div style={{ fontSize:9, fontWeight:400, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:10 }}>
              Tiempos estimados para producción
            </div>
            {formTiempos.sugerido && (
              <div style={{ fontSize:11.5, color:'var(--z-primary-light)', marginBottom:12, background:'var(--z-primary-glow)', padding:'6px 10px', borderRadius:8 }}>
                🤖 Sugerencia del agente, basada en {formTiempos.basadoEn} trabajos similares de "{p.tipo_trabajo}". Podés editarla.
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:10 }}>
              <Input label="Horas fabricación" type="number" value={formTiempos.horasFabricacion}
                onChange={e => setFormTiempos(f => ({ ...f, horasFabricacion:e.target.value, sugerido:false }))} />
              <Input label="Horas instalación (total)" type="number" value={formTiempos.horasInstalacion}
                onChange={e => setFormTiempos(f => ({ ...f, horasInstalacion:e.target.value, sugerido:false }))} />
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--z-text-2)', marginBottom:10 }}>
              <input type="checkbox" checked={formTiempos.multiTramo} style={{ width:'auto' }}
                onChange={e => setFormTiempos(f => ({ ...f, multiTramo:e.target.checked }))} />
              Instalación en varios tramos (ej. varios departamentos)
            </label>
            {formTiempos.multiTramo && (
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                {formTiempos.tramos.map((t,i) => (
                  <div key={i} style={{ display:'flex', gap:8 }}>
                    <input placeholder="Ej: Depto 3B" value={t.nombre}
                      onChange={e => setFormTiempos(f => { const tr=[...f.tramos]; tr[i]={...tr[i],nombre:e.target.value}; return {...f,tramos:tr}; })} />
                    <input placeholder="Horas" type="number" style={{ width:90 }} value={t.horas}
                      onChange={e => setFormTiempos(f => { const tr=[...f.tramos]; tr[i]={...tr[i],horas:e.target.value}; return {...f,tramos:tr}; })} />
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => setFormTiempos(f => ({ ...f, tramos:[...f.tramos, { nombre:'', horas:'' }] }))}>+ Agregar tramo</button>
              </div>
            )}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          {p.estado !== 'entregado' && <Btn variant="danger" onClick={onCancelar} disabled={avanzando}>Cancelar proyecto</Btn>}
          {paso && esPasoTiempos && !formTiempos && (
            <Btn onClick={onAbrirTiempos} disabled={cargandoSugerencia}>{cargandoSugerencia ? 'Buscando datos...' : paso.label}</Btn>
          )}
          {paso && esPasoTiempos && formTiempos && (
            <Btn onClick={onConfirmarTiempos} disabled={avanzando}>{avanzando ? 'Guardando...' : 'Confirmar e iniciar fabricación'}</Btn>
          )}
          {paso && !esPasoTiempos && (
            <Btn onClick={onAvanzar} disabled={avanzando}>{avanzando ? 'Guardando...' : paso.label}</Btn>
          )}
        </div>
      </div>
    </div>
  );
}
