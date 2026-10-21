import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Badge, Spinner, EmptyState, KpiCard } from '../components/ui';

const $ = n => n == null || n === '' ? '—' : '$' + Math.round(n).toLocaleString('es-AR');
const f = d => d ? new Date(d + 'T12:00').toLocaleDateString('es-AR') : '—';
const PUESTOS = ['oficial', 'suboficial', 'ayudante', 'gerencia', 'administración'];
const CATS = { alquiler: 'Alquiler', servicios: 'Servicios', sueldos_gerencia: 'Sueldos de gerencia', impuestos: 'Impuestos', seguros: 'Seguros', vehiculos: 'Vehículos', software: 'Software', contador: 'Contador', otros: 'Otros' };

export default function Personal() {
  const [tab, setTab] = useState('personal');
  const [ch, setCh] = useState(null);
  const cargarCosto = useCallback(() => supabase.from('costo_hora').select('*').single().then(({ data }) => setCh(data)), []);
  useEffect(() => { cargarCosto(); }, [cargarCosto]);
  return (
    <Layout>
      <Topbar title="Personal y estructura" subtitle="Legajos, vacaciones, gastos fijos y costo hora real del taller" />
      <PageContent>
        {ch && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <KpiCard label="Mano de obra mensual" value={$(ch.mo_mensual)} detail={ch.fuente_mo === 'legajos' ? `${ch.personas} operarios cargados` : 'parámetro ($8M) — cargá sueldos'} icon="engineering" />
          <KpiCard label="Gastos fijos mensuales" value={$(ch.gastos_fijos_mensual)} icon="receipt" />
          <KpiCard label="Horas productivas / mes" value={Math.round(ch.horas_productivas_mes).toLocaleString('es-AR')} icon="schedule" />
          <KpiCard label="Costo hora real" value={$(ch.costo_hora_total)} detail={`MO ${$(ch.costo_hora_mo)} + estructura ${$(ch.costo_hora_estructura)}`} icon="payments" tone="warning" />
        </div>}
        <div className="z-seg mb-4" role="group" aria-label="Sección">
          {[['personal', 'Personal'], ['ausencias', 'Vacaciones y ausencias'], ['gastos', 'Gastos fijos']].map(([k, l]) =>
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === 'personal' && <Legajos onCambio={cargarCosto} />}
        {tab === 'ausencias' && <Ausencias />}
        {tab === 'gastos' && <Gastos onCambio={cargarCosto} />}
      </PageContent>
    </Layout>
  );
}

function Legajos({ onCambio }) {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const cargar = useCallback(() => supabase.from('empleados_legajo').select('*').order('es_operario', { ascending: false }).order('nombre').then(({ data }) => setRows(data || [])), []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!rows) return <Spinner />;
  return <>
    <div className="flex mb-3"><button className="btn btn-primary ml-auto" onClick={() => setEdit({ activo: true, es_operario: true, rol: 'ayudante', puesto: 'ayudante' })}><Icon name="person_add" />Agregar persona</button></div>
    <div className="card overflow-auto">
      <table className="w-full text-[13px]">
        <thead><tr><th>Nombre</th><th>Puesto</th><th>Antigüedad</th><th className="text-right">Por semana</th><th>Vacaciones</th><th>Emergencia</th><th className="text-right">Horas 30 d</th><th className="text-right">Proyectos</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={8}><EmptyState icon="badge" title="Sin personal cargado" /></td></tr> : rows.map(r => (
          <tr key={r.id} className="cursor-pointer" onClick={() => setEdit(r)}>
            <td className="font-medium text-z-ink">{r.nombre}{!r.activo && <Badge tone="neutral"> baja</Badge>}<div className="text-[11.5px] text-z-ink-3 font-normal">{r.telefono || r.email || ''}</div></td>
            <td>{r.es_operario ? <Badge tone="info">{r.puesto || 'operario'}</Badge> : <span className="text-z-ink-3">{r.puesto || r.rol}</span>}</td>
            <td>{r.antiguedad_meses != null ? `${Math.floor(r.antiguedad_meses / 12)} a ${r.antiguedad_meses % 12} m` : '—'}</td>
            <td className="text-right tabular-nums">{$(r.sueldo_semanal)}</td>
            <td className="tabular-nums">{r.vacaciones_corresponden != null ? `${r.vacaciones_tomadas} de ${r.vacaciones_corresponden} días` : '—'}</td>
            <td>{r.emergencia_nombre ? `${r.emergencia_nombre}${r.emergencia_vinculo ? ` (${r.emergencia_vinculo})` : ''} · ${r.emergencia_telefono || ''}` : <span className="text-z-ink-3">falta</span>}</td>
            <td className="text-right tabular-nums">{r.horas_30d ?? '—'}</td>
            <td className="text-right tabular-nums">{r.proyectos_trabajados || 0}</td>
          </tr>))}</tbody>
      </table>
    </div>
    <p className="text-[12px] text-z-ink-3 mt-2">Vacaciones según Ley de Contrato de Trabajo (art. 150): 14 días hasta 5 años, 21 hasta 10, 28 hasta 20 y 35 después; con menos de 6 meses, 1 día cada 20 trabajados. Los operarios con sueldo cargado reemplazan el parámetro de $8M en el costo hora.</p>
    {edit && <EditarLegajo r={edit} onClose={() => setEdit(null)} onSave={() => { setEdit(null); cargar(); onCambio(); }} />}
  </>;
}

