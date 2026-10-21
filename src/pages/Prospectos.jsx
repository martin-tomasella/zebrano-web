import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Layout, Topbar, PageContent, Icon } from '../components/Layout';
import { Avatar, Badge, EmptyState, toneColor, toneOf } from '../components/ui';

const ESTADOS = [
  { id: 'nuevo',       label: 'Nuevos' },
  { id: 'contactado',  label: 'Contactados' },
  { id: 'calificado',  label: 'Calificados' },
  { id: 'cotizado',    label: 'Cotizados' },
  { id: 'negociacion', label: 'Negociación' },
  { id: 'ganado',      label: 'Ganados' },
  { id: 'perdido',     label: 'Perdidos' },
];
const CANALES = {
  instagram: { label: 'Instagram', icon: 'photo_camera' },
  facebook:  { label: 'Facebook',  icon: 'thumb_up' },
  tiktok:    { label: 'TikTok',    icon: 'music_note' },
  whatsapp:  { label: 'WhatsApp',  icon: 'chat' },
  web:       { label: 'Web',       icon: 'language' },
  referido:  { label: 'Referido',  icon: 'handshake' },
  otro:      { label: 'Otro',      icon: 'more_horiz' },
};
const TIPOS = ['placard','cocina','mesa','escritorio','biblioteca','vestidor','baño','living','oficina','otro'];

