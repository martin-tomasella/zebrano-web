
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Layout, Topbar, PageContent } from '../components/Layout'

const fmt = n => n != null ? '$' + Math.round(n).toLocaleString('es-AR') : '—'
const fechaFmt = d => d ? new Date(d).toLocaleDateString('es-AR') : '—'
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function diasRestantes(fecha) {
  if (!fecha) return null
  return Math.ceil((new Date(fecha) - new Date()) / 86400000)
}

function colorDias(dias) {
  if (dias === null) return '#43483e'
  if (dias < 0)  return '#ffb4ab'
  if (dias <= 5) return '#e3b341'
  return '#acd292'
}

// ─── Badge de estado "En fabricación" (mismo lenguaje visual que Proyectos.jsx) ──
function EstadoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-medium uppercase tracking-wide bg-[#acd292]/[0.15] text-[#acd292] border border-[#acd292]/30">
      <span className="w-1 h-1 rounded-full flex-shrink-0 bg-[#acd292]" />
      En fabricación
    </span>
  )
}

// ─── Chip de riesgo (dot + mono, literal Tailwind) ────────────────────────────
function RiskChip({ dias }) {
  if (dias === null) return null
  const conf = dias < 0
    ? { color: '#ffb4ab', bg: 'rgba(255,180,171,0.15)', border: 'rgba(255,180,171,0.3)', label: `${Math.abs(dias)}D RETRASO` }
    : dias <= 5
    ? { color: '#e3b341', bg: 'rgba(227,179,65,0.15)',  border: 'rgba(227,179,65,0.3)',  label: dias === 0 ? 'ENTREGA HOY' : `${dias}D · EN RIESGO` }
    : { color: '#acd292', bg: 'rgba(172,210,146,0.15)', border: 'rgba(172,210,146,0.3)', label: 'A TIEMPO' }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-medium uppercase tracking-wide"
      style={{ background:conf.bg, color:conf.color, border:`1px solid ${conf.border}` }}
    >
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background:conf.color }} />
      {conf.label}
    </span>
  )
}

