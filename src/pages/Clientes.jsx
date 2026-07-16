
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent } from '../components/Layout';
import { KpiCard, Badge } from '../components/ui';

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—';
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionadoId, setSeleccionadoId] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: c, error: ec }, { data: p, error: ep }] = await Promise.all([
        supabase.from('clientes').select('*').order('created_at', { ascending:false }),
        supabase.from('proyectos').select('*').order('fecha_creacion', { ascending:false }),
      ]);
      if (ec) console.error('Error cargando clientes:', ec);
      if (ep) console.error('Error cargando proyectos:', ep);
      setClientes(c || []);
      setProyectos(p || []);
      setLoading(false);
    };
    load();
  }, []);

  // Agrupa proyectos por cliente_id para no repetir el join en cada render.
  const proyectosPorCliente = useMemo(() => {
    const map = {};
    for (const p of proyectos) {
      if (!p.cliente_id) continue;
      (map[p.cliente_id] ||= []).push(p);
    }
    return map;
  }, [proyectos]);

  const filtrados = clientes.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (c.nombre||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.telefono||'').includes(q);
  });

  const facturadoTotal = proyectos.filter(p => p.estado !== 'cancelado').reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0);
  const cantidadTrabajos = proyectos.filter(p => p.estado !== 'cancelado').length;
  const ticketPromedio = cantidadTrabajos > 0 ? facturadoTotal / cantidadTrabajos : 0;

  const seleccionado = clientes.find(c => c.id === seleccionadoId);
  const trabajosSeleccionado = (proyectosPorCliente[seleccionadoId] || []);

  function ultimoTrabajo(clienteId) {
    const trabajos = proyectosPorCliente[clienteId];
    if (!trabajos || trabajos.length === 0) return null;
    return trabajos[0];
  }

  return (
    <Layout>
      <Topbar title="Clientes" subtitle={`${clientes.length} registrados`} />
      <PageContent>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--z-text-muted)' }}>Cargando...</div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, marginBottom:20 }}>
              <KpiCard label="Facturado histórico" value={fmt(facturadoTotal)} accent />
              <KpiCard label="Cantidad de trabajos" value={cantidadTrabajos} />
              <KpiCard label="Ticket promedio" value={fmt(ticketPromedio)} />
            </div>

            <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
              {/* Panel izquierdo: lista */}
              <div style={{ width:300, flexShrink:0, background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', overflow:'hidden' }}>
                <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--z-border)' }}>
                  <input placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    style={{ width:'100%', padding:'7px 12px', fontSize:12.5, background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:8, color:'var(--z-text)', outline:'none' }} />
                </div>
                <div style={{ maxHeight:520, overflowY:'auto' }}>
                  {filtrados.length === 0 ? (
                    <div style={{ padding:20, fontSize:12.5, color:'var(--z-text-muted)', textAlign:'center' }}>Sin resultados</div>
                  ) : filtrados.map(c => {
                    const ult = ultimoTrabajo(c.id);
                    const activo = seleccionadoId === c.id;
                    return (
                      <div key={c.id} onClick={() => setSeleccionadoId(c.id)} style={{
                        padding:'11px 14px', cursor:'pointer', borderLeft: activo ? '3px solid var(--z-primary)' : '3px solid transparent',
                        background: activo ? 'var(--z-primary-glow)' : 'transparent', borderBottom:'1px solid rgba(74,107,54,0.07)',
                      }}
                      onMouseEnter={e => { if (!activo) e.currentTarget.style.background = 'var(--z-card-hover)'; }}
                      onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent'; }}>
                        <div style={{ fontSize:13, fontWeight:500, color: activo ? 'var(--z-primary-light)' : 'var(--z-text)' }}>{c.nombre || 'Sin nombre'}</div>
                        <div style={{ fontSize:11, color:'var(--z-text-muted)', marginTop:2 }}>
                          {ult ? `${ult.tipo_trabajo || ult.descripcion || 'Trabajo'} · ${fechaFmt(ult.fecha_creacion)}` : 'Sin trabajos aún'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Panel derecho: detalle */}
              <div style={{ flex:1, background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--z-radius-lg)', padding:24, minHeight:400 }}>
                {!seleccionado ? (
                  <div style={{ textAlign:'center', padding:64, color:'var(--z-text-muted)' }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>👤</div>
                    <p>Elegí un cliente para ver su historial</p>
                  </div>
                ) : (
                  <>
                    <h2 style={{ margin:'0 0 4px', fontSize:19 }}>{seleccionado.nombre}</h2>
                    <div style={{ display:'flex', gap:16, fontSize:12.5, color:'var(--z-text-2)', marginBottom:20 }}>
                      {seleccionado.telefono && <span>📞 {seleccionado.telefono}</span>}
                      {seleccionado.email && <span>✉️ {seleccionado.email}</span>}
                      {seleccionado.direccion_obra && <span>📍 {seleccionado.direccion_obra}</span>}
                    </div>

                    <div style={{ fontSize:9, fontWeight:400, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:10 }}>
                      Historial de trabajos ({trabajosSeleccionado.length})
                    </div>
                    {trabajosSeleccionado.length === 0 ? (
                      <div style={{ fontSize:12.5, color:'var(--z-text-muted)' }}>Todavía no tiene trabajos registrados.</div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:360, overflowY:'auto' }}>
                        {trabajosSeleccionado.map(p => (
                          <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--z-bg-2)', borderRadius:10, border:'1px solid var(--z-border)' }}>
                            <div>
                              <div style={{ fontSize:13, color:'var(--z-text)', textTransform:'capitalize' }}>{p.tipo_trabajo || p.descripcion || 'Trabajo'}</div>
                              <div style={{ fontSize:11, color:'var(--z-text-muted)', marginTop:2 }}>{fechaFmt(p.fecha_creacion)}</div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <span style={{ fontSize:12.5, color:'var(--z-success)' }}>{fmt(p.valor_final || p.valor_estimado)}</span>
                              <Badge value={p.estado} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {seleccionado.notas && (
                      <div style={{ marginTop:20 }}>
                        <div style={{ fontSize:9, fontWeight:400, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:6 }}>Notas</div>
                        <div style={{ fontSize:12.5, color:'var(--z-text-2)', whiteSpace:'pre-wrap' }}>{seleccionado.notas}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </PageContent>
    </Layout>
  );
}
