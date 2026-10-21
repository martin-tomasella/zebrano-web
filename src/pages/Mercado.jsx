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
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    supabase.from('mercado_comparacion').select('*').order('categoria').order('precio_mercado', { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, []);
  const verHistorial = async id => {
    setAbierto(abierto === id ? null : id);
    if (hist[id]) return;
    const { data } = await supabase.from('mercado_precios').select('fecha,precio,precio_min_90d,precio_max_90d,vendedores').eq('producto_id', id).order('fecha', { ascending: false });
    setHist(h => ({ ...h, [id]: data || [] }));
  };

  const cats = useMemo(() => ['todas', ...new Set((rows || []).map(r => r.categoria))], [rows]);
  const lista = (rows || []).filter(r => (cat === 'todas' || r.categoria === cat) && (!q || `${r.titulo} ${r.marca} ${r.ext_id}`.toLowerCase().includes(q.toLowerCase())));
  const ultima = rows?.reduce((m, r) => r.fecha > m ? r.fecha : m, '') || '';

  return (
    <Layout>
      <Topbar title="Mercado" subtitle={`Precios de la competencia en Mercado Libre vs. nuestro costo · último relevamiento ${ultima ? new Date(ultima + 'T12:00').toLocaleDateString('es-AR') : '—'}`} />
      <PageContent>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {cats.map(c => <button key={c} className="z-chip capitalize" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          <input className="ml-auto max-w-[260px]" placeholder="Buscar producto, marca o MLA…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar" />
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
        <span key={h.fecha} className="tabular-nums">{new Date(h.fecha + 'T12:00').toLocaleDateString('es-AR')}: <b>{$(h.precio)}</b>{h.precio_min_90d ? ` (90 días: ${$(h.precio_min_90d)} – ${$(h.precio_max_90d)})` : ''}{h.vendedores ? ` · ${h.vendedores} vendedores` : ''}</span>
      ))}</div>}
    </td></tr>}
  </>;
}
