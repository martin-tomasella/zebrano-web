import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Badge, Spinner } from './ui';

// F5: obras del cliente con sus trabajos, cotizaciones (versiones, descuento, ARS y USD) y cobros.
const $ = v => v == null || v === '' ? '—' : '$' + Math.round(Number(v)).toLocaleString('es-AR');
const usd = v => v == null ? '—' : 'USD ' + Math.round(Number(v)).toLocaleString('es-AR');
const fecha = d => d ? new Date(String(d).slice(0, 10) + 'T12:00').toLocaleDateString('es-AR') : '—';

export default function FichaCliente({ cliente, trabajos }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    setD(null);
    Promise.all([
      supabase.from('obras').select('id,nombre,direccion').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('cotizacion_sesiones').select('id,created_at,tipo_trabajo,ambiente,version,estado,precio_aprobado,proyecto_id,cotizacion_resumen(precio_sugerido,precio_final,precio_usd,tc_usd,pdf_presupuesto_url)').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('pagos').select('monto,moneda,estado,fecha_recibido,concepto').eq('cliente_id', cliente.id),
      supabase.from('tipos_cambio').select('fecha,oficial_venta').order('fecha'),
    ]).then(([o, s, p, t]) => setD({ obras: o.data || [], cot: s.data || [], pagos: p.data || [], tc: t.data || [] }));
  }, [cliente.id]);
  if (!d) return <Spinner pad={20} />;

  // Tipo de cambio oficial del día (o el último anterior) para pasar a USD lo cotizado antes del 10/11.
  const tcDe = f => { if (!f) return null; let r = null; for (const t of d.tc) { if (t.fecha <= String(f).slice(0, 10)) r = t; else break; } return r ? Number(r.oficial_venta) : null; };
  const valor = p => Number(p.valor_final || p.valor_estimado || 0);
  const usdDe = p => { const t = tcDe(p.fecha_cotizado || p.fecha_creacion); return t && valor(p) ? valor(p) / t : null; };
  const grupos = [...d.obras.map(o => ({ ...o, trabajos: trabajos.filter(t => t.obra_id === o.id) })), { id: null, nombre: 'Sin obra', trabajos: trabajos.filter(t => !t.obra_id) }].filter(g => g.id || g.trabajos.length);
  const cobrado = d.pagos.filter(p => p.estado !== 'pendiente' && (p.moneda || 'ARS') === 'ARS').reduce((a, p) => a + Number(p.monto || 0), 0);
  const vendido = trabajos.filter(t => !['cancelado', 'prospecto', 'cotizado'].includes(t.estado)).reduce((a, t) => a + valor(t), 0);

  return (
    <div className="px-8 pb-6">
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <Link className="btn btn-primary btn-sm" to={`/cotizador/nuevo?cliente=${cliente.id}`}><span className="material-symbols-outlined">add</span>Nuevo trabajo</Link>
        <span className="text-[12.5px] text-z-ink-3">Vendido {$(vendido)} · cobrado {$(cobrado)} · saldo <b className="text-z-ink">{$(vendido - cobrado)}</b></span>
      </div>

      <h3 className="font-mono text-[11.5px] text-z-ink-3 mb-2">Obras ({d.obras.length})</h3>
      {grupos.map(g => (
        <div key={g.id || 'sin'} className="bg-z-surface border border-z-line rounded-lg p-4 mb-3">
          <div className="flex flex-wrap items-baseline gap-x-3 mb-2">
            <b className="text-z-ink">{g.nombre}</b>{g.direccion && <span className="text-[12px] text-z-ink-3">{g.direccion}</span>}
            <span className="ml-auto text-[12.5px] tabular-nums">{$(g.trabajos.reduce((a, t) => a + valor(t), 0))}</span>
            {g.id && <Link className="btn btn-quiet btn-sm" to={`/cotizador/nuevo?cliente=${cliente.id}&obra=${g.id}`}>+ Trabajo</Link>}
          </div>
          {g.trabajos.length === 0 ? <p className="text-[12px] text-z-ink-4 m-0">Sin trabajos todavía.</p> : (
            <table className="w-full text-[12.5px]"><tbody>{g.trabajos.map(t => (
              <tr key={t.id}><td>{t.nombre || t.tipo_trabajo}</td><td><Badge value={t.estado} /></td><td className="whitespace-nowrap">{fecha(t.fecha_cotizado || t.fecha_creacion)}</td>
                <td className="text-right tabular-nums">{$(valor(t))}</td><td className="text-right tabular-nums text-z-ink-3">{usd(usdDe(t))}</td></tr>
            ))}</tbody></table>
          )}
        </div>
      ))}

      <h3 className="font-mono text-[11.5px] text-z-ink-3 mt-6 mb-2">Cotizaciones ({d.cot.length})</h3>
      {d.cot.length === 0 ? <p className="text-[12px] text-z-ink-4">Sin cotizaciones del cotizador para este cliente.</p> : (
        <div className="overflow-auto"><table className="w-full text-[12.5px]">
          <thead><tr><th>Fecha</th><th>Trabajo</th><th>Versión</th><th className="text-right">Precio</th><th className="text-right">Cerrado</th><th className="text-right">Descuento</th><th className="text-right">USD</th><th>Estado</th><th /></tr></thead>
          <tbody>{d.cot.map(s => {
            const r = Array.isArray(s.cotizacion_resumen) ? s.cotizacion_resumen[0] : s.cotizacion_resumen;
            const lista = Number(r?.precio_sugerido || 0), cierre = Number(s.precio_aprobado || r?.precio_final || 0);
            const desc = lista && cierre && cierre < lista ? Math.round((1 - cierre / lista) * 100) : null;
            const enUsd = r?.precio_usd ?? (lista && tcDe(s.created_at) ? lista / tcDe(s.created_at) : null);
            return (
              <tr key={s.id}>
                <td className="whitespace-nowrap">{fecha(s.created_at)}</td><td>{[s.tipo_trabajo, s.ambiente].filter(Boolean).join(' · ') || '—'}</td><td>v{s.version || 1}</td>
                <td className="text-right tabular-nums">{$(lista || null)}</td><td className="text-right tabular-nums">{cierre ? $(cierre) : '—'}</td>
                <td className="text-right tabular-nums">{desc != null ? `${desc}%` : '—'}</td><td className="text-right tabular-nums">{usd(enUsd)}</td>
                <td><Badge value={s.estado} /></td>
                <td>{r?.pdf_presupuesto_url && <PdfLink path={r.pdf_presupuesto_url} />}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}

// El presupuesto está en el bucket privado "documentos": se abre con un link firmado de 10 minutos.
function PdfLink({ path }) {
  const abrir = async () => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };
  return <button className="btn btn-quiet btn-sm" onClick={abrir} aria-label="Abrir presupuesto"><span className="material-symbols-outlined">picture_as_pdf</span></button>;
}
