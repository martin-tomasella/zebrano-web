
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent } from '../components/Layout';

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—';
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—';

const ESTADO_CHIP = {
  prospecto:        { cls: 'bg-z-ink-3/15 text-z-ink-3 border-z-ink-3/30',  dot: 'bg-z-ink-3' },
  cotizado:         { cls: 'bg-z-warning/15 text-z-warning border-z-warning/30',  dot: 'bg-z-warning' },
  sena_pagada:      { cls: 'bg-z-success/15 text-z-success border-z-success/30',  dot: 'bg-z-success' },
  en_fabricacion:   { cls: 'bg-z-primary/15 text-z-primary border-z-primary/30',  dot: 'bg-z-primary' },
  entregado:        { cls: 'bg-z-primary/15 text-z-primary border-z-primary/30',  dot: 'bg-z-primary' },
  cancelado:        { cls: 'bg-z-danger/15 text-z-danger border-z-danger/30',  dot: 'bg-z-danger' },
};
const ESTADO_CHIP_DEFAULT = { cls: 'bg-z-ink-3/15 text-z-ink-3 border-z-ink-3/30', dot: 'bg-z-ink-3' };
const ESTADO_LABEL = {
  prospecto: 'Prospecto', cotizado: 'Cotizado', sena_pagada: 'Seña pagada',
  en_fabricacion: 'En fabricación', entregado: 'Entregado', cancelado: 'Cancelado',
};

