
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

  // KPIs del cliente seleccionado — mismo cálculo que las globales de arriba,
  // pero acotado a trabajosSeleccionado (ya cargado, sin queries nuevas).
  const statsCliente = useMemo(() => {
    const validos = trabajosSeleccionado.filter(p => p.estado !== 'cancelado');
    const facturado = validos.reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0);
    const cantidad = validos.length;
    const ticket = cantidad > 0 ? facturado / cantidad : 0;
    return { facturado, cantidad, ticket };
  }, [trabajosSeleccionado]);

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
              {/* ── Panel izquierdo: maestro (lista de clientes) ─────────────────── */}
              <div style={{ width:320, flexShrink:0, background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
                <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--z-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:15, fontWeight:600, color:'var(--z-text)' }}>Clientes</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--z-text-3)', background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:6, padding:'3px 8px' }}>
                    {filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--z-border)' }}>
                  <input placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    style={{ width:'100%', padding:'7px 12px', fontSize:12.5, fontFamily:'var(--font-mono)', background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:99, color:'var(--z-text)', outline:'none' }} />
                </div>
                <div style={{ maxHeight:560, overflowY:'auto' }}>
                  {filtrados.length === 0 ? (
                    <div style={{ padding:20, fontSize:12.5, color:'var(--z-text-muted)', textAlign:'center' }}>Sin resultados</div>
                  ) : filtrados.map(c => {
                    const ult = ultimoTrabajo(c.id);
                    const activo = seleccionadoId === c.id;
                    return (
                      <div key={c.id} onClick={() => setSeleccionadoId(c.id)} style={{
                        padding:'13px 16px', cursor:'pointer', borderLeft: activo ? '3px solid var(--z-primary)' : '3px solid transparent',
                        background: activo ? 'var(--z-active-bg)' : 'transparent', borderBottom:'1px solid var(--z-border)',
                        transition:'var(--z-transition)',
                      }}
                      onMouseEnter={e => { if (!activo) e.currentTarget.style.background = 'var(--z-card-hover)'; }}
                      onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent'; }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:4 }}>
                          <div style={{ fontSize:14, fontWeight:600, color: activo ? 'var(--z-primary-light)' : 'var(--z-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {c.nombre || 'Sin nombre'}
                          </div>
                          {ult
                            ? <Badge value={ult.estado} />
                            : <span style={{ fontFamily:'var(--font-mono)', fontSize:9.5, color:'var(--z-text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 }}>Sin trabajos</span>}
                        </div>
                        <div style={{ fontSize:11.5, color:'var(--z-text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {ult ? `${ult.tipo_trabajo || ult.descripcion || 'Trabajo'}` : 'Todavía no tiene trabajos'}
                        </div>
                        {ult && (
                          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--z-text-3)' }}>{fmt(ult.valor_final || ult.valor_estimado)}</span>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--z-text-3)' }}>{fechaFmt(ult.fecha_creacion)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Panel derecho: detalle del cliente seleccionado ──────────────── */}
              <div style={{ flex:1, background:'var(--z-bg-2)', border:'1px solid var(--z-border)', borderRadius:'var(--radius-lg)', overflow:'hidden', minHeight:400 }}>
                {!seleccionado ? (
                  <div style={{ textAlign:'center', padding:64, color:'var(--z-text-muted)' }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>👤</div>
                    <p>Elegí un cliente para ver su historial</p>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div style={{ padding:'24px 28px', borderBottom:'1px solid var(--z-border)', background:'var(--z-bg-2)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Clientes</span>
                        <span className="material-symbols-outlined" style={{ fontSize:13, color:'var(--z-text-muted)' }}>chevron_right</span>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--z-primary)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{(seleccionado.nombre || 'Sin nombre').toUpperCase()}</span>
                      </div>
                      <h2 style={{ margin:'0 0 12px', fontSize:22, fontWeight:600, color:'var(--z-text)' }}>{seleccionado.nombre}</h2>
                      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                        {seleccionado.telefono && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:99, fontSize:12, color:'var(--z-text-2)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize:14 }}>call</span> {seleccionado.telefono}
                          </span>
                        )}
                        {seleccionado.email && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:99, fontSize:12, color:'var(--z-text-2)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize:14 }}>mail</span> {seleccionado.email}
                          </span>
                        )}
                        {seleccionado.direccion_obra && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:99, fontSize:12, color:'var(--z-text-2)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize:14 }}>location_on</span> {seleccionado.direccion_obra}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* KPIs del cliente */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12, padding:'20px 28px' }}>
                      <KpiCard label="Facturado (cliente)" value={fmt(statsCliente.facturado)} accent />
                      <KpiCard label="Trabajos" value={statsCliente.cantidad} />
                      <KpiCard label="Ticket promedio" value={fmt(statsCliente.ticket)} />
                    </div>

                    {/* Historial de trabajos — timeline */}
                    <div style={{ padding:'4px 28px 28px' }}>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:500, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:16 }}>
                        Historial de trabajos ({trabajosSeleccionado.length})
                      </div>
                      {trabajosSeleccionado.length === 0 ? (
                        <div style={{ fontSize:12.5, color:'var(--z-text-muted)' }}>Todavía no tiene trabajos registrados.</div>
                      ) : (
                        <div style={{ position:'relative', marginLeft:6, borderLeft:'1px solid var(--z-border)' }}>
                          {trabajosSeleccionado.map((p, i) => (
                            <div key={p.id} style={{ position:'relative', paddingLeft:24, paddingBottom: i < trabajosSeleccionado.length - 1 ? 18 : 0 }}>
                              <div style={{
                                position:'absolute', left:-5, top:4, width:9, height:9, borderRadius:'50%',
                                background: i === 0 ? 'var(--z-primary)' : 'var(--z-text-muted)',
                                border:'3px solid var(--z-bg-2)', boxSizing:'content-box',
                              }} />
                              <div style={{ background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--radius-md)', padding:'12px 16px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, fontWeight:700, color: i === 0 ? 'var(--z-primary)' : 'var(--z-text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                                    {fechaFmt(p.fecha_creacion)}
                                  </span>
                                  <Badge value={p.estado} />
                                </div>
                                <div style={{ fontSize:13.5, fontWeight:600, color:'var(--z-text)', textTransform:'capitalize' }}>{p.tipo_trabajo || p.descripcion || 'Trabajo'}</div>
                                <div style={{ fontSize:12, color:'var(--z-success)', fontFamily:'var(--font-mono)', marginTop:4 }}>{fmt(p.valor_final || p.valor_estimado)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {seleccionado.notas && (
                        <div style={{ marginTop:22 }}>
                          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:500, color:'var(--z-hint)', textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:8 }}>Notas</div>
                          <div style={{ fontSize:12.5, color:'var(--z-text-2)', whiteSpace:'pre-wrap', background:'var(--z-card)', border:'1px solid var(--z-border)', borderRadius:'var(--radius-md)', padding:'12px 16px' }}>{seleccionado.notas}</div>
                        </div>
                      )}
                    </div>
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
