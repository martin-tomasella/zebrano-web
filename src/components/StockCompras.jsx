import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Badge, EmptyState, Spinner } from './ui';

// F3: lo que necesita cada OT contra el stock. El usuario decide si compra o usa stock;
// "Usar" descuenta el stock (ot_consumir_necesidad). Las facturas con insumo identificado suman solas.
const n = v => Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function Necesidades({ otId }) {
  const [rows, setRows] = useState(null);
  const [stock, setStock] = useState({});
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    let q = supabase.from('ot_necesidades').select('*, ordenes_trabajo(numero_ot, estado)').order('origen').order('descripcion');
    q = otId ? q.eq('ot_id', otId) : q.neq('estado', 'consumido');
    const [a, b] = await Promise.all([q, supabase.from('stock_actual').select('insumo_id,disponible,reservado')]);
    setRows(a.data || []); setStock(Object.fromEntries((b.data || []).map(s => [s.insumo_id, s])));
  }, [otId]);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (fn) => { setError(''); const { error } = await fn(); if (error) setError(error.message); cargar(); };
  const decidir = (r, decision) => accion(() => supabase.from('ot_necesidades').update({ decision: decision || null, estado: decision === 'comprar' ? 'pedido' : 'pendiente' }).eq('id', r.id));
  const usar = r => accion(() => supabase.rpc('ot_consumir_necesidad', { p_id: r.id }));

  if (!rows) return <Spinner />;
  if (!rows.length) return <EmptyState icon="inventory_2" title={otId ? 'Esta OT no tiene necesidades calculadas' : 'No hay necesidades pendientes'}>Se calculan solas cuando se aprueba una cotización.</EmptyState>;
  const faltan = rows.filter(r => r.estado !== 'consumido' && (stock[r.insumo_id]?.disponible || 0) < r.cantidad);
  return (
    <>
      {error && <p role="alert" style={{ color: 'rgb(var(--z-danger-c))' }}>{error}</p>}
      <p className="text-[12.5px] text-z-ink-3 mb-2">{faltan.length ? `${faltan.length} renglón${faltan.length > 1 ? 'es' : ''} sin stock suficiente.` : 'Todo se puede cubrir con stock.'} Elegí si se compra o se usa stock; al usarlo se descuenta.</p>
      <div className="card overflow-auto">
        <table className="w-full text-[13px]">
          <thead><tr>{!otId && <th>OT</th>}<th>Insumo</th><th className="text-right">Necesita</th><th className="text-right">En stock</th><th>Decisión</th><th>Estado</th><th /></tr></thead>
          <tbody>{rows.map(r => {
            const s = stock[r.insumo_id], disp = Number(s?.disponible || 0), alcanza = disp >= Number(r.cantidad);
            return (
              <tr key={r.id}>
                {!otId && <td className="whitespace-nowrap">{r.ordenes_trabajo?.numero_ot}</td>}
                <td>{r.descripcion}{!r.insumo_id && <> <Badge tone="warning">sin insumo</Badge></>}</td>
                <td className="text-right tabular-nums">{n(r.cantidad)} {r.unidad}</td>
                <td className="text-right tabular-nums" style={{ color: alcanza ? undefined : 'rgb(var(--z-danger-c))' }}>{r.insumo_id ? n(disp) : '—'}</td>
                <td>
                  <select value={r.decision || ''} disabled={r.estado === 'consumido'} onChange={e => decidir(r, e.target.value)} aria-label={`Decisión para ${r.descripcion}`}>
                    <option value="">Decidir…</option><option value="comprar">Comprar</option><option value="stock">Usar stock</option>
                  </select>
                </td>
                <td><Badge tone={r.estado === 'consumido' ? 'success' : r.estado === 'pedido' ? 'info' : 'warning'}>{r.estado === 'pedido' ? 'A comprar' : r.estado}</Badge></td>
                <td>{r.estado !== 'consumido' && r.insumo_id && <button className="btn btn-secondary btn-sm" disabled={!alcanza} title={alcanza ? 'Descontar del stock' : 'No hay stock suficiente'} onClick={() => usar(r)}>Usar</button>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </>
  );
}

export function Stock() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [ajuste, setAjuste] = useState({});
  const cargar = () => supabase.from('stock_actual').select('*').order('categoria').order('nombre').then(({ data }) => setRows(data || []));
  useEffect(() => { cargar(); }, []);
  const ajustar = async (r) => {
    const real = Number(ajuste[r.insumo_id]);
    if (ajuste[r.insumo_id] === '' || ajuste[r.insumo_id] == null || Number.isNaN(real)) return;
    const dif = real - Number(r.disponible);
    if (dif) await supabase.from('stock_movimientos').insert({ insumo_id: r.insumo_id, cantidad: dif, tipo: 'ajuste', notas: `Conteo: ${real}` });
    setAjuste(a => ({ ...a, [r.insumo_id]: '' })); cargar();
  };
  if (!rows) return <Spinner />;
  const vis = rows.filter(r => !q || r.nombre.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <p className="text-[12.5px] text-z-ink-3 mb-2">Entra con las facturas de compra (desde el 10/11/2026), sale cuando una OT usa stock y se corrige con el conteo físico: cargá lo que hay y se registra la diferencia.</p>
      <input className="mb-3" placeholder="Buscar insumo…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar insumo" style={{ maxWidth: 320 }} />
      <div className="card overflow-auto">
        <table className="w-full text-[13px]">
          <thead><tr><th>Insumo</th><th>Categoría</th><th className="text-right">Disponible</th><th className="text-right">Reservado OT</th><th>Conteo físico</th></tr></thead>
          <tbody>{vis.map(r => (
            <tr key={r.insumo_id}>
              <td>{r.nombre}</td><td>{r.categoria}</td>
              <td className="text-right tabular-nums">{n(r.disponible)} {r.unidad}</td>
              <td className="text-right tabular-nums">{Number(r.reservado) ? n(r.reservado) : '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <input type="number" min={0} style={{ width: 80 }} value={ajuste[r.insumo_id] ?? ''} onChange={e => setAjuste(a => ({ ...a, [r.insumo_id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && ajustar(r)} aria-label={`Conteo de ${r.nombre}`} />
                <button className="btn btn-quiet btn-sm" onClick={() => ajustar(r)}>Guardar</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
