import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Badge, KpiCard, Spinner, EmptyState } from '../components/ui';

const ESTADO_TONO = { nueva: 'neutral', perfilada: 'info', sin_contacto: 'neutral', en_borrador: 'warning', propuesta: 'warning', contactada: 'success', respondio: 'success', descartada: 'neutral', baja: 'danger' };
const MSJ_TONO = { borrador: 'warning', propuesto: 'info', aprobado: 'success', enviado: 'success', rechazado: 'neutral', bloqueado: 'danger', error: 'danger' };

// Prospección: empresas encontradas (mapa abierto) → perfiladas (su web) → mail borrador → "dale" de Martín en Alfred → envío.
export default function Prospeccion() {
  const [tab, setTab] = useState('empresas');
  const [emp, setEmp] = useState(null);
  const [msjs, setMsjs] = useState([]);
  const [senales, setSenales] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [f, setF] = useState({ seg: '', estado: '', q: '', conEmail: true });
  const [msg, setMsg] = useState('');

  const cargar = async () => {
    const [e, m, s, c] = await Promise.all([
      supabase.from('prosp_cohorte').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('prosp_mensajes').select('*, prosp_empresas(nombre,rubro,segmento)').order('created_at', { ascending: false }).limit(300),
      supabase.from('prosp_senales').select('*').order('codigo'),
      supabase.from('prosp_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    setEmp(e.data || []); setMsjs(m.data || []); setSenales(s.data || []); setCfg(c.data);
  };
  useEffect(() => { cargar(); }, []);

  const correr = async (etapa, extra = {}) => {
    setMsg(`Corriendo "${etapa}"… tarda hasta 2 minutos.`);
    await supabase.rpc('prospector_correr', { p_etapa: etapa, p_extra: extra });
    setTimeout(async () => { await cargar(); setMsg(`"${etapa}" lanzado. Resultado del último ciclo abajo.`); }, 60000);
  };
  const baja = async valor => {
    const v = window.prompt('Dirección o dominio que nunca hay que contactar', valor); if (!v) return;
    const { error } = await supabase.from('prosp_bajas').upsert({ valor: v.trim().toLowerCase(), motivo: 'cargada a mano' });
    setMsg(error ? error.message : `${v} quedó en bajas: no se le escribe nunca más.`);
  };
  const setSenal = async (codigo, estado) => { await supabase.from('prosp_senales').update({ estado }).eq('codigo', codigo); cargar(); };
  const guardarCfg = async () => {
    const { error } = await supabase.from('prosp_config').update({ remitente_nombre: cfg.remitente_nombre, remitente_email: cfg.remitente_email, firma: cfg.firma, linea_baja: cfg.linea_baja, direccion_postal: cfg.direccion_postal, dominios_propios: cfg.dominios_propios, max_perfiles_dia: Number(cfg.max_perfiles_dia), max_borradores_dia: Number(cfg.max_borradores_dia), segmentos: cfg.segmentos, updated_at: new Date().toISOString() }).eq('id', 1);
    setMsg(error ? error.message : 'Configuración guardada');
  };

  const segs = cfg?.segmentos || [];
  const lista = useMemo(() => (emp || []).filter(e => (!f.seg || e.segmento === f.seg) && (!f.estado || e.estado === f.estado) && (!f.conEmail || e.email)
    && (!f.q || `${e.nombre} ${e.rubro} ${e.zona} ${e.email}`.toLowerCase().includes(f.q.toLowerCase()))), [emp, f]);
  const cuenta = k => (emp || []).filter(k).length;
  const ult = cfg?.ultimo_ciclo;

  return (
    <Layout>
      <Topbar title="Prospección" subtitle="Empresas a las que venderles, con el mail listo para tu aprobación en Alfred"
        actions={<div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => correr('descubrir', f.seg ? { segmento: f.seg } : {})}><Icon name="travel_explore" />Buscar empresas</button>
          <button className="btn btn-secondary" onClick={() => correr('perfilar')}><Icon name="language" />Leer webs</button>
          <button className="btn btn-primary" onClick={() => correr('escribir')}><Icon name="edit_note" />Escribir mails</button>
        </div>} />
      <PageContent>
        {msg && <p className="text-[13px] text-z-ink-2 mb-3" role="status">{msg}</p>}
        {!emp ? <Spinner /> : <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Empresas encontradas" value={emp.length} icon="storefront" detail={segs.map(s => `${s.codigo}: ${cuenta(e => e.segmento === s.codigo)}`).join(' · ')} />
            <KpiCard label="Con email" value={cuenta(e => e.email)} icon="alternate_email" detail={`${cuenta(e => e.perfilada_at)} webs leídas`} />
            <KpiCard label="Mails esperando tu dale" value={msjs.filter(m => ['borrador', 'propuesto'].includes(m.estado)).length} icon="pending_actions" detail="Se aprueban en Alfred" />
            <KpiCard label="Contactadas" value={cuenta(e => ['contactada', 'respondio'].includes(e.estado))} icon="mark_email_read" detail={`${msjs.filter(m => m.estado === 'enviado').length} enviados por Gmail`} />
          </div>
          {ult && <p className="text-[12.5px] text-z-ink-3 mb-3">Último ciclo {new Date(ult.fecha).toLocaleString('es-AR')}: {JSON.stringify({ ...ult, fecha: undefined, unidad: undefined, etapa: undefined }).replace(/[{}"]/g, '').replace(/,/g, ' · ')}</p>}

          <div className="z-seg mb-4" role="group" aria-label="Vista">
            {[['empresas', 'Empresas'], ['mensajes', 'Mails'], ['senales', 'Señales'], ['config', 'Oferta y envío']].map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === 'empresas' && <>
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div className="z-field"><label htmlFor="p-s">Segmento</label><select id="p-s" value={f.seg} onChange={e => setF({ ...f, seg: e.target.value })}><option value="">Todos</option>{segs.map(s => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}</select></div>
              <div className="z-field"><label htmlFor="p-e">Estado</label><select id="p-e" value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })}><option value="">Todos</option>{Object.keys(ESTADO_TONO).map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}</select></div>
              <label className="flex items-center gap-2 text-[13px] pb-2"><input type="checkbox" checked={f.conEmail} onChange={e => setF({ ...f, conEmail: e.target.checked })} /> Solo con email</label>
              <input className="ml-auto max-w-[260px]" placeholder="Buscar nombre, rubro, zona…" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} aria-label="Buscar" />
              <span className="text-[13px] text-z-ink-3 pb-2">{lista.length}</span>
            </div>
            <div className="card overflow-auto">
              <table className="w-full text-[13px]">
                <thead><tr><th>Empresa</th><th>Rubro</th><th>Zona</th><th>Contacto</th><th>Señales</th><th>Estado</th><th /></tr></thead>
                <tbody>{lista.length === 0 ? <tr><td colSpan={7}><EmptyState icon="travel_explore" title="Sin empresas con este filtro" /></td></tr> : lista.slice(0, 300).map(e => (
                  <tr key={e.id}>
                    <td className="font-medium text-z-ink">{e.web ? <a href={e.web.startsWith('http') ? e.web : `https://${e.web}`} target="_blank" rel="noreferrer" className="hover:underline">{e.nombre}</a> : e.nombre}</td>
                    <td>{e.rubro}</td>
                    <td>{e.zona || '—'}</td>
                    <td className="text-[12.5px]">{e.email || '—'}{e.telefono && <div className="text-z-ink-3">{e.telefono}</div>}</td>
                    <td className="text-[11.5px] text-z-ink-3 max-w-[260px]">{Object.keys(e.senales || {}).filter(k => !['RUBRO', 'TIENE_WEB', 'EMAIL_ENCONTRADO', 'TELEFONO'].includes(k)).join(' · ') || '—'}</td>
                    <td><Badge tone={ESTADO_TONO[e.estado]}>{e.estado.replace('_', ' ')}</Badge></td>
                    <td>{e.email && <button className="btn btn-quiet btn-sm" onClick={() => baja(e.email)} title="No contactar nunca">Baja</button>}</td>
                  </tr>))}</tbody>
              </table>
              {lista.length > 300 && <p className="text-[12px] text-z-ink-3 px-3 pb-3 m-0">Se muestran 300 de {lista.length}; filtrá para ver el resto.</p>}
            </div>
          </>}

          {tab === 'mensajes' && <div className="grid gap-3">
            {msjs.length === 0 ? <div className="card"><EmptyState icon="edit_note" title="Todavía no hay mails" /></div> : msjs.map(m => (
              <div key={m.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge tone={MSJ_TONO[m.estado]}>{m.estado}</Badge>
                  <span className="font-medium text-z-ink">{m.prosp_empresas?.nombre}</span>
                  <span className="text-[12.5px] text-z-ink-3">{m.para} · {m.prosp_empresas?.segmento} · {new Date(m.created_at).toLocaleDateString('es-AR')}</span>
                </div>
                <div className="text-[13.5px] font-medium text-z-ink">{m.asunto}</div>
                <pre className="whitespace-pre-wrap font-sans text-[13px] text-z-ink-2 m-0 mt-1">{m.cuerpo}</pre>
                {(m.gate || []).length > 0 && <p className="text-[12.5px] mt-2 mb-0" style={{ color: 'rgb(var(--z-danger-c))' }}>Frenado por el control: {m.gate.join(' · ')}</p>}
                {m.error && <p className="text-[12.5px] mt-2 mb-0 text-z-ink-3">{m.error}</p>}
              </div>))}
          </div>}

          {tab === 'senales' && <div className="card overflow-auto">
            <p className="text-[12.5px] text-z-ink-3 px-3 pt-3 m-0">Solo las señales confirmadas se usan para elegir a quién escribir y qué decirle. Las pagas quedan propuestas hasta que las confirmes.</p>
            <table className="w-full text-[13px]">
              <thead><tr><th>Señal</th><th>Qué dice</th><th>Costo</th><th>Empresas</th><th>Estado</th></tr></thead>
              <tbody>{senales.map(s => (
                <tr key={s.codigo}>
                  <td className="font-mono text-[12px]">{s.codigo}</td>
                  <td>{s.descripcion}</td>
                  <td>{s.costo}</td>
                  <td className="tabular-nums">{cuenta(e => e.senales && s.codigo in e.senales)}</td>
                  <td><select value={s.estado} onChange={e => setSenal(s.codigo, e.target.value)} aria-label={`Estado de ${s.codigo}`}><option value="propuesta">Propuesta</option><option value="confirmada">Confirmada</option><option value="descartada">Descartada</option></select></td>
                </tr>))}</tbody>
            </table>
          </div>}

          {tab === 'config' && cfg && <div className="grid gap-4 max-w-[860px]">
            <div className="card p-4 grid sm:grid-cols-2 gap-3">
              <div className="z-field"><label htmlFor="c-rn">Nombre del remitente</label><input id="c-rn" value={cfg.remitente_nombre || ''} onChange={e => setCfg({ ...cfg, remitente_nombre: e.target.value })} /></div>
              <div className="z-field"><label htmlFor="c-re">Email del remitente (Gmail conectado)</label><input id="c-re" type="email" value={cfg.remitente_email || ''} onChange={e => setCfg({ ...cfg, remitente_email: e.target.value })} /></div>
              <div className="z-field sm:col-span-2"><label htmlFor="c-f">Firma</label><input id="c-f" value={cfg.firma || ''} onChange={e => setCfg({ ...cfg, firma: e.target.value })} /></div>
              <div className="z-field sm:col-span-2"><label htmlFor="c-b">Línea para darse de baja (obligatoria, Ley 25.326)</label><input id="c-b" value={cfg.linea_baja || ''} onChange={e => setCfg({ ...cfg, linea_baja: e.target.value })} /></div>
              <div className="z-field"><label htmlFor="c-d">Dirección (opcional)</label><input id="c-d" value={cfg.direccion_postal || ''} onChange={e => setCfg({ ...cfg, direccion_postal: e.target.value })} /></div>
              <div className="z-field"><label htmlFor="c-dp">Dominios propios para links</label><input id="c-dp" value={(cfg.dominios_propios || []).join(', ')} onChange={e => setCfg({ ...cfg, dominios_propios: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} /></div>
              <div className="z-field"><label htmlFor="c-mp">Webs a leer por día</label><input id="c-mp" type="number" min="0" value={cfg.max_perfiles_dia} onChange={e => setCfg({ ...cfg, max_perfiles_dia: e.target.value })} /></div>
              <div className="z-field"><label htmlFor="c-mb">Mails borrador por día</label><input id="c-mb" type="number" min="0" value={cfg.max_borradores_dia} onChange={e => setCfg({ ...cfg, max_borradores_dia: e.target.value })} /></div>
            </div>
            {segs.map((s, i) => (
              <div key={s.codigo} className="card p-4 grid gap-2">
                <div className="font-medium text-z-ink">{s.nombre} <span className="text-[12px] text-z-ink-3">· busca en el mapa: {s.osm.join(', ')}</span></div>
                <div className="z-field"><label htmlFor={`o-${i}`}>Qué le ofrecemos</label><textarea id={`o-${i}`} rows={3} value={s.oferta} onChange={e => { const x = [...segs]; x[i] = { ...s, oferta: e.target.value }; setCfg({ ...cfg, segmentos: x }); }} /></div>
              </div>))}
            <div><button className="btn btn-primary" onClick={guardarCfg}>Guardar</button></div>
          </div>}
        </>}
      </PageContent>
    </Layout>
  );
}
