import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Badge, Spinner, EmptyState } from '../components/ui';

const $ = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR');
const ETAPAS = [['corte', 'Corte'], ['canteado', 'Canteado'], ['armado', 'Armado'], ['terminacion', 'Laqueado / lustre'], ['instalacion', 'Instalación']];
const fechaLarga = d => d ? new Date(d + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
const fila = tipo => ({ key: crypto.randomUUID(), modulo_tipo_id: tipo || '', ml: '', cantidad: 1, con_terminacion: false, con_instalacion: true, descripcion: '' });

export default function CotizadorModular() {
  const [tab, setTab] = useState('cotizar');
  const [tipos, setTipos] = useState([]);
  useEffect(() => { supabase.from('modulo_tipos').select('*').eq('activo', true).order('nombre').then(({ data }) => setTipos(data || [])); }, [tab]);
  return (
    <Layout>
      <Topbar title="Cotizar por módulos" subtitle="Metros lineales → material, mano de obra, horas por etapa y fecha de entrega" />
      <PageContent>
        <div className="z-seg mb-5" role="group" aria-label="Sección">
          {[['cotizar', 'Cotizar'], ['plan', 'Plan de taller'], ['tipos', 'Tipos de módulo'], ['param', 'Parámetros']].map(([k, l]) =>
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === 'cotizar' && <Cotizar tipos={tipos} />}
        {tab === 'plan' && <Plan />}
        {tab === 'tipos' && <Tipos tipos={tipos} setTipos={setTipos} />}
        {tab === 'param' && <Parametros />}
      </PageContent>
    </Layout>
  );
}

function Cotizar({ tipos }) {
  const [filas, setFilas] = useState([fila()]);
  const [canal, setCanal] = useState('final');
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.from('proyectos').select('id,nombre,estado,clientes(nombre)').not('estado', 'in', '(entregado,cancelado)').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setProyectos(data || []));
  }, []);
  useEffect(() => {
    if (!proyectoId) return;
    supabase.from('cotizacion_modulos').select('*').eq('proyecto_id', proyectoId).order('orden').then(({ data }) => {
      if (data?.length) setFilas(data.map(d => ({ ...d, key: d.id })));
    });
  }, [proyectoId]);

  const validas = useMemo(() => filas.filter(f => f.modulo_tipo_id && Number(f.ml) > 0), [filas]);
  useEffect(() => {
    if (!validas.length) { setRes(null); return; }
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('cotizar_modulos', {
        p_modulos: validas.map(f => ({ modulo_tipo_id: f.modulo_tipo_id, ml: Number(f.ml), cantidad: Number(f.cantidad) || 1, con_terminacion: f.con_terminacion, con_instalacion: f.con_instalacion, descripcion: f.descripcion })),
        p_canal: canal, p_excluir_proyecto: proyectoId || null,
      });
      setErr(error?.message || ''); setRes(data);
    }, 350);
    return () => clearTimeout(t);
  }, [validas, canal, proyectoId]);

  const set = (i, k, v) => setFilas(fs => fs.map((f, j) => j === i ? { ...f, [k]: v } : f));
  const guardar = async () => {
    if (!proyectoId || !res) return;
    setMsg('Guardando…');
    const { error: e1 } = await supabase.from('cotizacion_modulos').delete().eq('proyecto_id', proyectoId);
    const { error: e2 } = e1 ? { error: e1 } : await supabase.from('cotizacion_modulos').insert(validas.map((f, i) => ({
      proyecto_id: proyectoId, modulo_tipo_id: f.modulo_tipo_id, ml: Number(f.ml), cantidad: Number(f.cantidad) || 1,
      con_terminacion: f.con_terminacion, con_instalacion: f.con_instalacion, descripcion: f.descripcion || null, orden: i })));
    const { error: e3 } = e2 ? { error: e2 } : await supabase.from('proyectos').update({ valor_estimado: res.precio_sin_iva, fecha_entrega_estimada: res.fecha_entrega_estimada }).eq('id', proyectoId);
    const hi = res.horas_por_etapa?.instalacion || 0;
    if (!e3) await supabase.from('ordenes_trabajo').update({ horas_fabricacion_estimadas: res.horas_total - hi, horas_instalacion_estimadas: hi, horas_estimadas: res.horas_total }).eq('proyecto_id', proyectoId);
    const e = e1 || e2 || e3;
    setMsg(e ? 'Error: ' + e.message : 'Guardado en el proyecto: valor estimado y fecha de entrega actualizados.');
  };

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
      <div className="card p-4 grid gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="z-field"><label htmlFor="cm-proy">Proyecto (opcional)</label>
            <select id="cm-proy" value={proyectoId} onChange={e => setProyectoId(e.target.value)}>
              <option value="">Cotización suelta</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.clientes?.nombre || p.nombre || 'Sin nombre'} · {p.estado}</option>)}
            </select></div>
          <div className="z-seg" role="group" aria-label="Canal">
            <button aria-pressed={canal === 'final'} onClick={() => setCanal('final')}>Cliente final</button>
            <button aria-pressed={canal === 'gremio'} onClick={() => setCanal('gremio')}>Gremio / constructora</button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead><tr><th>Módulo</th><th>Descripción</th><th className="text-right">ml</th><th className="text-right">Cant.</th><th>Laca/lustre</th><th>Instala</th><th className="text-right">Horas</th><th className="text-right">Material</th><th /></tr></thead>
            <tbody>{filas.map((f, i) => {
              const r = res?.modulos?.[validas.indexOf(f)];
              return (
                <tr key={f.key}>
                  <td className="min-w-[170px]"><select value={f.modulo_tipo_id} onChange={e => set(i, 'modulo_tipo_id', e.target.value)} aria-label="Tipo de módulo">
                    <option value="">Elegir…</option>{tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></td>
                  <td className="min-w-[140px]"><input value={f.descripcion || ''} onChange={e => set(i, 'descripcion', e.target.value)} placeholder="ej. pared heladera" aria-label="Descripción" /></td>
                  <td><input type="number" step="0.05" min="0" className="w-[80px] text-right" value={f.ml} onChange={e => set(i, 'ml', e.target.value)} aria-label="Metros lineales" /></td>
                  <td><input type="number" min="1" className="w-[64px] text-right" value={f.cantidad} onChange={e => set(i, 'cantidad', e.target.value)} aria-label="Cantidad" /></td>
                  <td className="text-center"><input type="checkbox" checked={f.con_terminacion} onChange={e => set(i, 'con_terminacion', e.target.checked)} aria-label="Laqueado o lustre" /></td>
                  <td className="text-center"><input type="checkbox" checked={f.con_instalacion} onChange={e => set(i, 'con_instalacion', e.target.checked)} aria-label="Con instalación" /></td>
                  <td className="text-right tabular-nums">{r?.horas ?? '—'}</td>
                  <td className="text-right tabular-nums">{r ? $(r.material) : '—'}</td>
                  <td><button className="btn btn-quiet btn-icon" onClick={() => setFilas(fs => fs.length > 1 ? fs.filter((_, j) => j !== i) : [fila()])} aria-label="Quitar módulo"><Icon name="delete" /></button></td>
                </tr>);
            })}</tbody>
          </table>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary" onClick={() => setFilas(fs => [...fs, fila()])}><Icon name="add" />Agregar módulo</button>
          {proyectoId && <button className="btn btn-primary ml-auto" onClick={guardar} disabled={!res}><Icon name="save" />Guardar en el proyecto</button>}
        </div>
        {msg && <div role="status" className="text-[13px] text-z-ink-2">{msg}</div>}
        {err && <div role="alert" className="text-[13px]" style={{ color: 'rgb(var(--z-danger-c))' }}>{err}</div>}
      </div>

      <div className="card p-5 grid gap-4 2xl:sticky 2xl:top-4">
        {!res ? <EmptyState icon="straighten" title="Cargá módulos y metros lineales">El precio, las horas y la fecha de entrega se calculan solos.</EmptyState> : <>
          <div>
            <div className="text-[12px] text-z-ink-3">Precio {canal === 'gremio' ? 'gremio' : 'cliente final'} sin IVA</div>
            <div className="text-[28px] font-semibold text-z-ink tabular-nums leading-tight">{$(res.precio_sin_iva)}</div>
            <div className="text-[13px] text-z-ink-3 tabular-nums">{$(res.precio_con_iva)} con IVA · US${res.precio_usd?.toLocaleString('es-AR')} (dólar {$(res.tc_usd)})</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <K l="Material" v={$(res.material)} />
            <K l={`Mano de obra (${res.metodo_mo?.startsWith('excel') ? 'como Excel' : 'por horas'})`} v={$(res.mano_obra)} />
            <K l="MO real por horas" v={$(res.mo_costo_real_horas)} />
            <K l="Precio / costo real" v={`${res.margen_sobre_costo_real}×`} />
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--z-subtle)' }}>
            <div className="flex items-baseline gap-2"><Icon name="event" size={18} />
              <span className="text-[13px] text-z-ink-3">Entrega estimada</span>
              <span className="ml-auto font-semibold text-z-ink">{fechaLarga(res.fecha_entrega_estimada)}</span></div>
            <div className="text-[12px] text-z-ink-3 mt-1">{res.dias_habiles_entrega} días hábiles · incluye placas, {Math.round(res.cola_taller_horas)} h de trabajo ya en cola y margen de seguridad</div>
          </div>
          <div>
            <div className="flex items-baseline mb-2"><span className="text-[13px] font-semibold flex-1">Horas por etapa</span><span className="text-[13px] tabular-nums">{res.horas_total} h · {res.personas_dia_taller} jornadas-persona en taller</span></div>
            {ETAPAS.map(([k, l]) => {
              const h = res.horas_por_etapa?.[k] || 0, max = Math.max(...Object.values(res.horas_por_etapa || { a: 1 }));
              return <div key={k} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-[12.5px] mb-1">
                <span className="text-z-ink-3">{l}</span>
                <div className="h-2 rounded-full" style={{ background: 'var(--z-inset)' }}><div className="h-2 rounded-full" style={{ width: `${max ? h / max * 100 : 0}%`, background: 'rgb(var(--z-primary-c))' }} /></div>
                <span className="text-right tabular-nums">{h}</span></div>;
            })}
          </div>
          {res.material_sin_precio?.length > 0 && <Badge tone="warning">Sin receta de material: {res.material_sin_precio.join(', ')}</Badge>}
          {Object.keys(res.calibracion || {}).length === 0 && <p className="text-[12px] text-z-ink-3 m-0">Las horas usan los valores semilla. Cuando el taller cargue horas por etapa en 3 proyectos, Zebrano las ajusta con lo real.</p>}
          <p className="text-[12px] text-z-ink-3 m-0">Válido hasta {fechaLarga(res.validez_hasta)}.</p>
        </>}
      </div>
    </div>
  );
}
const K = ({ l, v }) => <div><div className="text-[12px] text-z-ink-3">{l}</div><div className="tabular-nums font-medium text-z-ink">{v}</div></div>;