const money = n => n ? '$' + Math.round(n).toLocaleString('es-AR') : '—';
const fecha = d => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const vencido = p => p.proximo_seguimiento && new Date(p.proximo_seguimiento) < new Date();
const nombreDe = p => `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre';

export default function Prospectos() {
  const [vista, setVista] = useState(() => { try { return localStorage.getItem('z-prospectos-vista') || 'tablero'; } catch { return 'tablero'; } });
  const [prospectos, setProspectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canal, setCanal] = useState(null);
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [arrastrado, setArrastrado] = useState(null);
  const [destino, setDestino] = useState(null);
  const [toast, setToast] = useState(null);
  const [orden, setOrden] = useState({ key: 'created_at', dir: -1 });
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('prospectos').select('*').eq('activo', true).order('created_at', { ascending: false });
    setProspectos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { try { localStorage.setItem('z-prospectos-vista', vista); } catch {} }, [vista]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const filtrados = useMemo(() => prospectos.filter(p => {
    if (canal && p.canal_origen !== canal) return false;
    if (soloVencidos && !vencido(p)) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return nombreDe(p).toLowerCase().includes(q) || (p.telefono || '').includes(q) || (p.handle_rrss || '').toLowerCase().includes(q) || (p.tipo_trabajo || '').toLowerCase().includes(q);
    }
    return true;
  }), [prospectos, canal, soloVencidos, busqueda]);

  const porEstado = estado => filtrados.filter(p => p.estado === estado);
  const abiertos = prospectos.filter(p => !['ganado', 'perdido'].includes(p.estado));
  const totalAbierto = abiertos.reduce((s, p) => s + Number(p.presupuesto_estimado || 0), 0);
  const canalesPresentes = Object.keys(CANALES).filter(c => prospectos.some(p => p.canal_origen === c));
  const nVencidos = prospectos.filter(vencido).length;

  // Mover de etapa con arrastrar y soltar: optimista, se revierte si Supabase falla
  async function mover(p, estado) {
    if (!p || p.estado === estado) return;
    const antes = p.estado;
    setProspectos(list => list.map(x => x.id === p.id ? { ...x, estado } : x));
    const { error } = await supabase.from('prospectos').update({ estado }).eq('id', p.id);
    if (error) {
      setProspectos(list => list.map(x => x.id === p.id ? { ...x, estado: antes } : x));
      setToast({ tone: 'danger', text: `No se pudo mover a ${nombreDe(p)}: ${error.message}` });
      return;
    }
    setToast({ tone: 'success', text: `${nombreDe(p)} pasó a ${ESTADOS.find(e => e.id === estado)?.label.toLowerCase()}`, undo: () => mover({ ...p, estado }, antes) });
  }

  const filas = useMemo(() => {
    const get = {
      nombre: p => nombreDe(p).toLowerCase(), canal: p => p.canal_origen || '', tipo: p => p.tipo_trabajo || '',
      presupuesto: p => Number(p.presupuesto_estimado || 0), estado: p => ESTADOS.findIndex(e => e.id === p.estado),
      seguimiento: p => p.proximo_seguimiento || '9999', created_at: p => p.created_at || '',
    }[orden.key];
    return [...filtrados].sort((a, b) => (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0) * orden.dir);
  }, [filtrados, orden]);

  return (
    <Layout>
      <Topbar
        title="Prospectos"
        subtitle={loading ? 'Cargando…' : `${abiertos.length} abiertos por ${money(totalAbierto)} · ${prospectos.length} en total`}
        actions={<>
          <div className="z-seg" role="group" aria-label="Vista">
            <button aria-pressed={vista === 'tablero'} onClick={() => setVista('tablero')}><Icon name="view_kanban" size={16} />Tablero</button>
            <button aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}><Icon name="table_rows" size={16} />Lista</button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNuevo(true)}><Icon name="person_add" size={18} />Nuevo prospecto</button>
        </>}
      />

      <PageContent>
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative w-full sm:w-[280px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-z-ink-3 flex"><Icon name="search" size={18} /></span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, teléfono o @usuario" aria-label="Buscar prospectos" style={{ paddingLeft: 36 }} />
          </div>
          <button className="z-chip" aria-pressed={!canal} onClick={() => setCanal(null)}>Todos los canales</button>
          {canalesPresentes.map(c => (
            <button key={c} className="z-chip" aria-pressed={canal === c} onClick={() => setCanal(x => x === c ? null : c)}>
              <Icon name={CANALES[c].icon} size={15} />{CANALES[c].label}
              <span className="z-chip-count">{prospectos.filter(p => p.canal_origen === c).length}</span>
            </button>
          ))}
          {nVencidos > 0 && (
            <button className="z-chip" aria-pressed={soloVencidos} onClick={() => setSoloVencidos(v => !v)}>
              <Icon name="schedule" size={15} />Seguimiento vencido<span className="z-chip-count">{nVencidos}</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3, 4].map(i => <div key={i} className="z-skeleton h-[260px] min-w-[268px]" />)}</div>
        ) : prospectos.length === 0 ? (
          <div className="surface"><EmptyState icon="person_search" title="Todavía no hay prospectos"
            action={<button className="btn btn-primary btn-sm" onClick={() => setShowNuevo(true)}>Cargar el primero</button>}>
            Cargá las consultas que entran por Instagram, WhatsApp o referidos para seguirlas hasta la venta.</EmptyState></div>
        ) : vista === 'tablero' ? (
          <div className="flex gap-3 overflow-x-auto pb-3 items-start" style={{ minHeight: 'calc(100vh - 260px)' }}>
            {ESTADOS.map(est => {
              const cards = porEstado(est.id);
              const total = cards.reduce((s, p) => s + Number(p.presupuesto_estimado || 0), 0);
              const sobre = destino === est.id && arrastrado && arrastrado.estado !== est.id;
              const tone = toneOf(est.id);
              return (
                <section key={est.id} aria-label={est.label}
                  onDragOver={e => { if (arrastrado) { e.preventDefault(); setDestino(est.id); } }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDestino(d => d === est.id ? null : d); }}
                  onDrop={e => { e.preventDefault(); mover(arrastrado, est.id); setArrastrado(null); setDestino(null); }}
                  className={`w-[268px] min-w-[268px] rounded-xl p-2 flex flex-col transition-colors ${sobre ? 'bg-z-primary/10 ring-2 ring-z-primary/40' : 'bg-z-inset/60'}`}>
                  <header className="px-2 pt-1 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: toneColor(tone) }} />
                      <h3 className="text-[13.5px] font-semibold text-z-ink">{est.label}</h3>
                      <span className="text-[12.5px] text-z-ink-3">{cards.length}</span>
                    </div>
                    <div className="text-[12.5px] text-z-ink-3 mt-0.5 pl-4">{total ? money(total) : 'Sin presupuesto cargado'}</div>
                  </header>
                  <div className="flex flex-col gap-2">
                    {cards.map(p => (
                      <article key={p.id} draggable
                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setArrastrado(p); }}
                        onDragEnd={() => { setArrastrado(null); setDestino(null); }}
                        onClick={() => navigate(`/prospectos/${p.id}`)}
                        onKeyDown={e => e.key === 'Enter' && navigate(`/prospectos/${p.id}`)} tabIndex={0}
                        className={`bg-z-surface rounded-lg p-3 border border-z-line shadow-z-sm cursor-grab active:cursor-grabbing hover:border-z-line-2 hover:shadow-z transition-all ${arrastrado?.id === p.id ? 'opacity-40' : ''}`}>
                        <div className="flex items-start gap-2.5">
                          <Avatar name={nombreDe(p)} size={28} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-semibold text-z-ink truncate">{nombreDe(p)}</div>
                            <div className="text-[12.5px] text-z-ink-3 truncate">{p.handle_rrss || (p.tipo_trabajo && p.tipo_trabajo[0].toUpperCase() + p.tipo_trabajo.slice(1)) || p.telefono || 'Sin datos de contacto'}</div>
                          </div>
                          <span className="text-z-ink-3 flex" title={CANALES[p.canal_origen]?.label || 'Otro'}><Icon name={CANALES[p.canal_origen]?.icon || 'more_horiz'} size={16} /></span>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-[12.5px]">
                          <span className="font-semibold text-z-ink">{money(p.presupuesto_estimado)}</span>
                          {p.proximo_seguimiento && (
                            <span className={`inline-flex items-center gap-1 ${vencido(p) ? 'text-z-danger font-semibold' : 'text-z-ink-3'}`}>
                              <Icon name={vencido(p) ? 'notification_important' : 'event'} size={14} />{fecha(p.proximo_seguimiento)}
                            </span>
                          )}
                        </div>
                      </article>
                    ))}
                    {cards.length === 0 && (
                      <div className={`text-[12.5px] text-center py-6 rounded-lg border border-dashed ${sobre ? 'border-z-primary text-z-primary' : 'border-z-line-2 text-z-ink-3'}`}>
                        {arrastrado ? 'Soltá acá' : 'Sin prospectos'}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="surface overflow-auto">
            {filas.length === 0 ? <EmptyState icon="filter_alt_off" title="Ningún prospecto coincide">Probá con otra búsqueda o quitá los filtros.</EmptyState> : (
              <table>
                <thead>
                  <tr>
                    {[['nombre', 'Nombre'], ['canal', 'Canal'], ['tipo', 'Trabajo'], ['presupuesto', 'Presupuesto', true], ['estado', 'Etapa'], ['seguimiento', 'Seguimiento'], ['created_at', 'Alta']].map(([k, l, right]) => (
                      <th key={k} style={{ padding: 0, textAlign: right ? 'right' : 'left' }} aria-sort={orden.key === k ? (orden.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                        <button onClick={() => setOrden(o => ({ key: k, dir: o.key === k ? -o.dir : 1 }))}
                          className={`w-full h-[38px] px-[14px] inline-flex items-center gap-1 font-semibold hover:text-z-ink ${right ? 'justify-end' : ''} ${orden.key === k ? 'text-z-ink' : ''}`}>
                          {l}<Icon name={orden.key === k ? (orden.dir > 0 ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'} size={14} color={orden.key === k ? 'currentColor' : 'var(--z-text-muted)'} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map(p => (
                    <tr key={p.id} onClick={() => navigate(`/prospectos/${p.id}`)} style={{ cursor: 'pointer' }}>
                      <td><div className="flex items-center gap-3"><Avatar name={nombreDe(p)} size={30} /><div><div className="font-semibold">{nombreDe(p)}</div><div className="text-[12.5px] text-z-ink-3">{p.telefono || p.email || p.handle_rrss || '—'}</div></div></div></td>
                      <td><span className="inline-flex items-center gap-1.5 text-z-ink-2"><Icon name={CANALES[p.canal_origen]?.icon || 'more_horiz'} size={16} />{CANALES[p.canal_origen]?.label || 'Otro'}</span></td>
                      <td className="capitalize text-z-ink-2">{p.tipo_trabajo || '—'}</td>
                      <td className="text-right font-semibold">{money(p.presupuesto_estimado)}</td>
                      <td><Badge value={p.estado} /></td>
                      <td className={vencido(p) ? 'text-z-danger font-semibold' : 'text-z-ink-2'}>{p.proximo_seguimiento ? fecha(p.proximo_seguimiento) : '—'}</td>
                      <td className="text-z-ink-3">{p.created_at ? fecha(p.created_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </PageContent>

      {toast && (
        <div role="status" className="z-pop fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 rounded-lg px-4 py-3 shadow-z-lg text-[13.5px]"
          style={{ background: 'rgb(var(--z-ink-c))', color: 'rgb(var(--z-surface-c))' }}>
          <Icon name={toast.tone === 'danger' ? 'error' : 'check_circle'} size={18} color={toast.tone === 'danger' ? 'rgb(var(--z-danger-c))' : 'rgb(var(--z-nav-accent-c))'} />
          {toast.text}
          {toast.undo && <button className="font-semibold underline underline-offset-2" onClick={() => { toast.undo(); setToast(null); }}>Deshacer</button>}
        </div>
      )}

      {showNuevo && <NuevoDrawer onClose={() => setShowNuevo(false)} onSave={() => { setShowNuevo(false); setToast({ tone: 'success', text: 'Prospecto guardado' }); cargar(); }} />}
    </Layout>
  );
}

function NuevoDrawer({ onClose, onSave }) {
  const [form, setForm] = useState({ nombre:'', apellido:'', telefono:'', email:'', canal_origen:'instagram', handle_rrss:'', tipo_trabajo:'', presupuesto_estimado:'', notas:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const guardar = async e => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('Poné al menos el nombre del prospecto.'); return; }
    setSaving(true); setError('');
    const { error } = await supabase.from('prospectos').insert({ ...form, presupuesto_estimado: form.presupuesto_estimado ? parseFloat(form.presupuesto_estimado) : null, estado: 'nuevo' });
    setSaving(false);
    if (error) { setError('No se pudo guardar el prospecto: ' + error.message); return; }
    onSave();
  };

  const campo = (k, l, props = {}) => (
    <div className="z-field"><label htmlFor={`np-${k}`}>{l}</label><input id={`np-${k}`} value={form[k]} onChange={set(k)} {...props} /></div>
  );

  return (
    <div className="z-drawer-wrap" onMouseDown={onClose}>
      <form className="z-drawer" onMouseDown={e => e.stopPropagation()} onSubmit={guardar} role="dialog" aria-label="Nuevo prospecto">
        <div className="z-drawer-head">
          <h2 className="text-[17px] flex-1">Nuevo prospecto</h2>
          <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <div className="z-drawer-body grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            {campo('nombre', 'Nombre', { autoFocus: true, required: true })}
            {campo('apellido', 'Apellido')}
            {campo('telefono', 'Teléfono', { type: 'tel', placeholder: '11 5555-5555' })}
            {campo('email', 'Email', { type: 'email' })}
          </div>
          <div className="z-field">
            <label>Canal de origen</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CANALES).map(([k, c]) => (
                <button type="button" key={k} className="z-chip" aria-pressed={form.canal_origen === k} onClick={() => setForm(f => ({ ...f, canal_origen: k }))}>
                  <Icon name={c.icon} size={15} />{c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo('handle_rrss', 'Usuario en redes', { placeholder: '@usuario' })}
            <div className="z-field">
              <label htmlFor="np-tipo">Tipo de trabajo</label>
              <select id="np-tipo" value={form.tipo_trabajo} onChange={set('tipo_trabajo')}>
                <option value="">Sin definir</option>
                {TIPOS.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {campo('presupuesto_estimado', 'Presupuesto estimado ($)', { type: 'number', min: 0, inputMode: 'numeric', placeholder: '0' })}
          <div className="z-field"><label htmlFor="np-notas">Notas</label><textarea id="np-notas" rows={4} style={{ resize: 'vertical' }} value={form.notas} onChange={set('notas')} placeholder="Qué pidió, medidas, referencias…" /></div>
          {error && <div role="alert" className="rounded-lg px-3 py-2.5 text-[13px] bg-z-danger/10 text-z-danger">{error}</div>}
        </div>
        <div className="z-drawer-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar prospecto'}</button>
        </div>
      </form>
    </div>
  );
}