function EstadoBadge({ estado }) {
  const s = ESTADO_CHIP[estado] || ESTADO_CHIP_DEFAULT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11.5px] border flex-shrink-0 ${s.cls}`}>
      <span className={`w-1 h-1 rounded-full ${s.dot}`} />
      {ESTADO_LABEL[estado] || estado || 'Sin estado'}
    </span>
  );
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionadoId, setSeleccionadoId] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: c, error: ec }, { data: p, error: ep }] = await Promise.all([
        supabase.from('clientes').select('*').order('created_at', { ascending: false }),
        supabase.from('proyectos').select('*').order('fecha_creacion', { ascending: false }),
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
    return (c.nombre || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.telefono || '').includes(q);
  });

  const facturadoTotal = proyectos.filter(p => p.estado !== 'cancelado').reduce((s, p) => s + Number(p.valor_final || p.valor_estimado || 0), 0);
  const cantidadTrabajos = proyectos.filter(p => p.estado !== 'cancelado').length;
  const ticketPromedio = cantidadTrabajos > 0 ? facturadoTotal / cantidadTrabajos : 0;

  const seleccionado = clientes.find(c => c.id === seleccionadoId);
  const trabajosSeleccionado = (proyectosPorCliente[seleccionadoId] || []);

  // KPIs del cliente seleccionado — mismo cálculo que las globales de arriba,
  // pero acotado a trabajosSeleccionado (ya cargado, sin queries nuevas).
  const statsCliente = useMemo(() => {
    const validos = trabajosSeleccionado.filter(p => p.estado !== 'cancelado');
    const facturado = validos.reduce((s, p) => s + Number(p.valor_final || p.valor_estimado || 0), 0);
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
          <div className="text-center py-12 text-z-ink-4">Cargando...</div>
        ) : (
          <>
            {/* ── KPI row global ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-z-surface border border-z-line rounded p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-z-ink-3 font-mono text-[11.5px] ">Facturado histórico</span>
                  <span className="material-symbols-outlined text-z-primary text-lg">payments</span>
                </div>
                <span className="font-mono text-[32px] text-z-ink font-bold">{fmt(facturadoTotal)}</span>
              </div>
              <div className="bg-z-surface border border-z-line rounded p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-z-ink-3 font-mono text-[11.5px] ">Cantidad de trabajos</span>
                  <span className="material-symbols-outlined text-z-primary text-lg">architecture</span>
                </div>
                <span className="font-mono text-[32px] text-z-ink font-bold">{cantidadTrabajos}</span>
              </div>
              <div className="bg-z-surface border border-z-line rounded p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-z-ink-3 font-mono text-[11.5px] ">Ticket promedio</span>
                  <span className="material-symbols-outlined text-z-success text-lg">receipt_long</span>
                </div>
                <span className="font-mono text-[32px] text-z-ink font-bold">{fmt(ticketPromedio)}</span>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              {/* ── Panel izquierdo: maestro (lista de clientes) ─────────────────── */}
              <section className="w-80 flex-shrink-0 border border-z-line bg-z-surface rounded-lg flex flex-col overflow-hidden">
                <div className="p-4 border-b border-z-line flex justify-between items-center">
                  <h2 className="text-xl font-bold text-z-ink">Clientes</h2>
                  <span className="font-mono text-[11.5px] bg-z-inset border border-z-line px-2 py-1 rounded text-z-ink-3">
                    {filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <div className="p-3 border-b border-z-line">
                  <input
                    placeholder="Buscar cliente..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    className="w-full bg-z-inset border border-z-line rounded-full pl-4 pr-4 py-1.5 font-mono text-xs text-z-ink focus:outline-none focus:border-z-primary transition-colors"
                  />
                </div>
                <div className="flex-1 overflow-y-auto max-h-[560px]">
                  {filtrados.length === 0 ? (
                    <div className="p-5 text-xs text-z-ink-4 text-center">Sin resultados</div>
                  ) : filtrados.map(c => {
                    const ult = ultimoTrabajo(c.id);
                    const activo = seleccionadoId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSeleccionadoId(c.id)}
                        className={`p-4 cursor-pointer border-b border-z-line transition-colors ${activo ? 'bg-z-subtle border-l-4 border-l-z-primary' : 'border-l-4 border-l-transparent hover:bg-z-subtle'}`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h3 className={`text-sm font-bold truncate ${activo ? 'text-z-primary' : 'text-z-ink'}`}>{c.nombre || 'Sin nombre'}</h3>
                          {ult
                            ? <EstadoBadge estado={ult.estado} />
                            : <span className="font-mono text-[11.5px] text-z-ink-4 flex-shrink-0">Sin trabajos</span>}
                        </div>
                        <p className="font-mono text-[11px] text-z-ink-2 truncate">
                          {ult ? (ult.tipo_trabajo || ult.descripcion || 'Trabajo') : 'Todavía no tiene trabajos'}
                        </p>
                        {ult && (
                          <div className="flex justify-between mt-2">
                            <span className="font-mono text-[11.5px] text-z-ink-3">{fmt(ult.valor_final || ult.valor_estimado)}</span>
                            <span className="font-mono text-[11.5px] text-z-ink-3">{fechaFmt(ult.fecha_creacion)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Panel derecho: detalle del cliente seleccionado ──────────────── */}
              <section className="flex-1 border border-z-line bg-z-canvas rounded-lg overflow-hidden min-h-[400px]">
                {!seleccionado ? (
                  <div className="text-center py-16 text-z-ink-4">
                    <span className="material-symbols-outlined text-4xl mb-2 block">person</span>
                    <p>Elegí un cliente para ver su historial</p>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="p-8 border-b border-z-line bg-z-inset">
                      <nav className="flex items-center gap-2 mb-3">
                        <span className="font-mono text-[11.5px] text-z-ink-3">Clientes</span>
                        <span className="material-symbols-outlined text-sm text-z-ink-3">chevron_right</span>
                        <span className="font-mono text-[11.5px] text-z-primary">{(seleccionado.nombre || 'Sin nombre').toUpperCase()}</span>
                      </nav>
                      <h1 className="text-[28px] font-bold text-z-ink mb-3">{seleccionado.nombre}</h1>
                      <div className="flex gap-3 flex-wrap">
                        {seleccionado.telefono && (
                          <span className="px-3 py-1 bg-z-surface border border-z-line rounded-full text-xs text-z-ink-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">call</span> {seleccionado.telefono}
                          </span>
                        )}
                        {seleccionado.email && (
                          <span className="px-3 py-1 bg-z-surface border border-z-line rounded-full text-xs text-z-ink-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">mail</span> {seleccionado.email}
                          </span>
                        )}
                        {seleccionado.direccion_obra && (
                          <span className="px-3 py-1 bg-z-surface border border-z-line rounded-full text-xs text-z-ink-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">location_on</span> {seleccionado.direccion_obra}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* KPI Section (cliente seleccionado) */}
                    <div className="grid grid-cols-3 gap-4 p-8">
                      <div className="bg-z-surface border border-z-line rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-[11.5px] text-z-ink-3">Facturado</span>
                          <span className="material-symbols-outlined text-z-primary">payments</span>
                        </div>
                        <div className="font-mono text-2xl font-bold text-z-primary">{fmt(statsCliente.facturado)}</div>
                      </div>
                      <div className="bg-z-surface border border-z-line rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-[11.5px] text-z-ink-3">Trabajos</span>
                          <span className="material-symbols-outlined text-z-primary">architecture</span>
                        </div>
                        <div className="font-mono text-2xl font-bold text-z-ink">{statsCliente.cantidad}</div>
                      </div>
                      <div className="bg-z-surface border border-z-line rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-[11.5px] text-z-ink-3">Ticket promedio</span>
                          <span className="material-symbols-outlined text-z-primary">receipt_long</span>
                        </div>
                        <div className="font-mono text-2xl font-bold text-z-ink">{fmt(statsCliente.ticket)}</div>
                      </div>
                    </div>

                    {/* Historial de trabajos — timeline */}
                    <div className="px-8 pb-10">
                      <h3 className="font-mono text-[11.5px] text-z-ink-3 mb-4">
                        Historial de trabajos ({trabajosSeleccionado.length})
                      </h3>
                      {trabajosSeleccionado.length === 0 ? (
                        <div className="text-xs text-z-ink-4">Todavía no tiene trabajos registrados.</div>
                      ) : (
                        <div className="relative ml-2 border-l border-z-line">
                          {trabajosSeleccionado.map((p, i) => (
                            <div key={p.id} className={`relative pl-6 ${i < trabajosSeleccionado.length - 1 ? 'pb-5' : ''}`}>
                              <div className={`absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full border-4 border-z-canvas box-content ${i === 0 ? 'bg-z-primary' : 'bg-z-ink-4'}`} />
                              <div className="bg-z-surface border border-z-line p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-1">
                                  <span className={`font-mono text-[11.5px] font-bold ${i === 0 ? 'text-z-primary' : 'text-z-ink-3'}`}>
                                    {fechaFmt(p.fecha_creacion)}
                                  </span>
                                  <EstadoBadge estado={p.estado} />
                                </div>
                                <h4 className="text-sm font-bold text-z-ink capitalize">{p.tipo_trabajo || p.descripcion || 'Trabajo'}</h4>
                                <p className="font-mono text-xs text-z-primary mt-1">{fmt(p.valor_final || p.valor_estimado)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {seleccionado.notas && (
                        <div className="mt-6">
                          <h3 className="font-mono text-[11.5px] text-z-ink-3 mb-2">Notas</h3>
                          <div className="text-xs text-z-ink-2 whitespace-pre-wrap bg-z-surface border border-z-line rounded-lg p-4">{seleccionado.notas}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </PageContent>
    </Layout>
  );
}
