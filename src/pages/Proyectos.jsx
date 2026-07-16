
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent } from '../components/Layout';
import { Card, KpiCard, Btn, Badge } from '../components/ui';

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

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre, telefono, email)')
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

  async function cancelarProyecto(proyecto) {
    if (!window.confirm(`¿Cancelar el proyecto de ${proyecto.clientes?.nombre || 'este cliente'}?`)) return;
    setAvanzando(true);
    const { error } = await supabase.from('proyectos').update({ estado:'cancelado' }).eq('id', proyecto.id);
    setAvanzando(false);
    if (error) { alert('No se pudo cancelar: ' + error.message); return; }
    await cargar();
    setSeleccionado(null);
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
                <div onClick={() => setSeleccionado(p)} style={{ display:'flex', justifyContent:'space-between' }}>
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
          <div style={{ display:'flex', gap:14, overflowX:'auto', paddingBottom:8 }}>
            {COLUMNAS.map(col => (
              <div key={col.id} style={{ minWidth:250, flex:'0 0 250px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, padding:'6px 10px', background:'var(--z-card)', borderRadius:8, border:'1px solid var(--z-border)' }}>
                  <span style={{ fontSize:11, color:col.color, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>{col.label}</span>
                  <span style={{ fontSize:11, color:'var(--z-text-3)', background:'rgba(74,107,54,0.1)', padding:'2px 8px', borderRadius:10 }}>{porEstado(col.id).length}</span>
                </div>
                {porEstado(col.id).map(p => {
                  const dias = diasPara(p.fecha_entrega_estimada);
                  return (
                    <div key={p.id} onClick={() => setSeleccionado(p)}
                      style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderLeft:`3px solid ${col.color}`, borderRadius:10, padding:'12px 14px', marginBottom:8, cursor:'pointer', transition:'var(--z-transition)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = col.color+'66'; e.currentTarget.style.boxShadow = `0 4px 16px ${col.color}22`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--z-border)'; e.currentTarget.style.boxShadow = 'none'; }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--z-text)', marginBottom:4 }}>{p.clientes?.nombre || 'Sin nombre'}</div>
                      {(p.tipo_trabajo || p.descripcion) && <div style={{ fontSize:11, color:'var(--z-text-3)', textTransform:'capitalize', marginBottom:4 }}>{p.tipo_trabajo || p.descripcion}</div>}
                      <div style={{ fontSize:12, color:'var(--z-success)' }}>{fmt(p.valor_final || p.valor_estimado)}</div>
                      {dias !== null && col.id !== 'entregado' && (
                        <div style={{ fontSize:10, color: dias < 0 ? 'var(--z-error)' : dias <= 5 ? 'var(--z-warning)' : 'var(--z-text-muted)', marginTop:6 }}>
                          {dias < 0 ? `${Math.abs(dias)} días de retraso` : dias === 0 ? 'Entrega hoy' : `${dias} días para entrega`}
                        </div>
                      )}
                    </div>
                  );
                })}
                {porEstado(col.id).length === 0 && <div style={{ fontSize:11, color:'var(--z-text-muted)', textAlign:'center', padding:16 }}>Sin proyectos</div>}
              </div>
            ))}
          </div>
        )}
      </PageContent>

      {seleccionado && (
        <DetalleModal
          proyecto={seleccionado}
          avanzando={avanzando}
          onClose={() => setSeleccionado(null)}
          onAvanzar={() => avanzarEstado(seleccionado)}
          onCancelar={() => cancelarProyecto(seleccionado)}
        />
      )}
    </Layout>
  );
}

function DetalleModal({ proyecto: p, avanzando, onClose, onAvanzar, onCancelar }) {
  const paso = SIGUIENTE[p.estado];
  const timeline = [
    { label:'Cotizado',       fecha: p.fecha_cotizado },
    { label:'Seña pagada',    fecha: p.fecha_sena_pagada },
    { label:'En fabricación', fecha: p.fecha_inicio_fabricacion },
    { label:'Entregado',      fecha: p.fecha_entrega_real },
  ].filter(t => t.fecha);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }} onClick={onClose}>
      <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-xl)', padding:28, width:480, maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
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

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          {p.estado !== 'entregado' && <Btn variant="danger" onClick={onCancelar} disabled={avanzando}>Cancelar proyecto</Btn>}
          {paso && <Btn onClick={onAvanzar} disabled={avanzando}>{avanzando ? 'Guardando...' : paso.label}</Btn>}
        </div>
      </div>
    </div>
  );
}