function EditarLegajo({ r, onClose, onSave }) {
  const [x, setX] = useState(r);
  const [err, setErr] = useState('');
  const set = k => e => setX(v => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const guardar = async e => {
    e.preventDefault();
    if (!x.nombre?.trim()) { setErr('Falta el nombre.'); return; }
    const campos = ['nombre', 'puesto', 'es_operario', 'telefono', 'email', 'direccion', 'fecha_ingreso', 'fecha_egreso', 'fecha_nacimiento', 'sueldo_semanal', 'emergencia_nombre', 'emergencia_vinculo', 'emergencia_telefono', 'activo'];
    const data = Object.fromEntries(campos.map(k => [k, x[k] === '' ? null : x[k]]));
    if (data.sueldo_semanal != null) data.sueldo_semanal = Number(data.sueldo_semanal);
    const q = r.id ? supabase.from('empleados').update(data).eq('id', r.id) : supabase.from('empleados').insert({ ...data, rol: x.es_operario ? (x.puesto === 'oficial' ? 'carpintero_oficial' : x.puesto === 'suboficial' ? 'carpintero' : 'ayudante') : 'gestion' });
    const { error } = await q;
    if (error) setErr(error.message); else onSave();
  };
  const campo = (k, l, props = {}) => <div className="z-field"><label htmlFor={'lg-' + k}>{l}</label><input id={'lg-' + k} value={x[k] ?? ''} onChange={set(k)} {...props} /></div>;
  return (
    <div className="z-drawer-wrap" onMouseDown={onClose}>
      <form className="z-drawer" onMouseDown={e => e.stopPropagation()} onSubmit={guardar} role="dialog" aria-label="Legajo">
        <div className="z-drawer-head"><h2 className="text-[17px] flex-1">{r.id ? r.nombre : 'Nueva persona'}</h2><button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></div>
        <div className="z-drawer-body grid gap-4">
          {campo('nombre', 'Nombre y apellido', { required: true })}
          <div className="grid grid-cols-2 gap-3">
            <div className="z-field"><label htmlFor="lg-puesto">Puesto</label><select id="lg-puesto" value={x.puesto || ''} onChange={set('puesto')}><option value="">—</option>{PUESTOS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <label className="flex items-center gap-2 text-[13px] mt-6"><input type="checkbox" checked={!!x.es_operario} onChange={set('es_operario')} /> Trabaja en el taller</label>
          </div>
          <div className="grid grid-cols-2 gap-3">{campo('telefono', 'Teléfono')}{campo('email', 'Email', { type: 'email' })}</div>
          {campo('direccion', 'Dirección')}
          <div className="grid grid-cols-3 gap-3">{campo('fecha_ingreso', 'Ingreso', { type: 'date' })}{campo('fecha_nacimiento', 'Nacimiento', { type: 'date' })}{campo('fecha_egreso', 'Egreso', { type: 'date' })}</div>
          {campo('sueldo_semanal', 'Cobra por semana (sin cargas)', { type: 'number', min: 0, step: 1000 })}
          <h3 className="text-[14px] font-semibold -mb-2">Contacto de emergencia</h3>
          <div className="grid grid-cols-3 gap-3">{campo('emergencia_nombre', 'Nombre')}{campo('emergencia_vinculo', 'Vínculo')}{campo('emergencia_telefono', 'Teléfono')}</div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={x.activo !== false} onChange={set('activo')} /> Activo</label>
          {err && <div role="alert" className="text-[13px]" style={{ color: 'rgb(var(--z-danger-c))' }}>{err}</div>}
        </div>
        <div className="z-drawer-foot"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit">Guardar</button></div>
      </form>
    </div>
  );
}

function Ausencias() {
  const [rows, setRows] = useState(null);
  const [emp, setEmp] = useState([]);
  const [x, setX] = useState({ empleado_id: '', tipo: 'vacaciones', desde: '', hasta: '', notas: '' });
  const [err, setErr] = useState('');
  const cargar = useCallback(async () => {
    const [{ data: a }, { data: e }] = await Promise.all([
      supabase.from('rrhh_ausencias').select('*, empleados(nombre)').order('desde', { ascending: false }).limit(300),
      supabase.from('empleados').select('id,nombre').eq('activo', true).order('nombre'),
    ]);
    setRows(a || []); setEmp(e || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const agregar = async e => {
    e.preventDefault(); setErr('');
    const { error } = await supabase.from('rrhh_ausencias').insert({ ...x, hasta: x.hasta || x.desde, notas: x.notas || null });
    if (error) setErr(error.message); else { setX({ ...x, desde: '', hasta: '', notas: '' }); cargar(); }
  };
  if (!rows) return <Spinner />;
  return <>
    <form className="card p-4 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr_auto] gap-3 items-end mb-4" onSubmit={agregar}>
      <div className="z-field"><label htmlFor="au-e">Persona</label><select id="au-e" required value={x.empleado_id} onChange={e => setX({ ...x, empleado_id: e.target.value })}><option value="">Elegir…</option>{emp.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
      <div className="z-field"><label htmlFor="au-t">Tipo</label><select id="au-t" value={x.tipo} onChange={e => setX({ ...x, tipo: e.target.value })}><option value="vacaciones">Vacaciones</option><option value="enfermedad">Enfermedad</option><option value="licencia">Licencia</option><option value="ausencia">Ausencia</option></select></div>
      <div className="z-field"><label htmlFor="au-d">Desde</label><input id="au-d" type="date" required value={x.desde} onChange={e => setX({ ...x, desde: e.target.value })} /></div>
      <div className="z-field"><label htmlFor="au-h">Hasta</label><input id="au-h" type="date" value={x.hasta} onChange={e => setX({ ...x, hasta: e.target.value })} /></div>
      <div className="z-field"><label htmlFor="au-n">Notas</label><input id="au-n" value={x.notas} onChange={e => setX({ ...x, notas: e.target.value })} /></div>
      <button className="btn btn-primary" type="submit">Agregar</button>
      {err && <div role="alert" className="text-[13px] sm:col-span-6" style={{ color: 'rgb(var(--z-danger-c))' }}>{err}</div>}
    </form>
    <div className="card overflow-auto"><table className="w-full text-[13px]">
      <thead><tr><th>Persona</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th className="text-right">Días</th><th>Notas</th></tr></thead>
      <tbody>{rows.length === 0 ? <tr><td colSpan={6}><EmptyState icon="beach_access" title="Sin ausencias cargadas" /></td></tr> : rows.map(r => (
        <tr key={r.id}><td className="font-medium text-z-ink">{r.empleados?.nombre}</td><td><Badge tone={r.tipo === 'vacaciones' ? 'info' : 'warning'}>{r.tipo}</Badge></td><td>{f(r.desde)}</td><td>{f(r.hasta)}</td>
          <td className="text-right tabular-nums">{Math.round((new Date(r.hasta) - new Date(r.desde)) / 864e5) + 1}</td><td>{r.notas || ''}</td></tr>))}</tbody>
    </table></div>
  </>;
}

function Gastos({ onCambio }) {
  const [rows, setRows] = useState(null);
  const vacio = { concepto: '', categoria: 'servicios', monto_mensual: '', moneda: 'ARS', dia_vencimiento: '', proveedor: '' };
  const [x, setX] = useState(vacio);
  const [err, setErr] = useState('');
  const cargar = useCallback(() => supabase.from('gastos_fijos').select('*').order('activo', { ascending: false }).order('categoria').then(({ data }) => setRows(data || [])), []);
  useEffect(() => { cargar(); }, [cargar]);
  const agregar = async e => {
    e.preventDefault(); setErr('');
    const { error } = await supabase.from('gastos_fijos').insert({ ...x, monto_mensual: Number(x.monto_mensual), dia_vencimiento: x.dia_vencimiento ? Number(x.dia_vencimiento) : null, proveedor: x.proveedor || null });
    if (error) setErr(error.message); else { setX(vacio); cargar(); onCambio(); }
  };
  const alternar = async r => { await supabase.from('gastos_fijos').update({ activo: !r.activo, hasta: r.activo ? new Date().toISOString().slice(0, 10) : null }).eq('id', r.id); cargar(); onCambio(); };
  if (!rows) return <Spinner />;
  const total = rows.filter(r => r.activo).reduce((s, r) => s + (r.moneda === 'ARS' ? Number(r.monto_mensual) : 0), 0);
  return <>
    <form className="card p-4 grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr_.7fr_.7fr_1fr_auto] gap-3 items-end mb-4" onSubmit={agregar}>
      <div className="z-field"><label htmlFor="gf-c">Concepto</label><input id="gf-c" required value={x.concepto} onChange={e => setX({ ...x, concepto: e.target.value })} placeholder="Alquiler galpón" /></div>
      <div className="z-field"><label htmlFor="gf-cat">Categoría</label><select id="gf-cat" value={x.categoria} onChange={e => setX({ ...x, categoria: e.target.value })}>{Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="z-field"><label htmlFor="gf-m">Monto mensual</label><input id="gf-m" type="number" min="0" required value={x.monto_mensual} onChange={e => setX({ ...x, monto_mensual: e.target.value })} /></div>
      <div className="z-field"><label htmlFor="gf-mon">Moneda</label><select id="gf-mon" value={x.moneda} onChange={e => setX({ ...x, moneda: e.target.value })}><option>ARS</option><option>USD</option></select></div>
      <div className="z-field"><label htmlFor="gf-d">Vence día</label><input id="gf-d" type="number" min="1" max="31" value={x.dia_vencimiento} onChange={e => setX({ ...x, dia_vencimiento: e.target.value })} /></div>
      <div className="z-field"><label htmlFor="gf-p">Proveedor</label><input id="gf-p" value={x.proveedor} onChange={e => setX({ ...x, proveedor: e.target.value })} /></div>
      <button className="btn btn-primary" type="submit">Agregar</button>
      {err && <div role="alert" className="text-[13px] sm:col-span-7" style={{ color: 'rgb(var(--z-danger-c))' }}>{err}</div>}
    </form>
    <div className="card overflow-auto"><table className="w-full text-[13px]">
      <thead><tr><th>Concepto</th><th>Categoría</th><th className="text-right">Mensual</th><th>Vence</th><th>Proveedor</th><th /></tr></thead>
      <tbody>{rows.length === 0 ? <tr><td colSpan={6}><EmptyState icon="receipt" title="Sin gastos fijos cargados">Alquiler, servicios, sueldos de gerencia, contador, seguros… entran en el costo hora real.</EmptyState></td></tr> : rows.map(r => (
        <tr key={r.id} style={{ opacity: r.activo ? 1 : 0.5 }}><td className="font-medium text-z-ink">{r.concepto}</td><td>{CATS[r.categoria]}</td>
          <td className="text-right tabular-nums">{r.moneda === 'USD' ? `US$${Number(r.monto_mensual).toLocaleString('es-AR')}` : $(r.monto_mensual)}</td>
          <td>{r.dia_vencimiento ? `día ${r.dia_vencimiento}` : '—'}</td><td>{r.proveedor || '—'}</td>
          <td><button className="btn btn-quiet btn-sm" onClick={() => alternar(r)}>{r.activo ? 'Dar de baja' : 'Reactivar'}</button></td></tr>))}</tbody>
      {rows.length > 0 && <tfoot><tr><td colSpan={2} className="font-semibold">Total mensual en pesos (activos)</td><td className="text-right tabular-nums font-semibold">{$(total)}</td><td colSpan={3} /></tr></tfoot>}
    </table></div>
  </>;
}
