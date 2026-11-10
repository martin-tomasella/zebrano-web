import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Card, SectionTitle, Spinner, Badge } from './ui';

// F4: horas por etapa × personas de cada OT de la cola y fechas de fin recalculadas.
// ponytail: el taller hace una OT por vez y las etapas van en serie (jornada de 7 h, lunes a viernes);
// si se trabajan varias OT en paralelo, pasar a capacidad por persona.
const JORNADA = 7;
const ETAPA = { corte: 'Corte', canteado: 'Canteado', armado: 'Armado', terminacion: 'Terminación', instalacion: 'Instalación' };

export function sumarHorasHabiles(desde, horas) {
  const d = new Date(desde); d.setHours(0, 0, 0, 0);
  let resto = horas;
  const habil = x => x.getDay() !== 0 && x.getDay() !== 6;
  while (!habil(d)) d.setDate(d.getDate() + 1);
  while (resto > JORNADA) { resto -= JORNADA; do d.setDate(d.getDate() + 1); while (!habil(d)); }
  return d;
}
const iso = d => d.toISOString().slice(0, 10);
const f = d => d ? new Date(d + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';

export function planificar(ots, etapas, hoy = new Date()) {
  let cursor = new Date(hoy), resto = 0; // horas ya usadas del día en curso
  return ots.map(o => {
    const es = etapas.filter(e => e.ot_id === o.id).sort((a, b) => a.orden - b.orden);
    const pend = 1 - (Number(o.avance_pct) || 0) / 100;
    const dur = es.length ? es.reduce((a, e) => a + Number(e.horas_persona) / Math.max(1, e.personas), 0) * pend : null;
    if (dur == null) { // sin etapas: se respeta la fecha que tenga
      const fin = o.fecha_entrega_estimada || null;
      if (fin && new Date(fin) > cursor) { cursor = new Date(fin + 'T12:00'); cursor.setDate(cursor.getDate() + 1); resto = 0; }
      return { ot: o, etapas: es, dur: null, inicio: null, fin };
    }
    const inicio = sumarHorasHabiles(cursor, resto + 0.01);
    const total = resto + dur, fin = sumarHorasHabiles(cursor, total);
    resto = total % JORNADA; cursor = new Date(fin); if (resto === 0) { cursor.setDate(cursor.getDate() + 1); }
    return { ot: o, etapas: es, dur, inicio: iso(inicio), fin: iso(fin) };
  });
}

export default function PlanCola() {
  const [ots, setOts] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [reales, setReales] = useState({});
  const cargar = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('ordenes_trabajo').select('id,numero_ot,estado,prioridad,avance_pct,iniciada_at,created_at,fecha_entrega_estimada,proyectos(nombre,clientes(nombre))')
        .in('estado', ['pendiente', 'en_proceso']).or('historica.is.null,historica.eq.false'),
      supabase.from('ot_etapas').select('*'),
      supabase.from('horas_trabajo_ot').select('ot_id,etapa,horas'),
    ]);
    const orden = (x, y) => (x.estado === 'en_proceso' ? 0 : 1) - (y.estado === 'en_proceso' ? 0 : 1)
      || (x.estado === 'en_proceso' ? String(x.iniciada_at).localeCompare(String(y.iniciada_at)) : (x.prioridad ?? 1e9) - (y.prioridad ?? 1e9) || x.created_at.localeCompare(y.created_at));
    setOts((a.data || []).sort(orden)); setEtapas(b.data || []);
    const r = {}; for (const h of c.data || []) { const k = `${h.ot_id}|${h.etapa}`; r[k] = (r[k] || 0) + Number(h.horas || 0); } setReales(r);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const plan = ots ? planificar(ots, etapas) : [];
  // Guarda la fecha de fin recalculada en las OT que tienen etapas.
  useEffect(() => {
    if (!ots) return;
    plan.filter(p => p.dur != null && p.fin !== p.ot.fecha_entrega_estimada)
      .forEach(p => supabase.from('ordenes_trabajo').update({ fecha_entrega_estimada: p.fin }).eq('id', p.ot.id).then(() => { p.ot.fecha_entrega_estimada = p.fin; }));
  }, [ots, etapas]);

  const cambiarPersonas = async (e, personas) => {
    personas = Math.max(1, Math.min(20, Number(personas) || 1));
    setEtapas(es => es.map(x => x.id === e.id ? { ...x, personas } : x));
    await supabase.from('ot_etapas').update({ personas }).eq('id', e.id);
  };

  if (!ots) return <Spinner />;
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionTitle>Planificación de la cola</SectionTitle>
      <p className="text-[12.5px] text-z-ink-3 mb-3">Cada etapa tiene sus horas-persona; si cambiás cuántas personas trabajan, cambia la duración y se recalculan la fecha de fin de esa OT y de las que siguen (jornada de 7 h, lunes a viernes, una OT por vez).</p>
      {plan.length === 0 && <p>No hay órdenes en cola.</p>}
      {plan.map(p => (
        <div key={p.ot.id} className="mb-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <b className="text-z-ink">{p.ot.numero_ot}</b>
            <span className="text-[12.5px] text-z-ink-3">{p.ot.proyectos?.clientes?.nombre} · {p.ot.proyectos?.nombre}</span>
            <Badge tone={p.ot.estado === 'en_proceso' ? 'info' : 'warning'}>{p.ot.estado === 'en_proceso' ? 'En taller' : 'En cola'}</Badge>
            <span className="ml-auto text-[13px] tabular-nums">{p.dur != null ? `${p.dur.toFixed(1)} h · ${f(p.inicio)} → ` : ''}fin <b>{f(p.fin)}</b></span>
          </div>
          {p.etapas.length > 0 ? (
            <table className="w-full text-[12.5px] mt-1">
              <thead><tr><th>Etapa</th><th className="text-right">Horas-persona</th><th>Personas</th><th className="text-right">Duración</th><th className="text-right">Reales</th></tr></thead>
              <tbody>{p.etapas.map(e => {
                const real = reales[`${p.ot.id}|${e.etapa}`] || 0;
                return (
                  <tr key={e.id}>
                    <td>{ETAPA[e.etapa] || e.etapa}</td>
                    <td className="text-right tabular-nums">{Number(e.horas_persona).toFixed(1)}</td>
                    <td><input type="number" min={1} max={20} value={e.personas} style={{ width: 60 }} onChange={ev => cambiarPersonas(e, ev.target.value)} aria-label={`Personas en ${e.etapa} de ${p.ot.numero_ot}`} /></td>
                    <td className="text-right tabular-nums">{(Number(e.horas_persona) / e.personas).toFixed(1)} h</td>
                    <td className="text-right tabular-nums" style={{ color: real > Number(e.horas_persona) ? 'rgb(var(--z-danger-c))' : undefined }}>{real ? `${real.toFixed(1)} h-p` : '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          ) : <p className="text-[12.5px] text-z-ink-3">Sin horas por etapa (OT cargada a mano): se toma su fecha de entrega.</p>}
        </div>
      ))}
    </Card>
  );
}
