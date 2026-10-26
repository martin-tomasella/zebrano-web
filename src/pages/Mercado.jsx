import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Badge, Spinner, EmptyState } from '../components/ui';

const $ = n => n == null ? '—' : (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-AR');
const TONO = { competimos: 'success', 'margen bajo': 'warning', 'no competimos': 'danger', 'sin equivalente': 'neutral' };

export default function Mercado() {
  const [rows, setRows] = useState(null);
  const [hist, setHist] = useState({});
  const [cat, setCat] = useState('todas');
  const [q, setQ] = useState('');
  const [ver, setVer] = useState('todos');
  const [marca, setMarca] = useState('');
  const [pmin, setPmin] = useState('');
  const [pmax, setPmax] = useState('');
  const [orden, setOrden] = useState('categoria');
  const [abierto, setAbierto] = useState(null);
  const [rel, setRel] = useState(null);
  const [relevando, setRelevando] = useState(false);

  useEffect(() => {
    supabase.from('mercado_comparacion').select('*').order('categoria').order('precio_mercado', { ascending: false })
      .then(({ data }) => setRows(data || []));
    supabase.from('zebrano_contexto').select('valor').eq('clave', 'mercado_relevamiento').maybeSingle().then(({ data }) => setRel(data?.valor || null));
  }, []);
  const relevarAhora = async () => {
    setRelevando(true);
    await supabase.rpc('relevar_mercado_ahora');
    setTimeout(async () => {
      const { data } = await supabase.from('zebrano_contexto').select('valor').eq('clave', 'mercado_relevamiento').maybeSingle();
      setRel(data?.valor || null); setRelevando(false);
      const { data: r } = await supabase.from('mercado_comparacion').select('*').order('categoria').order('precio_mercado', { ascending: false }); setRows(r || []);
    }, 25000);
  };
  const verHistorial = async id => {
    setAbierto(abierto === id ? null : id);
    if (hist[id]) return;
    const { data } = await supabase.from('mercado_precios').select('fecha,precio,precio_min_90d,precio_max_90d,precio_min_vendedores,precio_max_vendedores,vendedores,fuente').eq('producto_id', id).order('fecha', { ascending: false });
    setHist(h => ({ ...h, [id]: data || [] }));
  };

  const cats = useMemo(() => ['todas', ...new Set((rows || []).map(r => r.categoria))], [rows]);
  const marcas = useMemo(() => [...new Set((rows || []).map(r => r.marca).filter(Boolean))].sort(), [rows]);
  const ORDEN = {
    categoria: (a, b) => a.categoria.localeCompare(b.categoria) || b.precio_mercado - a.precio_mercado,
    margen: (a, b) => (b.margen_real_pct ?? -999) - (a.margen_real_pct ?? -999),
    precio_asc: (a, b) => a.precio_mercado - b.precio_mercado,
    precio_desc: (a, b) => b.precio_mercado - a.precio_mercado,
  };
  const lista = (rows || []).filter(r => (cat === 'todas' || r.categoria === cat)
    && (ver === 'todos' || r.veredicto === ver)
    && (!marca || r.marca === marca)
    && (!pmin || r.precio_mercado >= Number(pmin)) && (!pmax || r.precio_mercado <= Number(pmax))
    && (!q || `${r.titulo} ${r.marca} ${r.ext_id}`.toLowerCase().includes(q.toLowerCase()))).sort(ORDEN[orden]);
  const limpiar = () => { setCat('todas'); setVer('todos'); setMarca(''); setPmin(''); setPmax(''); setQ(''); };
  const ultima = rows?.reduce((m, r) => r.fecha > m ? r.fecha : m, '') || '';

  return (
    <Layout>
      <Topbar title="Mercado" subtitle={`Precios de la competencia en Mercado Libre vs. nuestro costo · último relevamiento ${ultima ? new Date(ultima + 'T12:00').toLocaleDateString('es-AR') : '—'}`} />
      <PageContent>
        <div className="flex flex-wrap items-center gap-3 mb-3 text-[12.5px] text-z-ink-3">
          <span>Actualización automática: 1er y 3er lunes de cada mes.</span>
          {rel && <span style={{ color: rel.ok ? undefined : 'rgb(var(--z-danger-c))' }}>Último intento {new Date(rel.fecha).toLocaleString('es-AR')}: {rel.ok ? `${rel.actualizados} de ${rel.total} precios actualizados` : rel.error}</span>}
          {rel && !rel.ok && /no est. conectado/.test(rel.error || '') && <a className="underline font-medium text-z-ink" href={`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/mercado-relevamiento?conectar=1`} target="_blank" rel="noreferrer">Conectar Mercado Libre</a>}
          <button className="btn btn-quiet btn-sm" onClick={relevarAhora} disabled={relevando}>{relevando ? 'Actualizando…' : 'Actualizar ahora'}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {cats.map(c => <button key={c} className="z-chip capitalize" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          <input className="ml-auto max-w-[260px]" placeholder="Buscar producto, marca o MLA…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" />
        </div>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="z-field"><label htmlFor="mk-v">Veredicto</label><select id="mk-v" value={ver} onChange={e => setVer(e.target.value)}><option value="todos">Todos</option>{Object.keys(TONO).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
          <div className="z-field"><label htmlFor="mk-m">Marca</label><select id="mk-m" value={marca} onChange={e => setMarca(e.target.value)}><option value="">Todas</option>{marcas.map(m => <option key={m}>{m}</option>)}</select></div>
          <div className="z-field"><label htmlFor="mk-pmin">Precio desde</label><input id="mk-pmin" type="number" className="w-[130px]" value={pmin} onChange={e => setPmin(e.target.value)} /></div>
          <div className="z-field"><label htmlFor="mk-pmax">hasta</label><input id="mk-pmax" type="number" className="w-[130px]" value={pmax} onChange={e => setPmax(e.target.value)} /></div>
          <div className="z-field"><label htmlFor="mk-o">Ordenar</label><select id="mk-o" value={orden} onChange={e => setOrden(e.target.value)}><option value="categoria">Categoría</option><option value="margen">Mejor margen</option><option value="precio_asc">Precio menor</option><option value="precio_desc">Precio mayor</option></select></div>
          <span className="text-[13px] text-z-ink-3 pb-2">{lista.length} de {rows?.length || 0}</span>
          <button className="btn btn-quiet btn-sm mb-1" onClick={limpiar}>Limpiar filtros</button>
        </div>
        <p className="text-[12.5px] text-z-ink-3 mb-3">
          "Te queda en ML" = precio − IVA − comisión − costo fijo − envío propio − ingresos brutos − débitos/créditos (se ajustan en Cotizar por módulos → Parámetros). "Nuestro costo" = material + horas × costo hora + gastos fijos prorrateados, sin instalación. Margen real sobre precio sin IVA: 20% o más competimos; 5–20% margen bajo.
        </p>
        {!rows ? <Spinner /> : (
          <div className="card overflow-auto">
            <table className="w-full text-[13px]">
              <thead><tr><th>Producto</th><th>Marca</th><th className="text-right">Precio ML</th><th className="text-right">Sin IVA</th><th className="text-right">Te queda en ML</th><th className="text-right">Nuestro costo</th><th className="text-right">Margen real</th><th>Veredicto</th><th /></tr></thead>
              <tbody>
                {lista.length === 0 ? <tr><td colSpan={9}><EmptyState icon="storefront" title="Sin productos relevados" /></td></tr> : lista.map(r => (
                  <FilaMercado key={r.id} r={r} abierto={abierto === r.id} hist={hist[r.id]} onHist={() => verHistorial(r.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContent>
    </Layout>
  );
}

function FilaMercado({ r, abierto, hist, onHist }) {
  return <>
    <tr>
      <td className="min-w-[240px]">
        <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-z-ink hover:underline">{r.titulo}</a>
        <div className="text-[11.5px] text-z-ink-3">{r.ext_id}{r.medidas ? ` · ${r.medidas}` : ''}{r.modulo ? ` · comparado con ${r.ml_equiv} ml de ${r.modulo}` : ''}</div>
      </td>
      <td>{r.marca || '—'}</td>
      <td className="text-right tabular-nums font-medium text-z-ink">{$(r.precio_mercado)}</td>
      <td className="text-right tabular-nums">{$(r.precio_mercado_neto)}</td>
      <td className="text-right tabular-nums">{$(r.ml_ingreso_neto)}</td>
      <td className="text-right tabular-nums" title={r.nuestro_costo ? `Material ${$(r.nuestro_material)} + MO ${$(r.nuestra_mo)} + estructura ${$(r.nuestra_estructura)}` : ''}>{$(r.nuestro_costo)}</td>
      <td className="text-right tabular-nums whitespace-nowrap" style={{ color: r.margen_real < 0 ? 'rgb(var(--z-danger-c))' : undefined }}>{r.margen_real != null ? `${$(r.margen_real)} · ${r.margen_real_pct}%` : '—'}</td>
      <td><Badge tone={TONO[r.veredicto]}>{r.veredicto}</Badge></td>
      <td className="whitespace-nowrap">
        <button className="btn btn-quiet btn-icon" onClick={onHist} aria-label="Historial de precios" title="Historial de precios"><Icon name="history" /></button>
        <a className="btn btn-quiet btn-icon" href={r.url_historial} target="_blank" rel="noreferrer" aria-label="Seguimiento de precio" title="Seguimiento de precio"><Icon name="query_stats" /></a>
      </td>
    </tr>
    {abierto && <tr><td colSpan={9} style={{ background: 'var(--z-subtle)' }}>
      {!hist ? 'Cargando…' : <div className="flex flex-wrap gap-4 text-[12.5px]">{hist.map(h => (
        <span key={h.fecha} className="tabular-nums">{new Date(h.fecha + 'T12:00').toLocaleDateString('es-AR')}: <b>{$(h.precio)}</b>{h.precio_min_vendedores ? ` (entre vendedores: ${$(h.precio_min_vendedores)} – ${$(h.precio_max_vendedores)})` : h.precio_min_90d ? ` (90 días: ${$(h.precio_min_90d)} – ${$(h.precio_max_90d)})` : ''}{h.fuente === 'ml_api' ? ' · API ML' : ''}{h.vendedores ? ` · ${h.vendedores} vendedores` : ''}</span>
      ))}</div>}
    </td></tr>}
  </>;
}
