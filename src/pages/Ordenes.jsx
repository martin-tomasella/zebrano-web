import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Badge, Spinner, EmptyState } from '../components/ui';

const n = (v, d = 2) => v == null ? '—' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: d });
const fecha = d => d ? new Date(d + 'T12:00').toLocaleDateString('es-AR') : '—';
const cantos = p => [p.cantos_largo ? `${p.cantos_largo}L` : '', p.cantos_ancho ? `${p.cantos_ancho}A` : ''].filter(Boolean).join(' + ') || '—';

export default function Ordenes() {
  const [tab, setTab] = useState('ordenes');
  const [ots, setOts] = useState(null);
  const [res, setRes] = useState([]);
  const [cal, setCal] = useState([]);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from('ordenes_trabajo').select('id,numero_ot,presupuesto,estado,historica,fecha_inicio,fecha_entrega_estimada,proyectos(nombre,descripcion,notas_internas,clientes(nombre,telefono,direccion_obra))').order('numero_ot', { ascending: false }),
      supabase.from('ot_modulos_resumen').select('*'),
      supabase.from('calibracion_material').select('*'),
    ]).then(([a, b, c]) => { setOts(a.data || []); setRes(b.data || []); setCal(c.data || []); });
  }, []);

  const modsDe = id => res.filter(r => r.orden_trabajo_id === id);

  return (
    <Layout>
      <Topbar title="Órdenes de fabricación" subtitle="Despiece real de cada trabajo: alimenta la calibración del cotizador" />
      <PageContent>
        <div className="z-seg mb-4" role="group" aria-label="Vista">
          {[['ordenes', 'Órdenes'], ['calibracion', 'Calibración del cotizador']].map(([k, l]) =>
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {!ots ? <Spinner /> : tab === 'ordenes' ? (
          <div className="card overflow-auto">
            <table className="w-full text-[13px]">
              <thead><tr><th>OT</th><th>Presupuesto</th><th>Cliente</th><th>Trabajo</th><th>Inicio</th><th>Estado</th><th className="text-right">ML</th><th className="text-right">Placas netas</th><th className="text-right">Canto (m)</th></tr></thead>
              <tbody>
                {ots.length === 0 ? <tr><td colSpan={9}><EmptyState icon="content_cut" title="Sin órdenes cargadas" /></td></tr> : ots.map(o => {
                  const ms = modsDe(o.id);
                  const sum = k => ms.reduce((s, m) => s + Number(m[k] || 0), 0);
                  return (
                    <tr key={o.id} className="cursor-pointer hover:bg-z-subtle" onClick={() => setAbierta(o)}>
                      <td className="font-medium text-z-ink whitespace-nowrap">{o.numero_ot}</td>
                      <td>{o.presupuesto || '—'}</td>
                      <td>{o.proyectos?.clientes?.nombre}</td>
                      <td>{o.proyectos?.descripcion}</td>
                      <td className="whitespace-nowrap">{fecha(o.fecha_inicio)}</td>
                      <td>{o.historica ? <Badge tone="neutral">Histórica</Badge> : <Badge tone={o.estado === 'terminada' ? 'success' : 'warning'}>{o.estado === 'en_proceso' ? 'En taller' : o.estado}</Badge>}</td>
                      <td className="text-right tabular-nums">{n(sum('ml'))}</td>
                      <td className="text-right tabular-nums">{n(sum('placas_netas'))}</td>
                      <td className="text-right tabular-nums">{n(sum('ml_canto'), 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] text-z-ink-3 mb-3">
              Real = suma de piezas de los despieces del taller (placa equivalente 18 mm de 2,60 × 1,83, sin desperdicio) y metros de canto visto, por metro lineal de frente.
              Cotizador = lo que usa hoy la receta del tipo de módulo (placas y rollos de preencolado de 50 m por ml). Se excluyen módulos sin despiece y trabajos especiales.
            </p>
            <div className="card overflow-auto">
              <table className="w-full text-[13px]">
                <thead><tr><th>Tipo de módulo</th><th className="text-right">Módulos</th><th className="text-right">ML</th><th className="text-right">Placas/ml real</th><th className="text-right">Placas/ml cotizador</th><th className="text-right">Canto m/ml real</th><th className="text-right">Canto m/ml cotizador</th></tr></thead>
                <tbody>
                  {cal.length === 0 ? <tr><td colSpan={7}><EmptyState icon="tune" title="Sin datos para calibrar" /></td></tr> : cal.map(c => {
                    const cantoCot = c.rollos_canto_por_ml_cotizador != null ? c.rollos_canto_por_ml_cotizador * 50 : null;
                    const desvio = (r, q) => r && q ? Math.round((q / r - 1) * 100) : null;
                    const d1 = desvio(c.placas_netas_por_ml_real, c.placas_por_ml_cotizador), d2 = desvio(c.canto_ml_por_ml_real, cantoCot);
                    const tono = d => d == null ? undefined : Math.abs(d) <= 15 ? undefined : 'rgb(var(--z-danger-c))';
                    return (
                      <tr key={c.modulo_tipo_id}>
                        <td className="font-medium text-z-ink">{c.modulo_tipo}</td>
                        <td className="text-right tabular-nums">{c.modulos}</td>
                        <td className="text-right tabular-nums">{n(c.ml_total)}</td>
                        <td className="text-right tabular-nums">{n(c.placas_netas_por_ml_real)}</td>
                        <td className="text-right tabular-nums" style={{ color: tono(d1) }}>{n(c.placas_por_ml_cotizador)}{d1 != null ? ` (${d1 > 0 ? '+' : ''}${d1}%)` : ''}</td>
                        <td className="text-right tabular-nums">{n(c.canto_ml_por_ml_real, 1)}</td>
                        <td className="text-right tabular-nums" style={{ color: tono(d2) }}>{n(cantoCot, 1)}{d2 != null ? ` (${d2 > 0 ? '+' : ''}${d2}%)` : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PageContent>
      {abierta && <Detalle ot={abierta} mods={modsDe(abierta.id)} onClose={() => setAbierta(null)} />}
    </Layout>
  );
}

function Detalle({ ot, mods, onClose }) {
  const [piezas, setPiezas] = useState(null);
  useEffect(() => {
    supabase.from('ot_piezas').select('*').eq('orden_trabajo_id', ot.id).eq('origen', 'taller').order('orden').then(({ data }) => setPiezas(data || []));
  }, [ot.id]);
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const cli = ot.proyectos?.clientes || {};

  const imprimir = () => {
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const bloques = mods.map(m => {
      const ps = (piezas || []).filter(p => p.modulo_id === m.id);
      return `<h3>${esc(m.nombre)}</h3><p class="s">${esc(m.material || '')} · ${n(m.ml)} ml${m.alto_m ? ` · alto ${n(m.alto_m)}` : ''}${m.prof_m ? ` · prof ${n(m.prof_m)}` : ''}${m.notas ? ` — ${esc(m.notas)}` : ''}</p>` +
        (ps.length ? `<table><tr><th>Cant</th><th>Largo</th><th>Ancho</th><th>Esp</th><th>Pieza</th><th>Material</th><th>Canto</th><th>✓</th></tr>${ps.map(p => `<tr><td>${p.cantidad}</td><td>${p.largo_mm}</td><td>${p.ancho_mm}</td><td>${p.espesor_mm}</td><td>${esc(p.nombre_pieza)}${p.lectura_dudosa ? ' (?)' : ''}</td><td>${esc(p.material_nombre)}</td><td>${cantos(p)}</td><td></td></tr>`).join('')}</table>` : '<p class="s">Sin despiece.</p>');
    }).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(ot.numero_ot)}</title><style>body{font:12px system-ui;margin:24px}h1{font-size:18px;margin:0}h3{margin:18px 0 2px;font-size:14px}.s{color:#555;margin:0 0 6px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left}td:nth-child(-n+4){text-align:right}.g{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:10px 0}</style>
      <h1>Orden de fabricación ${esc(ot.numero_ot)}</h1><div class="g"><div>Presupuesto: <b>${esc(ot.presupuesto || '—')}</b></div><div>Inicio: ${fecha(ot.fecha_inicio)} · Entrega: ${fecha(ot.fecha_entrega_estimada)}</div>
      <div>Cliente: <b>${esc(cli.nombre)}</b> ${esc(cli.telefono || '')}</div><div>${esc(cli.direccion_obra || '')}</div></div>
      <p>${esc(ot.proyectos?.notas_internas || '')}</p>${bloques}<p class="s" style="margin-top:16px">Canto: 1L = un lado largo, 2A = dos lados cortos. (?) = medida a verificar.</p>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="z-drawer-wrap" onMouseDown={onClose}>
      <div className="z-drawer" style={{ width: 'min(960px, 100vw)' }} onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={`Orden ${ot.numero_ot}`}>
        <div className="z-drawer-head">
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] m-0">{ot.numero_ot} · {cli.nombre}</h2>
            <div className="text-[12.5px] text-z-ink-3">Presupuesto {ot.presupuesto || '—'} · {ot.proyectos?.descripcion} · inicio {fecha(ot.fecha_inicio)}{ot.fecha_entrega_estimada ? ` · entrega ${fecha(ot.fecha_entrega_estimada)}` : ''}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={imprimir} disabled={!piezas}><Icon name="print" /> Imprimir</button>
            <button className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
          </div>
        </div>
        <div className="z-drawer-body">
          {ot.proyectos?.notas_internas && <p className="text-[13px] text-z-ink-2 mb-4">{ot.proyectos.notas_internas}</p>}
          {!piezas ? <Spinner /> : mods.map(m => {
            const ps = piezas.filter(p => p.modulo_id === m.id);
            return (
              <section key={m.id} className="mb-6">
                <div className="flex flex-wrap items-baseline gap-x-3 mb-1">
                  <h3 className="text-[14.5px] font-semibold text-z-ink m-0">{m.nombre}</h3>
                  <span className="text-[12.5px] text-z-ink-3">{m.material} · {n(m.ml)} ml{m.modulo_tipo ? ` · ${m.modulo_tipo}` : ''}</span>
                  {!m.sin_despiece && <span className="text-[12.5px] text-z-ink-2 ml-auto tabular-nums">{n(m.m2_placa)} m² · {n(m.placas_netas)} placas netas{m.placas_reales != null ? ` (orden dice ${n(m.placas_reales)})` : ''} · {n(m.ml_canto, 1)} m de canto</span>}
                </div>
                {m.notas && <p className="text-[12.5px] text-z-ink-3 mb-2">{m.notas}</p>}
                {ps.length === 0 ? <p className="text-[12.5px] text-z-ink-3">Sin despiece.</p> : (
                  <table className="w-full text-[12.5px]">
                    <thead><tr><th className="text-right">Cant</th><th className="text-right">Largo</th><th className="text-right">Ancho</th><th>Pieza</th><th>Material</th><th>Canto</th></tr></thead>
                    <tbody>{ps.map(p => (
                      <tr key={p.id}>
                        <td className="text-right tabular-nums">{p.cantidad}</td>
                        <td className="text-right tabular-nums">{p.largo_mm}</td>
                        <td className="text-right tabular-nums">{p.ancho_mm}{p.espesor_mm !== 18 ? ` × ${p.espesor_mm}` : ''}</td>
                        <td>{p.nombre_pieza}{p.lectura_dudosa && <span title="Medida a verificar en el papel original"> <Badge tone="warning">verificar</Badge></span>}{p.observacion && <div className="text-[11.5px] text-z-ink-3">{p.observacion}</div>}</td>
                        <td>{p.material_nombre}</td>
                        <td>{cantos(p)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