function Plan() {
  const [rows, setRows] = useState(null);
  const [P, setP] = useState({});
  useEffect(() => {
    (async () => {
      const [{ data: pr }, { data: par }] = await Promise.all([
        supabase.from('proyectos').select('id,nombre,estado,fecha_entrega_estimada,fecha_sena_pagada,clientes(nombre),ordenes_trabajo(horas_fabricacion_estimadas,horas_estimadas,horas_fabricacion_reales,horas_reales)')
          .in('estado', ['sena_pagada', 'en_fabricacion']).order('fecha_entrega_estimada', { ascending: true, nullsFirst: false }),
        supabase.from('cotiz_parametros').select('clave,valor'),
      ]);
      setP(Object.fromEntries((par || []).map(p => [p.clave, Number(p.valor)])));
      setRows(pr || []);
    })();
  }, []);
  if (!rows) return <Spinner />;
  const capDia = (P.personas || 6) * (P.horas_dia || 7);
  let acum = 0; const hoy = new Date();
  const plan = rows.map(p => {
    const ot = p.ordenes_trabajo?.[0] || {};
    const est = Number(ot.horas_fabricacion_estimadas ?? ot.horas_estimadas ?? 0), real = Number(ot.horas_fabricacion_reales ?? ot.horas_reales ?? 0);
    const resta = Math.max(est - real, 0); acum += resta;
    const dias = Math.ceil(acum / capDia); const fin = new Date(hoy); let n = dias;
    while (n > 0) { fin.setDate(fin.getDate() + 1); if (fin.getDay() % 6) n--; }
    const finIso = fin.toISOString().slice(0, 10);
    return { ...p, est, real, resta, finIso, atrasa: p.fecha_entrega_estimada && finIso > p.fecha_entrega_estimada };
  });
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4"><div className="text-[12px] text-z-ink-3">Capacidad del taller</div><div className="text-[22px] font-semibold tabular-nums">{capDia} h/día</div><div className="text-[12px] text-z-ink-3">{P.personas} personas × {P.horas_dia} h efectivas · {capDia * (P.dias_semana || 5)} h/semana</div></div>
        <div className="card p-4"><div className="text-[12px] text-z-ink-3">Trabajo en cola</div><div className="text-[22px] font-semibold tabular-nums">{Math.round(acum)} h</div><div className="text-[12px] text-z-ink-3">≈ {Math.ceil(acum / capDia)} días hábiles de taller</div></div>
        <div className="card p-4"><div className="text-[12px] text-z-ink-3">Proyectos en riesgo</div><div className="text-[22px] font-semibold tabular-nums" style={{ color: plan.some(p => p.atrasa) ? 'rgb(var(--z-danger-c))' : undefined }}>{plan.filter(p => p.atrasa).length}</div><div className="text-[12px] text-z-ink-3">terminan después de la fecha prometida</div></div>
      </div>
      <div className="card overflow-auto">
        <table className="w-full text-[13px]">
          <thead><tr><th>Proyecto</th><th>Estado</th><th className="text-right">Horas est.</th><th className="text-right">Hechas</th><th className="text-right">Faltan</th><th>Termina (en orden)</th><th>Prometido</th></tr></thead>
          <tbody>{plan.length === 0 ? <tr><td colSpan={7}><EmptyState icon="factory" title="No hay proyectos señados ni en fabricación" /></td></tr> : plan.map(p => (
            <tr key={p.id}>
              <td className="font-medium text-z-ink">{p.clientes?.nombre || p.nombre || 'Sin nombre'}</td>
              <td><Badge value={p.estado} /></td>
              <td className="text-right tabular-nums">{p.est ? p.est.toFixed(1) : <span className="text-z-ink-3">sin estimar</span>}</td>
              <td className="text-right tabular-nums">{p.real.toFixed(1)}</td>
              <td className="text-right tabular-nums">{p.resta.toFixed(1)}</td>
              <td>{fechaLarga(p.finIso)}</td>
              <td>{p.fecha_entrega_estimada ? <span style={{ color: p.atrasa ? 'rgb(var(--z-danger-c))' : undefined }}>{fechaLarga(p.fecha_entrega_estimada)}{p.atrasa ? ' · en riesgo' : ''}</span> : '—'}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="text-[12px] text-z-ink-3 m-0">Supone que el taller trabaja los proyectos en orden de fecha prometida con todo el equipo. Un proyecto "sin estimar" no suma a la cola: cotizalo por módulos para que cuente.</p>
    </div>
  );
}

function Tipos({ tipos, setTipos }) {
  const [msg, setMsg] = useState('');
  const set = (i, k, v) => setTipos(ts => ts.map((t, j) => j === i ? { ...t, [k]: v, _sucio: true } : t));
  const guardar = async () => {
    const sucios = tipos.filter(t => t._sucio);
    const res = await Promise.all(sucios.map(({ id, h_corte, h_canteado, h_armado, h_terminacion, h_instalacion, material_ml_manual }) =>
      supabase.from('modulo_tipos').update({ h_corte, h_canteado, h_armado, h_terminacion, h_instalacion, material_ml_manual: material_ml_manual === '' ? null : material_ml_manual, updated_at: new Date().toISOString() }).eq('id', id)));
    const e = res.find(r => r.error)?.error;
    setMsg(e ? 'Error: ' + e.message : `${sucios.length} tipo(s) guardado(s)`);
    if (!e) setTipos(ts => ts.map(t => ({ ...t, _sucio: false })));
  };
  return (
    <div className="grid gap-3">
      <p className="text-[13px] text-z-ink-3 m-0">Horas por metro lineal para una persona. Son valores de arranque: cuando haya horas reales cargadas por etapa, Zebrano calcula un factor de corrección por etapa.</p>
      <div className="card overflow-auto">
        <table className="w-full text-[13px]">
          <thead><tr><th>Módulo</th>{ETAPAS.map(([k, l]) => <th key={k} className="text-right">{l}</th>)}<th className="text-right">Total h/ml</th><th>Receta</th></tr></thead>
          <tbody>{tipos.map((t, i) => (
            <tr key={t.id}>
              <td className="font-medium text-z-ink min-w-[170px]">{t.nombre}<div className="text-[11.5px] text-z-ink-3 font-normal">{t.prof_m && `${t.prof_m} prof`}{t.alto_m && ` × ${t.alto_m} alto`}</div></td>
              {ETAPAS.map(([k]) => <td key={k} className="text-right"><input type="number" step="0.05" className="w-[72px] text-right" value={t['h_' + k]} onChange={e => set(i, 'h_' + k, Number(e.target.value))} aria-label={`${t.nombre} ${k}`} /></td>)}
              <td className="text-right tabular-nums font-medium">{ETAPAS.reduce((s, [k]) => s + Number(t['h_' + k] || 0), 0).toFixed(2)}</td>
              <td className="text-[12px] text-z-ink-3 min-w-[200px]">{(t.receta || []).map(r => `${r.cantidad_por_ml} ${r.insumo}`).join(' · ') || '—'}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="flex items-center gap-3"><button className="btn btn-primary" onClick={guardar} disabled={!tipos.some(t => t._sucio)}>Guardar cambios</button>{msg && <span className="text-[13px]">{msg}</span>}</div>
    </div>
  );
}

function Parametros() {
  const [ps, setPs] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { supabase.from('cotiz_parametros').select('*').order('grupo').then(({ data }) => setPs(data || [])); }, []);
  if (!ps) return <Spinner />;
  const guardar = async p => {
    const { error } = await supabase.from('cotiz_parametros').update({ valor: p.valor, updated_at: new Date().toISOString() }).eq('clave', p.clave);
    setMsg(error ? 'Error: ' + error.message : `${p.descripcion || p.clave}: guardado`);
  };
  const grupos = [...new Set(ps.map(p => p.grupo))];
  return (
    <div className="grid gap-4">
      {grupos.map(g => (
        <div key={g} className="card p-4">
          <h3 className="text-[14px] font-semibold capitalize mb-3">{{ material: 'Costo de material', precio: 'Formación de precio', taller: 'Taller y mano de obra', plazos: 'Plazos' }[g] || g}</h3>
          <div className="grid gap-2">{ps.filter(p => p.grupo === g).map(p => (
            <div key={p.clave} className="grid grid-cols-[1fr_130px] gap-3 items-center text-[13px]">
              <label htmlFor={'p-' + p.clave}>{p.descripcion}</label>
              <input id={'p-' + p.clave} type="number" step="any" className="text-right" value={p.valor}
                onChange={e => setPs(xs => xs.map(x => x.clave === p.clave ? { ...x, valor: e.target.value } : x))} onBlur={() => guardar(p)} />
            </div>))}</div>
        </div>))}
      {msg && <div role="status" className="text-[13px]">{msg}</div>}
    </div>
  );
}