export default function Produccion() {
  const [tab, setTab] = useState('lista')
  const [proyectos, setProyectos] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mesCalendario, setMesCalendario] = useState(() => { const d = new Date(); d.setDate(1); return d })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: p, error: ep } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre, telefono, email)')
      .eq('estado', 'en_fabricacion')
      .order('fecha_entrega_estimada')
    if (ep) console.error('Error cargando produccion:', ep)
    const proyectosData = p || []
    setProyectos(proyectosData)

    if (proyectosData.length > 0) {
      const { data: o, error: eo } = await supabase
        .from('ordenes_trabajo')
        .select('proyecto_id, horas_fabricacion_estimadas, horas_instalacion_estimadas, tramos_instalacion')
        .in('proyecto_id', proyectosData.map(x => x.id))
      if (eo) console.error('Error cargando ordenes:', eo)
      setOrdenes(o || [])
    } else {
      setOrdenes([])
    }
    setLoading(false)
  }

  async function marcarEntregado(p) {
    setGuardando(true)
    const { error } = await supabase.from('proyectos').update({
      estado: 'entregado',
      fecha_entrega_real: new Date().toISOString().slice(0,10),
    }).eq('id', p.id)
    setGuardando(false)
    if (error) { alert('No se pudo marcar como entregado: ' + error.message); return }
    setSeleccionado(null)
    load()
  }

  const otPorProyecto = useMemo(() => {
    const map = {}
    for (const o of ordenes) { if (o.proyecto_id) map[o.proyecto_id] = o }
    return map
  }, [ordenes])

  const conRetraso = proyectos.filter(p => { const d = diasRestantes(p.fecha_entrega_estimada); return d !== null && d < 0 }).length
  const valorEnTaller = proyectos.reduce((s,p) => s + Number(p.valor_final || p.valor_estimado || 0), 0)
  const pctATiempo = proyectos.length > 0 ? Math.round(((proyectos.length - conRetraso) / proyectos.length) * 100) : 0

  // ── Proyecto más crítico (derivado de datos ya cargados, sin queries nuevas) ──
  const masCritico = useMemo(() => {
    let peor = null, peorDias = Infinity
    for (const p of proyectos) {
      const d = diasRestantes(p.fecha_entrega_estimada)
      if (d !== null && d < 0 && d < peorDias) { peorDias = d; peor = p }
    }
    return peor
  }, [proyectos])

  return (
    <Layout>
      <Topbar title="Producción" subtitle={`${proyectos.length} trabajos en taller${conRetraso > 0 ? ` · ${conRetraso} con retraso` : ''}`} />
      <PageContent>

        {/* ── Alerta crítica: proyectos con retraso (derivado de fecha_entrega_estimada) ── */}
        {!loading && conRetraso > 0 && masCritico && (
          <div className="flex items-center gap-3.5 px-[18px] py-3.5 mb-5 bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 rounded-lg">
            <div className="w-[34px] h-[34px] rounded flex-shrink-0 bg-[#ffb4ab] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-[#690005]">warning</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[10px] font-bold text-[#ffb4ab] uppercase tracking-[0.12em]">Alerta crítica</span>
              <p className="mt-[3px] text-[13px] text-[#e5e2e1] leading-relaxed">
                {conRetraso} proyecto{conRetraso !== 1 ? 's' : ''} con retraso en producción. El más urgente:{' '}
                <strong className="text-[#ffb4ab]">{masCritico.clientes?.nombre || 'Sin nombre'}</strong>
                {' '}— {Math.abs(diasRestantes(masCritico.fecha_entrega_estimada))}d de retraso sobre la entrega estimada ({fechaFmt(masCritico.fecha_entrega_estimada)}).
              </p>
            </div>
            <button
              onClick={() => setSeleccionado(masCritico)}
              className="flex-shrink-0 bg-transparent border border-[#ffb4ab]/35 text-[#ffb4ab] px-3 py-1.5 rounded font-mono text-[11px] uppercase tracking-wide hover:bg-[#ffb4ab]/10 transition-colors"
            >
              Ver detalle
            </button>
          </div>
        )}

        <div className="flex gap-6 mb-5 border-b border-[#2d2d2d]">
          {[['lista','Lista'],['gantt','Gantt'],['calendario','Calendario']].map(([v,l]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`pb-2.5 px-0.5 -mb-px text-[13px] font-medium border-b-2 transition-colors ${tab === v ? 'text-[#acd292] border-[#acd292]' : 'text-[#8d9386] border-transparent hover:text-[#e5e2e1]'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#43483e]">Cargando...</div>
        ) : proyectos.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#2d2d2d] rounded-xl text-[#43483e]">
            <div className="text-4xl mb-3">🔨</div>
            <p>No hay trabajos en producción actualmente</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded-lg px-[18px] py-[14px]">
                <div className="font-mono text-[9px] text-[#8d9386] uppercase tracking-widest mb-[5px]">En taller</div>
                <div className="font-mono text-2xl font-bold text-[#e5e2e1] leading-none">{proyectos.length}</div>
              </div>
              <div className="bg-[#acd292] rounded-lg px-[18px] py-[14px]">
                <div className="font-mono text-[9px] text-[#193708]/65 uppercase tracking-widest mb-[5px]">Valor en producción</div>
                <div className="font-mono text-2xl font-bold text-[#193708] leading-none">{fmt(valorEnTaller)}</div>
              </div>
              <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded-lg px-[18px] py-[14px]">
                <div className="font-mono text-[9px] text-[#8d9386] uppercase tracking-widest mb-[5px]">Con retraso</div>
                <div className="font-mono text-2xl font-bold text-[#e5e2e1] leading-none">{conRetraso}</div>
                <div className="font-mono text-[9px] text-[#43483e] mt-1 tracking-wide">{conRetraso > 0 ? 'requieren atención' : 'todo en fecha'}</div>
              </div>
            </div>

            {tab === 'lista' && (
              <div className="grid gap-3.5" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {proyectos.map(p => {
                  const dias = diasRestantes(p.fecha_entrega_estimada)
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSeleccionado(p)}
                      className="bg-[#1a1a1a]/80 backdrop-blur-sm border border-[#2d2d2d] rounded p-3.5 cursor-pointer hover:border-[#acd292] hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <div>
                          <div className="font-semibold text-[14.5px] text-[#e5e2e1]">{p.clientes?.nombre || 'Sin nombre'}</div>
                          <div className="text-[12.5px] text-[#c3c8ba] capitalize mt-0.5">{p.tipo_trabajo || p.descripcion || '—'}</div>
                        </div>
                        <EstadoBadge />
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="font-mono text-xs text-[#acd292]">{fmt(p.valor_final || p.valor_estimado)}</span>
                        <RiskChip dias={dias} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'gantt' && <GanttView proyectos={proyectos} otPorProyecto={otPorProyecto} onSeleccionar={setSeleccionado} />}
            {tab === 'calendario' && <CalendarioView proyectos={proyectos} mes={mesCalendario} setMes={setMesCalendario} onSeleccionar={setSeleccionado} />}

            {/* ── Footer stat strip: activas / a tiempo / con retraso (derivado, sin datos nuevos) ── */}
            <div className="mt-6 px-[22px] py-[14px] flex items-center gap-8 flex-wrap bg-[#0e0e0e] border border-[#2d2d2d] rounded-lg">
              <div className="flex flex-col gap-[3px]">
                <span className="font-mono text-[9px] text-[#8d9386] uppercase tracking-[0.12em]">Órdenes activas</span>
                <span className="font-mono text-xl font-bold text-[#e5e2e1]">{proyectos.length}</span>
              </div>
              <div className="w-px h-7 bg-[#2d2d2d]" />
              <div className="flex flex-col gap-[3px]">
                <span className="font-mono text-[9px] text-[#8d9386] uppercase tracking-[0.12em]">Tasa a tiempo</span>
                <span className="font-mono text-xl font-bold" style={{ color: pctATiempo >= 80 ? '#acd292' : pctATiempo >= 50 ? '#e3b341' : '#ffb4ab' }}>{pctATiempo}%</span>
              </div>
              <div className="w-px h-7 bg-[#2d2d2d]" />
              <div className="flex flex-col gap-[3px]">
                <span className="font-mono text-[9px] text-[#8d9386] uppercase tracking-[0.12em]">Con retraso</span>
                <span className="font-mono text-xl font-bold" style={{ color: conRetraso > 0 ? '#ffb4ab' : '#e5e2e1' }}>{conRetraso}</span>
              </div>
            </div>
          </>
        )}
      </PageContent>

      {seleccionado && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]" onClick={() => setSeleccionado(null)}>
          <div
            className="bg-[#1c1b1b] border border-[#2d2d2d] rounded-xl p-7 w-[440px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-1.5">
              <div>
                <h2 className="text-lg font-semibold text-[#e5e2e1] m-0">{seleccionado.clientes?.nombre || 'Sin nombre'}</h2>
                <div className="text-xs text-[#8d9386] capitalize mt-0.5">{seleccionado.tipo_trabajo || seleccionado.descripcion || '—'}</div>
              </div>
              <button onClick={() => setSeleccionado(null)} className="bg-transparent border-none text-[#8d9386] hover:text-[#e5e2e1] cursor-pointer text-lg leading-none transition-colors">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 my-3.5 mb-4">
              <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded-lg px-[18px] py-[14px]">
                <div className="font-mono text-[9px] text-[#8d9386] uppercase tracking-widest mb-[5px]">Valor</div>
                <div className="font-mono text-2xl font-bold text-[#e5e2e1] leading-none">{fmt(seleccionado.valor_final || seleccionado.valor_estimado)}</div>
              </div>
              <div className="bg-[#1c1b1b] border border-[#2d2d2d] rounded-lg px-[18px] py-[14px]">
                <div className="font-mono text-[9px] text-[#8d9386] uppercase tracking-widest mb-[5px]">Entrega estimada</div>
                <div className="font-mono text-2xl font-bold text-[#e5e2e1] leading-none">{fechaFmt(seleccionado.fecha_entrega_estimada)}</div>
              </div>
            </div>

            {(seleccionado.clientes?.telefono || seleccionado.clientes?.email) && (
              <div className="text-xs text-[#c3c8ba] mb-4 flex gap-3.5">
                {seleccionado.clientes?.telefono && <span>📞 {seleccionado.clientes.telefono}</span>}
                {seleccionado.clientes?.email && <span>✉️ {seleccionado.clientes.email}</span>}
              </div>
            )}

            {seleccionado.fecha_inicio_fabricacion && (
              <div className="text-[12.5px] text-[#c3c8ba] mb-[18px]">
                En fabricación desde {fechaFmt(seleccionado.fecha_inicio_fabricacion)}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => marcarEntregado(seleccionado)}
                disabled={guardando}
                className="bg-[#acd292] text-[#193708] px-[18px] py-2 rounded text-[12.5px] font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {guardando ? 'Guardando...' : 'Marcar entregado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ─── Gantt ──────────────────────────────────────────────────────────────────
// Escala simple de 8 semanas. Cada fila es un proyecto: barra de fabricacion +
// tramos de instalacion al final (si estan cargados). Si no hay horas cargadas
// todavia, se muestra una barra unica de "en fabricacion" sin split.
// (Matemática de posicionamiento sin tocar — solo se restyleó con Tailwind
// literal sobre las mismas variables x1/x2/xSplit/xHoy en %.)
function GanttView({ proyectos, otPorProyecto, onSeleccionar }) {
  const inicio = new Date(); inicio.setHours(0,0,0,0); inicio.setDate(inicio.getDate() - inicio.getDay() + 1)
  const totalDias = 56 // 8 semanas
  const fin = new Date(inicio); fin.setDate(fin.getDate() + totalDias)

  function pos(fecha) {
    const d = (new Date(fecha) - inicio) / 86400000
    return Math.max(0, Math.min(100, (d / totalDias) * 100))
  }

  const xHoy = pos(new Date())

  return (
    <div>
      <div className="flex justify-between px-1 mb-2 font-mono text-[11px] text-[#43483e]">
        <span>{inicio.toLocaleDateString('es-AR')}</span>
        <span>8 semanas →</span>
        <span>{fin.toLocaleDateString('es-AR')}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {proyectos.map(p => {
          const ot = otPorProyecto[p.id]
          const desde = p.fecha_inicio_fabricacion || new Date().toISOString().slice(0,10)
          const hasta = p.fecha_entrega_estimada || desde
          const hf = Number(ot?.horas_fabricacion_estimadas || 0)
          const hi = Number(ot?.horas_instalacion_estimadas || 0)
          const totalH = hf + hi
          const pctFab = totalH > 0 ? hf / totalH : 0.8
          const x1 = pos(desde), x2 = pos(hasta)
          const xSplit = x1 + (x2 - x1) * pctFab
          const tramos = ot?.tramos_instalacion
          return (
            <div key={p.id} className="flex items-center gap-3 cursor-pointer" onClick={() => onSeleccionar(p)}>
              <div className="w-[150px] flex-shrink-0 text-[12.5px] text-[#e5e2e1] overflow-hidden text-ellipsis whitespace-nowrap">
                {p.clientes?.nombre || 'Sin nombre'}
              </div>
              <div
                className="flex-1 relative h-[22px] bg-[#0e0e0e] rounded border border-[#2d2d2d]"
                style={{ backgroundImage:'repeating-linear-gradient(to right, #2d2d2d 0, #2d2d2d 1px, transparent 1px, transparent 12.5%)' }}
              >
                <div className="absolute -top-0.5 -bottom-0.5 w-px bg-[#acd292] shadow-[0_0_6px_rgba(172,210,146,0.5)]" style={{ left:`${xHoy}%` }} />
                <div
                  title={`Fabricación: ${hf || '—'}h`}
                  className="absolute top-0.5 bottom-0.5 bg-[#acd292] rounded"
                  style={{ left:`${x1}%`, width:`${Math.max(1,xSplit-x1)}%` }}
                />
                <div
                  title={`Instalación: ${hi || '—'}h${tramos ? ` en ${tramos.length} tramos` : ''}`}
                  className="absolute top-0.5 bottom-0.5 bg-[#f8b2d9] rounded"
                  style={{ left:`${xSplit}%`, width:`${Math.max(1,x2-xSplit)}%` }}
                />
              </div>
              <div className="w-[70px] flex-shrink-0 font-mono text-[11px] text-[#43483e] text-right">{fechaFmt(hasta)}</div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-4 text-[11px] text-[#43483e]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#acd292]" />Fabricación</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#f8b2d9]" />Instalación</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-0.5 h-2.5 bg-[#acd292]" />Hoy</span>
        <span>Sin horas cargadas todavía: la barra usa una proporción por defecto (80/20).</span>
      </div>
    </div>
  )
}

// ─── Calendario ─────────────────────────────────────────────────────────────
function CalendarioView({ proyectos, mes, setMes, onSeleccionar }) {
  const anio = mes.getFullYear(), mesIdx = mes.getMonth()
  const primerDia = new Date(anio, mesIdx, 1)
  const ultimoDia = new Date(anio, mesIdx + 1, 0)
  const offset = (primerDia.getDay() + 6) % 7 // lunes=0
  const dias = []
  for (let i = 0; i < offset; i++) dias.push(null)
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(anio, mesIdx, d))

  const porDia = useMemo(() => {
    const map = {}
    for (const p of proyectos) {
      if (!p.fecha_entrega_estimada) continue
      const key = p.fecha_entrega_estimada.slice(0,10)
      ;(map[key] ||= []).push(p)
    }
    return map
  }, [proyectos])

  function cambiarMes(delta) {
    const d = new Date(mes); d.setMonth(d.getMonth() + delta); setMes(d)
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-4 mb-3.5">
        <button onClick={() => cambiarMes(-1)} className="bg-transparent border border-[#2d2d2d] rounded text-[#c3c8ba] cursor-pointer px-2.5 py-1 hover:border-[#acd292] hover:text-[#e5e2e1] transition-colors">‹</button>
        <div className="text-sm font-semibold text-[#e5e2e1] min-w-[160px] text-center">{MESES[mesIdx]} {anio}</div>
        <button onClick={() => cambiarMes(1)} className="bg-transparent border border-[#2d2d2d] rounded text-[#c3c8ba] cursor-pointer px-2.5 py-1 hover:border-[#acd292] hover:text-[#e5e2e1] transition-colors">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="font-mono text-[10px] text-[#43483e] text-center uppercase tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {dias.map((d, i) => {
          if (!d) return <div key={i} />
          const key = d.toISOString().slice(0,10)
          const entregas = porDia[key] || []
          const hoy = key === new Date().toISOString().slice(0,10)
          return (
            <div
              key={i}
              className={`min-h-[74px] rounded-lg border p-1.5 ${hoy ? 'border-[#acd292]' : 'border-[#2d2d2d]'} ${entregas.length > 0 ? 'bg-[#acd292]/[0.14]' : 'bg-[#1c1b1b]'}`}
            >
              <div className={`font-mono text-[11px] mb-1 ${hoy ? 'text-[#c7eeac]' : 'text-[#43483e]'}`}>{d.getDate()}</div>
              {entregas.slice(0,2).map(p => (
                <div
                  key={p.id}
                  onClick={() => onSeleccionar(p)}
                  className="text-[10px] text-[#e5e2e1] bg-[#1c1b1b] rounded px-[5px] py-0.5 mb-0.5 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {p.clientes?.nombre || 'Sin nombre'}
                </div>
              ))}
              {entregas.length > 2 && <div className="text-[9px] text-[#43483e]">+{entregas.length-2} más</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
