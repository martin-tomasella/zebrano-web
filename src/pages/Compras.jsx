import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Badge, EmptyState, Spinner, KpiCard } from '../components/ui';

const $ = n => n == null ? '—' : '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const usd = n => n == null ? '—' : 'US$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = d => d ? new Date(d + 'T12:00').toLocaleDateString('es-AR') : '—';
const ESTADOS = [['pendiente', 'Por revisar', 'warning'], ['confirmada', 'Confirmadas', 'success'], ['descartada', 'Descartadas', 'neutral']];

export default function Compras() {
  const [tab, setTab] = useState('facturas');
  const [facturas, setFacturas] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendiente');
  const [abierta, setAbierta] = useState(null);
  const [subiendo, setSubiendo] = useState(null); // {hechas, total, actual}
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState('');
  const input = useRef();

  const cargar = useCallback(async () => {
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from('facturas_compra').select('id,fecha,tipo_comprobante,punto_venta,numero,total,neto_gravado,estado,a_nombre_de,alertas,comprador_nombre,created_at,proveedores(nombre)').order('created_at', { ascending: false }).limit(500),
      supabase.from('precios_vigentes').select('*').order('categoria'),
    ]);
    setFacturas(f || []); setPrecios(p || []); setLoading(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const subir = async files => {
    files = [...files]; if (!files.length) return;
    const errores = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setSubiendo({ hechas: i, total: files.length, actual: file.name });
      const limpio = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_');
      const path = `erp/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${limpio}`;
      const { error: eUp } = await supabase.storage.from('facturas').upload(path, file, { contentType: file.type });
      if (eUp) { errores.push(`${file.name}: ${eUp.message}`); continue; }
      const { data, error } = await supabase.functions.invoke('zebrano-facturas', { body: { archivo_path: path } });
      if (error || !data?.ok) {
        let msg = data?.error || error?.message;
        try { msg = (await error?.context?.json())?.error || msg; } catch (_) {}
        errores.push(`${file.name}: ${msg}`);
      }
    }
    setSubiendo(null); await cargar(); setFiltro('pendiente');
    setToast(errores.length ? { tone: 'danger', text: errores.join(' · ') } : { tone: 'success', text: `${files.length} factura(s) leída(s). Revisalas y confirmá.` });
  };

  const conteo = useMemo(() => Object.fromEntries(ESTADOS.map(([k]) => [k, facturas.filter(f => f.estado === k).length])), [facturas]);
  const lista = facturas.filter(f => f.estado === filtro && (!q || `${f.proveedores?.nombre} ${f.numero} ${f.comprador_nombre}`.toLowerCase().includes(q.toLowerCase())));
  const preciosF = precios.filter(p => !q || `${p.nombre} ${p.categoria}`.toLowerCase().includes(q.toLowerCase()));
  const mes = new Date().toISOString().slice(0, 7);
  const compradoMes = facturas.filter(f => f.estado === 'confirmada' && (f.fecha || '').startsWith(mes)).reduce((s, f) => s + Number(f.neto_gravado || 0), 0);
  const subas = precios.filter(p => p.variacion_pct > 0).length;

  return (
    <Layout>
      <Topbar title="Compras" subtitle="Facturas de proveedores y precios de insumos"
        actions={<>
          <input ref={input} type="file" multiple accept="application/pdf,image/*" hidden onChange={e => { subir(e.target.files); e.target.value = ''; }} />
          <button className="btn btn-primary" onClick={() => input.current.click()} disabled={!!subiendo}><Icon name="upload_file" />Cargar facturas</button>
        </>} />
      <PageContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <KpiCard label="Por revisar" value={conteo.pendiente || 0} icon="pending_actions" tone="warning" onClick={() => { setTab('facturas'); setFiltro('pendiente'); }} />
          <KpiCard label="Comprado este mes (neto)" value={$(compradoMes)} icon="shopping_cart" />
          <KpiCard label="Insumos con suba" value={subas} detail={`de ${precios.length} insumos`} icon="trending_up" tone="danger" onClick={() => setTab('precios')} />
        </div>

        <Dropzone onFiles={subir} subiendo={subiendo} />

        <div className="flex flex-wrap items-center gap-3 my-4">
          <div className="z-seg" role="group" aria-label="Vista">
            <button aria-pressed={tab === 'facturas'} onClick={() => setTab('facturas')}>Facturas</button>
            <button aria-pressed={tab === 'precios'} onClick={() => setTab('precios')}>Precios vigentes</button>
          </div>
          {tab === 'facturas' && ESTADOS.map(([k, l]) => (
            <button key={k} className="z-chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l} <span className="z-chip-count">{conteo[k] || 0}</span></button>
          ))}
          <input className="ml-auto max-w-[260px]" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" />
        </div>

        {loading ? <Spinner /> : tab === 'facturas' ? (
          <div className="card overflow-auto">
            <table className="w-full">
              <thead><tr><th>Fecha</th><th>Proveedor</th><th>Comprobante</th><th>A nombre de</th><th className="text-right">Total</th><th>Alertas</th></tr></thead>
              <tbody>
                {lista.length === 0 ? <tr><td colSpan={6}><EmptyState icon="receipt_long" title="No hay facturas acá">Subí PDFs o fotos de facturas: Zebrano las lee y te las deja para revisar.</EmptyState></td></tr>
                  : lista.map(f => (
                    <tr key={f.id} onClick={() => setAbierta(f.id)} className="cursor-pointer">
                      <td>{fecha(f.fecha)}</td>
                      <td className="font-medium text-z-ink">{f.proveedores?.nombre || '—'}</td>
                      <td className="tabular-nums">{f.tipo_comprobante} {f.punto_venta}-{f.numero}</td>
                      <td>{f.a_nombre_de === 'cliente' ? <Badge tone="info">Cliente · {f.comprador_nombre}</Badge> : <Badge tone="neutral">Zebrano</Badge>}</td>
                      <td className="text-right tabular-nums font-medium text-z-ink">{$(f.total)}</td>
                      <td>{f.alertas?.length ? <Badge tone="warning">{f.alertas.length}</Badge> : <Icon name="check" size={18} color="rgb(var(--z-success-c))" />}</td>
                    </tr>))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card overflow-auto">
            <table className="w-full">
              <thead><tr><th>Insumo</th><th>Categoría</th><th>Unidad</th><th className="text-right">Neto ARS</th><th className="text-right">USD</th><th className="text-right">Var.</th><th>Fuente</th><th>Fecha</th></tr></thead>
              <tbody>
                {preciosF.map(p => (
                  <tr key={p.insumo_id}>
                    <td className="font-medium text-z-ink">{p.nombre}</td><td>{p.categoria}</td><td>{p.unidad}</td>
                    <td className="text-right tabular-nums">{$(p.precio_neto)}</td>
                    <td className="text-right tabular-nums">{usd(p.precio_usd)}</td>
                    <td className="text-right tabular-nums" style={{ color: p.variacion_pct > 0 ? 'rgb(var(--z-danger-c))' : p.variacion_pct < 0 ? 'rgb(var(--z-success-c))' : undefined }}>{p.variacion_pct != null ? `${p.variacion_pct > 0 ? '+' : ''}${p.variacion_pct}%` : '—'}</td>
                    <td><Badge tone={p.fuente === 'factura' ? 'success' : 'neutral'}>{p.fuente === 'factura' ? 'Factura' : 'Lista Excel'}</Badge></td>
                    <td>{fecha(p.fecha_precio)}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </PageContent>

      {abierta && <Revision id={abierta} onClose={() => setAbierta(null)} onDone={msg => { setAbierta(null); setToast({ tone: 'success', text: msg }); cargar(); }} />}
      {toast && (
        <div role="status" className="z-pop fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 rounded-lg px-4 py-3 shadow-z-lg text-[13.5px] max-w-[90vw]"
          style={{ background: 'rgb(var(--z-ink-c))', color: 'rgb(var(--z-surface-c))' }}>
          <Icon name={toast.tone === 'danger' ? 'error' : 'check_circle'} size={18} color={toast.tone === 'danger' ? 'rgb(var(--z-danger-c))' : 'rgb(var(--z-nav-accent-c))'} />
          {toast.text}
        </div>
      )}
    </Layout>
  );
}

function Dropzone({ onFiles, subiendo }) {
  const [over, setOver] = useState(false);
  return (
    <div onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (!subiendo) onFiles(e.dataTransfer.files); }}
      className="rounded-lg border-2 border-dashed px-5 py-4 flex items-center gap-3 text-[13.5px] transition-colors"
      style={{ borderColor: over ? 'rgb(var(--z-primary-c))' : 'var(--z-line)', background: over ? 'rgb(var(--z-primary-c) / 0.06)' : 'var(--z-subtle)' }}>
      {subiendo ? <>
        <div className="w-5 h-5 rounded-full border-2 border-z-line border-t-z-primary animate-spin" />
        <span>Leyendo {subiendo.hechas + 1} de {subiendo.total}: <b>{subiendo.actual}</b> (≈20 s por factura)</span>
      </> : <>
        <Icon name="move_to_inbox" size={22} color="rgb(var(--z-ink-3-c))" />
        <span className="text-z-ink-3">Arrastrá acá PDFs, fotos o escaneos de facturas. Zebrano lee proveedor, renglones, precios e impuestos.</span>
      </>}
    </div>
  );
}

function Revision({ id, onClose, onDone }) {
  const [f, setF] = useState(null);
  const [items, setItems] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [url, setUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: fa }, { data: it }, { data: ins }, { data: pr }] = await Promise.all([
        supabase.from('facturas_compra').select('*, proveedores(nombre,cuit)').eq('id', id).single(),
        supabase.from('facturas_compra_items').select('*').eq('factura_id', id).order('orden'),
        supabase.from('insumos').select('id,nombre,categoria,unidad').eq('activo', true).order('nombre'),
        supabase.from('proyectos').select('id, estado, clientes(nombre)').not('estado', 'in', '(entregado,cancelado)').limit(200),
      ]);
      setF(fa); setItems(it || []); setInsumos(ins || []); setProyectos(pr || []);
      if (fa?.archivo_path) { const { data } = await supabase.storage.from('facturas').createSignedUrl(fa.archivo_path, 3600); setUrl(data?.signedUrl); }
    })();
  }, [id]);
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const setItem = (i, k, v) => setItems(xs => xs.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const nuevoInsumo = async i => {
    const it = items[i];
    const nombre = window.prompt('Nombre del insumo nuevo', it.descripcion); if (!nombre) return;
    const { data, error } = await supabase.from('insumos').insert({ nombre, categoria: 'Otros', unidad: it.unidad || 'unidad', proveedor_id: f.proveedor_id, origen: 'factura' }).select('id,nombre,categoria,unidad').single();
    if (error) { setError(error.message); return; }
    setInsumos(xs => [...xs, data].sort((a, b) => a.nombre.localeCompare(b.nombre))); setItem(i, 'insumo_id', data.id);
  };

  const guardar = async confirmar => {
    setSaving(true); setError('');
    const { error: e1 } = await supabase.from('facturas_compra').update({ a_nombre_de: f.a_nombre_de, proyecto_id: f.proyecto_id || null, notas: f.notas, fecha: f.fecha }).eq('id', id);
    const res = await Promise.all(items.map(it => supabase.from('facturas_compra_items').update({ insumo_id: it.insumo_id || null, precio_neto_unit: it.precio_neto_unit, cantidad: it.cantidad }).eq('id', it.id)));
    const e2 = res.find(r => r.error)?.error;
    let e3 = null;
    if (!e1 && !e2 && confirmar) ({ error: e3 } = await supabase.rpc('confirmar_factura', { p_factura: id }));
    setSaving(false);
    const err = e1 || e2 || e3;
    if (err) { setError(err.message); return; }
    onDone(confirmar ? 'Factura confirmada: los precios ya alimentan el cotizador' : 'Cambios guardados');
  };
  const descartar = async () => {
    if (!window.confirm('¿Descartar esta factura? Sus precios no se usarán.')) return;
    const { error } = await supabase.from('facturas_compra').update({ estado: 'descartada' }).eq('id', id);
    if (error) setError(error.message); else onDone('Factura descartada');
  };

  const sinInsumo = items.filter(i => !i.insumo_id).length;
  return (
    <div className="z-drawer-wrap" onMouseDown={onClose}>
      <div className="z-drawer" style={{ width: 'min(880px, 100vw)' }} onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Revisar factura">
        <div className="z-drawer-head">
          <h2 className="text-[17px] flex-1 truncate">{f ? `${f.proveedores?.nombre || 'Proveedor'} · ${f.tipo_comprobante || ''} ${f.punto_venta || ''}-${f.numero || ''}` : 'Factura'}</h2>
          {url && <a className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noreferrer"><Icon name="open_in_new" />Ver original</a>}
          <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        {!f ? <Spinner /> : <>
          <div className="z-drawer-body grid gap-5">
            {f.alertas?.length > 0 && (
              <div className="rounded-lg px-4 py-3 text-[13px] grid gap-1" style={{ background: 'rgb(var(--z-warning-c) / 0.1)', border: '1px solid rgb(var(--z-warning-c) / 0.3)' }}>
                {f.alertas.map((a, i) => <div key={i} className="flex gap-2"><Icon name="warning" size={16} color="rgb(var(--z-warning-c))" />{a}</div>)}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
              <Dato l="CUIT proveedor" v={f.proveedores?.cuit} />
              <div className="z-field"><label>Fecha</label><input type="date" value={f.fecha || ''} onChange={e => setF({ ...f, fecha: e.target.value })} disabled={f.estado !== 'pendiente'} /></div>
              <Dato l="CAE" v={f.cae} />
              <Dato l="Condición de pago" v={f.condicion_pago} />
              <Dato l="Neto gravado" v={$(f.neto_gravado)} />
              <Dato l="IVA" v={$(Number(f.iva_21 || 0) + Number(f.iva_105 || 0))} />
              <Dato l="Percepciones / otros" v={$(Number(f.percepciones || 0) + Number(f.otros_impuestos || 0))} />
              <Dato l="Total" v={<b className="text-z-ink">{$(f.total)}</b>} />
              <Dato l="Dólar oficial del día" v={f.tc_usd ? $(f.tc_usd) : '—'} />
              <div className="z-field"><label>Comprada a nombre de</label>
                <select value={f.a_nombre_de} onChange={e => setF({ ...f, a_nombre_de: e.target.value })} disabled={f.estado !== 'pendiente'}>
                  <option value="zebrano">Zebrano (VETCOM SAS)</option><option value="cliente">Cliente ({f.comprador_nombre || '?'})</option>
                </select></div>
              <div className="z-field col-span-2"><label>Proyecto</label>
                <select value={f.proyecto_id || ''} onChange={e => setF({ ...f, proyecto_id: e.target.value })}>
                  <option value="">Stock general / sin asignar</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.clientes?.nombre || 'Sin nombre'} · {p.estado}</option>)}
                </select></div>
            </div>

            <div>
              <div className="flex items-center mb-2"><h3 className="text-[14px] font-semibold flex-1">Renglones</h3>
                {sinInsumo > 0 && <Badge tone="warning">{sinInsumo} sin insumo</Badge>}</div>
              <div className="overflow-auto border rounded-lg" style={{ borderColor: 'var(--z-line)' }}>
                <table className="w-full text-[13px]">
                  <thead><tr><th>Código</th><th>Descripción</th><th className="text-right">Cant.</th><th className="text-right">Lista</th><th className="text-right">Dto.</th><th className="text-right">Neto unit.</th><th>Insumo del catálogo</th></tr></thead>
                  <tbody>{items.map((it, i) => (
                    <tr key={it.id}>
                      <td className="tabular-nums">{it.codigo_proveedor || '—'}</td>
                      <td className="min-w-[180px]">{it.descripcion}</td>
                      <td className="text-right tabular-nums">{it.cantidad} {it.unidad}</td>
                      <td className="text-right tabular-nums">{$(it.precio_lista_unit)}</td>
                      <td className="text-right tabular-nums">{it.descuento_pct ? `${it.descuento_pct}%` : '—'}</td>
                      <td className="text-right"><input type="number" step="0.01" className="w-[110px] text-right" value={it.precio_neto_unit ?? ''} onChange={e => setItem(i, 'precio_neto_unit', e.target.value === '' ? null : Number(e.target.value))} disabled={f.estado !== 'pendiente'} aria-label="Neto unitario" /></td>
                      <td className="min-w-[220px]">
                        <div className="flex gap-1">
                          <select value={it.insumo_id || ''} onChange={e => setItem(i, 'insumo_id', e.target.value)} disabled={f.estado !== 'pendiente'} aria-label="Insumo">
                            <option value="">— Elegir —</option>
                            {insumos.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                          {f.estado === 'pendiente' && <button className="btn btn-quiet btn-icon" title="Crear insumo nuevo" onClick={() => nuevoInsumo(i)} aria-label="Crear insumo"><Icon name="add" /></button>}
                        </div>
                      </td>
                    </tr>))}</tbody>
                </table>
              </div>
              <p className="text-[12px] text-z-ink-3 mt-2">Al confirmar, Zebrano recuerda qué insumo es cada código de este proveedor y la próxima factura lo asigna sola.</p>
            </div>
            <div className="z-field"><label>Notas</label><textarea rows={2} value={f.notas || ''} onChange={e => setF({ ...f, notas: e.target.value })} /></div>
            {error && <div role="alert" className="text-[13px]" style={{ color: 'rgb(var(--z-danger-c))' }}>{error}</div>}
          </div>
          <div className="z-drawer-foot">
            {f.estado === 'pendiente' ? <>
              <button className="btn btn-quiet mr-auto" onClick={descartar} disabled={saving}>Descartar</button>
              <button className="btn btn-secondary" onClick={() => guardar(false)} disabled={saving}>Guardar</button>
              <button className="btn btn-primary" onClick={() => guardar(true)} disabled={saving}><Icon name="task_alt" />Confirmar factura</button>
            </> : <>
              <Badge tone={f.estado === 'confirmada' ? 'success' : 'neutral'}>{f.estado}</Badge>
              <button className="btn btn-secondary" onClick={() => guardar(false)} disabled={saving}>Guardar proyecto y notas</button>
            </>}
          </div>
        </>}
      </div>
    </div>
  );
}

const Dato = ({ l, v }) => <div><div className="text-[12px] text-z-ink-3 mb-1">{l}</div><div className="tabular-nums">{v || '—'}</div></div>;
