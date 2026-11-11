import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Badge, Spinner, EmptyState } from '../components/ui';
import { optimizarPorMaterial } from '../lib/corte';
import { pasosArmado } from '../lib/modelo3d';
// three.js pesa: el visor se carga solo cuando se abre la pestaña 3D.
const Vista3D = lazy(() => import('../components/Vista3D'));
import { Necesidades } from '../components/StockCompras';

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
      supabase.from('ordenes_trabajo').select('id,numero_ot,presupuesto,estado,historica,sesion_cotizacion_id,fecha_inicio,fecha_entrega_estimada,proyectos(nombre,descripcion,notas_internas,clientes(nombre,telefono,direccion_obra))').order('numero_ot', { ascending: false }),
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
  const [vista, setVista] = useState('despiece');
  useEffect(() => {
    supabase.from('ot_piezas').select('*').eq('orden_trabajo_id', ot.id).order('orden').then(({ data }) => setPiezas(data || []));
  }, [ot.id]);
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const cli = ot.proyectos?.clientes || {};

  const imprimir = () => {
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const bloques = mods.map(m => {
      const todas = (piezas || []).filter(p => p.modulo_id === m.id);
      const ps = todas.some(p => p.origen === 'taller') ? todas.filter(p => p.origen === 'taller') : todas;
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
          <div className="z-seg mb-4" role="group" aria-label="Vista de la orden">
            {[['despiece', 'Despiece'], ['3d', '3D y armado'], ['corte', 'Corte de placas'], ['compras', 'Materiales y compras']].map(([k, l]) =>
              <button key={k} aria-pressed={vista === k} onClick={() => setVista(k)}>{l}</button>)}
          </div>
          {vista === 'corte' && (piezas ? <Corte ot={ot} piezas={piezasDeCorte(mods, piezas)} /> : <Spinner />)}
          {vista === 'compras' && <Necesidades otId={ot.id} />}
          {vista === '3d' && (piezas ? <Armado ot={ot} mods={mods} piezas={piezas} /> : <Spinner />)}
          {vista !== 'despiece' ? null : !piezas ? <Spinner /> : mods.map(m => {
            const todas = piezas.filter(p => p.modulo_id === m.id);
            const taller = todas.filter(p => p.origen === 'taller'), agente = todas.filter(p => p.origen === 'agente');
            const ps = taller.length ? taller : agente;
            const m2 = xs => xs.reduce((a, p) => a + p.largo_mm * p.ancho_mm * p.cantidad * (p.espesor_mm / 18), 0) / 1e6;
            return (
              <section key={m.id} className="mb-6">
                <div className="flex flex-wrap items-baseline gap-x-3 mb-1">
                  <h3 className="text-[14.5px] font-semibold text-z-ink m-0">{m.nombre}</h3>
                  <span className="text-[12.5px] text-z-ink-3">{m.material} · {n(m.ml)} ml{m.modulo_tipo ? ` · ${m.modulo_tipo}` : ''}</span>
                  {!m.sin_despiece && <span className="text-[12.5px] text-z-ink-2 ml-auto tabular-nums">{n(m.m2_placa)} m² · {n(m.placas_netas)} placas netas{m.placas_reales != null ? ` (orden dice ${n(m.placas_reales)})` : ''} · {n(m.ml_canto, 1)} m de canto</span>}
                </div>
                {m.notas && <p className="text-[12.5px] text-z-ink-3 mb-2">{m.notas}</p>}
                {!taller.length && agente.length > 0 && <p className="text-[12.5px] mb-2"><Badge tone="info">Despiece propuesto por el agente</Badge> <span className="text-z-ink-3">{n(m2(agente))} m² · el taller lo verifica o carga el suyo para comparar.</span></p>}
                {taller.length > 0 && agente.length > 0 && <p className="text-[12.5px] mb-2" style={{ color: Math.abs(m2(agente) / m2(taller) - 1) > 0.1 ? 'rgb(var(--z-danger-c))' : undefined }}>Agente {n(m2(agente))} m² vs. taller {n(m2(taller))} m² · desvío {Math.round((m2(agente) / m2(taller) - 1) * 100)}%</p>}
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

// Piezas que se cortan: las del taller si las cargó, si no las del agente (igual que el despiece de arriba).
function piezasDeCorte(mods, piezas) {
  return mods.flatMap(m => {
    const todas = piezas.filter(p => p.modulo_id === m.id);
    const ps = todas.some(p => p.origen === 'taller') ? todas.filter(p => p.origen === 'taller') : todas;
    return ps.map(p => ({ nombre: p.nombre_pieza, modulo: m.nombre, largo_mm: p.largo_mm, ancho_mm: p.ancho_mm, cantidad: p.cantidad, material: p.material_nombre }));
  });
}

const COLORES = ['#d9c3a5', '#c8d6c1', '#c9d3e3', '#e6c9c9', '#e3dcc0', '#d4c9e3'];
function svgPlaca(pl, largo, ancho) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mods = [...new Set(pl.piezas.map(p => p.modulo))];
  const rects = pl.piezas.map(p => {
    const fs = Math.max(28, Math.min(70, Math.min(p.w, p.h) / 4));
    return `<g><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${COLORES[mods.indexOf(p.modulo) % COLORES.length]}" stroke="#333" stroke-width="4"/>` +
      `<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" fill="#222">${p.rot ? p.h + '×' + p.w + ' ↻' : p.w + '×' + p.h}</text>` +
      (p.h > fs * 3 && p.w > 300 ? `<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + fs * 1.2}" font-size="${fs * 0.7}" text-anchor="middle" font-family="Arial" fill="#555">${esc(p.nombre)}</text>` : '') + '</g>';
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ${largo + 20} ${ancho + 20}" style="width:100%;height:auto;background:#fff"><rect x="0" y="0" width="${largo}" height="${ancho}" fill="#f4f4f4" stroke="#000" stroke-width="6"/>${rects}</svg>`;
}

function Corte({ ot, piezas }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { supabase.from('config_placas').select('material,largo_mm,ancho_mm').eq('activo', true).then(({ data }) => setCfg(data || [])); }, []);
  if (!cfg) return <Spinner />;
  if (!piezas.length) return <EmptyState icon="content_cut" title="Esta orden no tiene piezas para cortar" />;
  const grupos = optimizarPorMaterial(piezas, cfg);
  const pct = x => Math.round(x * 100) + '%';
  const imprimir = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Corte ${ot.numero_ot}</title><style>body{font:12px system-ui;margin:20px}h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 4px}.p{page-break-inside:avoid;margin:8px 0 16px}.s{color:#555}</style>
      <h1>Hoja de corte ${ot.numero_ot}</h1><p class="s">Sierra 4 mm. Medidas largo × ancho en mm; ↻ = pieza girada. Las piezas del mismo color son del mismo módulo.</p>` +
      grupos.map(g => `<h2>${g.material.replace(/[&<>"]/g, '')} — ${g.placas.length} placa${g.placas.length > 1 ? 's' : ''} de ${g.largo}×${g.ancho}${g.veta ? ' (con veta, sin girar)' : ''} · aprovechamiento ${pct(g.uso)}</h2>` +
        g.placas.map((pl, i) => `<div class="p"><b>Placa ${i + 1}</b> · ${pct(pl.uso)} · ${pl.piezas.length} piezas${pl.retazos.length ? ` · retazos: ${pl.retazos.map(r => Math.round(r.w) + '×' + Math.round(r.h)).join(', ')}` : ''}${svgPlaca(pl, g.largo, g.ancho)}</div>`).join('')).join(''));
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[12.5px] text-z-ink-3 m-0 flex-1">Corte en guillotina, sierra de 4 mm. Las melaminas con veta no se giran. Los retazos de más de 30 × 30 cm quedan anotados.</p>
        <button className="btn btn-secondary btn-sm" onClick={imprimir}><Icon name="print" /> Hoja de corte</button>
      </div>
      {grupos.map(g => (
        <section key={g.material} className="mb-6">
          <h3 className="text-[14.5px] font-semibold text-z-ink m-0">{g.material}</h3>
          <p className="text-[12.5px] text-z-ink-3 mb-2">{g.placas.length} placa{g.placas.length > 1 ? 's' : ''} de {g.largo} × {g.ancho} · aprovechamiento {pct(g.uso)}{g.veta ? ' · con veta' : ''}{g.noEntran.length ? ` · ${g.noEntran.length} pieza(s) más grandes que la placa` : ''}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {g.placas.map((pl, i) => (
              <figure key={i} style={{ margin: 0 }}>
                <img alt={`Placa ${i + 1} de ${g.material}`} style={{ width: '100%', borderRadius: 6 }} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgPlaca(pl, g.largo, g.ancho))}`} />
                <figcaption className="text-[12px] text-z-ink-3">Placa {i + 1} · {pct(pl.uso)} · {pl.piezas.length} piezas</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// 3D y armado: modelo paramétrico de los módulos (girable, armado o explotado) e instructivo imprimible
// con el 3D, los pasos de armado por módulo, los planos de corte y el despiece.
function Armado({ ot, mods, piezas }) {
  const [modulos, setModulos] = useState(null);
  const [explotado, setExplotado] = useState(false);
  const [cfg, setCfg] = useState([]);
  const [armando, setArmando] = useState(false);
  const visor = useRef(null);
  useEffect(() => {
    supabase.from('config_placas').select('material,largo_mm,ancho_mm').eq('activo', true).then(({ data }) => setCfg(data || []));
    // Los módulos con puertas, cajones y estantes vienen del diseño de la cotización; si la OT se cargó a mano, cajas con sus medidas.
    const desdeOt = () => mods.map(m => ({ nombre: m.nombre, familia: /alacena/i.test(m.nombre) ? 'alacena' : 'bajo', ancho_mm: Math.round((+m.ml || 0) * 1000), alto_mm: Math.round((+m.alto_m || 0.72) * 1000), prof_mm: Math.round((+m.prof_m || 0.55) * 1000), material: m.material, cantidad: 1 })).filter(m => m.ancho_mm > 0);
    if (!ot.sesion_cotizacion_id) { setModulos(desdeOt()); return; }
    supabase.from('cotizacion_diseno').select('modulos').eq('sesion_id', ot.sesion_cotizacion_id).maybeSingle()
      .then(({ data }) => setModulos(data?.modulos?.length ? data.modulos : desdeOt()));
  }, [ot.id, ot.sesion_cotizacion_id, mods]);

  if (!modulos) return <Spinner />;
  if (!modulos.length) return <EmptyState icon="view_in_ar" title="Sin medidas de módulos para armar el 3D" />;

  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const instructivo = async () => {
    setArmando(true);
    setExplotado(false); await esperar(400); const fotoArmado = visor.current?.captura();
    setExplotado(true); await esperar(400); const fotoExplotado = visor.current?.captura();
    setExplotado(false); setArmando(false);
    const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const grupos = optimizarPorMaterial(piezasDeCorte(mods, piezas), cfg);
    const pct = x => Math.round(x * 100) + '%';
    const pasos = modulos.map(m => `<div class="p"><h3>${esc(m.nombre)}${(+m.cantidad || 1) > 1 ? ` × ${+m.cantidad}` : ''}</h3><p class="s">${+m.ancho_mm} × ${+m.alto_mm} × ${+m.prof_mm} mm · ${esc(m.material || '')}</p><ol>${pasosArmado(m).map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>`).join('');
    const cortes = grupos.map(g => `<h3>${esc(g.material)} — ${g.placas.length} placa${g.placas.length > 1 ? 's' : ''} de ${g.largo}×${g.ancho} · ${pct(g.uso)}</h3>` +
      g.placas.map((pl, i) => `<div class="p"><b>Placa ${i + 1}</b> · ${pct(pl.uso)}${svgPlaca(pl, g.largo, g.ancho)}</div>`).join('')).join('');
    const desp = mods.map(m => {
      const todas = piezas.filter(p => p.modulo_id === m.id), ps = todas.some(p => p.origen === 'taller') ? todas.filter(p => p.origen === 'taller') : todas;
      return ps.length ? `<h3>${esc(m.nombre)}</h3><table><tr><th>Cant</th><th>Largo</th><th>Ancho</th><th>Pieza</th><th>Material</th><th>Canto</th><th>✓</th></tr>${ps.map(p => `<tr><td>${p.cantidad}</td><td>${p.largo_mm}</td><td>${p.ancho_mm}</td><td>${esc(p.nombre_pieza)}</td><td>${esc(p.material_nombre)}</td><td>${cantos(p)}</td><td></td></tr>`).join('')}</table>` : '';
    }).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Armado ${esc(ot.numero_ot)}</title><style>body{font:12px system-ui;margin:22px}h1{font-size:19px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px;border-bottom:2px solid #222;page-break-after:avoid}h3{font-size:13.5px;margin:12px 0 2px}.s{color:#555;margin:0 0 4px}.p{page-break-inside:avoid}.f{display:grid;grid-template-columns:1fr 1fr;gap:12px}.f img{width:100%;border:1px solid #ccc;border-radius:6px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left}td:nth-child(-n+3){text-align:right}ol{margin:4px 0 0 18px;padding:0}li{margin:2px 0}</style>
      <h1>Instructivo de armado ${esc(ot.numero_ot)}</h1><p class="s">${esc(ot.proyectos?.clientes?.nombre || '')} · ${esc(ot.proyectos?.nombre || '')}. Medidas en mm.</p>
      <h2>1. Diseño en 3D</h2><div class="f"><div><b>Armado</b>${fotoArmado ? `<img src="${fotoArmado}">` : ''}</div><div><b>Despiezado (cómo va cada pieza)</b>${fotoExplotado ? `<img src="${fotoExplotado}">` : ''}</div></div>
      <h2>2. Pasos de armado por módulo</h2>${pasos}
      <h2>3. Planos de corte</h2><p class="s">Corte en guillotina, sierra de 4 mm. ↻ = pieza girada. Mismo color = mismo módulo.</p>${cortes}
      <h2>4. Despiece</h2>${desp}<p class="s" style="margin-top:12px">Canto: 1L = un lado largo, 2A = dos lados cortos.</p>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="z-seg" role="group" aria-label="Vista 3D">
          <button aria-pressed={!explotado} onClick={() => setExplotado(false)}>Armado</button>
          <button aria-pressed={explotado} onClick={() => setExplotado(true)}>Despiezado</button>
        </div>
        <span className="text-[12.5px] text-z-ink-3">Arrastrá para girar, rueda o pellizco para acercar.</span>
        <button className="btn btn-primary btn-sm ml-auto" onClick={instructivo} disabled={armando}><Icon name="print" /> {armando ? 'Preparando…' : 'Instructivo de armado'}</button>
      </div>
      <Suspense fallback={<Spinner />}><Vista3D ref={visor} modulos={modulos} explotado={explotado} alto={440} /></Suspense>
      <p className="text-[12px] text-z-ink-3 mt-2">Modelo armado con las medidas del diseño y las reglas del despiece (placa de 18 mm, fondo de 3 mm, frentes superpuestos 2 cm). No es el render de la IA: es la geometría real para el taller. El instructivo junta el 3D, los pasos por módulo, los planos de corte y el despiece.</p>
      <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {modulos.map((m, i) => (
          <div key={i} className="card p-3">
            <b className="text-z-ink text-[13.5px]">{m.nombre}{(+m.cantidad || 1) > 1 ? ` × ${+m.cantidad}` : ''}</b>
            <ol className="text-[12.5px] text-z-ink-2 mt-1 mb-0 pl-4">{pasosArmado(m).map((t, j) => <li key={j}>{t}</li>)}</ol>
          </div>
        ))}
      </div>
    </>
  );
}
