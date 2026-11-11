import React, { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authFetch as fetch } from '../lib/authFetch'
import { Layout, Topbar, PageContent } from '../components/Layout'
import { Card, Btn, SectionTitle } from '../components/ui'
import { imagenAJpeg, pdfAJpegs, girar, ResumenOrden } from './Cotizador'
const Vista3D = lazy(() => import('../components/Vista3D'))

// Nuevo trabajo (ERP v2): plano / foto / bosquejo / medidas -> diseño editable -> render -> cotización -> OT en cola.
// Cada paso es una acción de zebrano-cotizador v65.
const FN = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/zebrano-cotizador`
const PASOS = ['Para quién y qué', 'Diseño', 'Render', 'Cotización', 'Orden de trabajo']
const FAMILIAS = ['bajo', 'alacena', 'columna', 'placard', 'cajonera', 'abierto']
const ETAPAS_MO = ['corte', 'canteado', 'armado', 'terminacion', 'instalacion']
const TERMINACIONES = [['sin definir', 'Sin definir (preguntar)'], ['melamina', 'Melamina (sin pintar)'], ['laqueado sintetico', 'Laqueado sintético'], ['laqueado al agua', 'Laqueado al agua'], ['lustrado', 'Lustrado poliuretano']]
const COLS = [['nombre', 'Módulo', 'text', 130], ['familia', 'Familia', FAMILIAS, 95], ['ancho_mm', 'Ancho', 'n'], ['alto_mm', 'Alto', 'n'], ['prof_mm', 'Prof.', 'n'],
  ['puertas', 'Puertas', 'n'], ['cajones', 'Cajones', 'n'], ['estantes', 'Estantes', 'n'], ['frentes', 'Frentes', ['superpuestos', 'embutidos'], 110],
  ['patas', 'Patas', 'n'], ['zocalo_mm', 'Zócalo', 'n'], ['terminaciones', 'Lat. term.', 'n'], ['cantidad', 'Cant.', 'n'], ['material', 'Material', 'text', 190]]
const $ = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR')
const nuevoModulo = mat => ({ nombre: 'Módulo', familia: 'bajo', ancho_mm: 600, alto_mm: 720, prof_mm: 550, puertas: 2, cajones: 0, estantes: 1, frentes: 'superpuestos', patas: 0, zocalo_mm: 0, terminaciones: 0, cantidad: 1, material: mat || 'Melamina blanco mate 18mm' })

async function llamar(body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!d.ok) throw new Error(d.error || `Error ${r.status}`)
  return d
}

export default function NuevoTrabajo() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [paso, setPaso] = useState(0)
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')
  const [sid, setSid] = useState(null)
  // Paso 1
  const [para, setPara] = useState(params.get('prospecto') ? 'prospecto' : 'cliente')
  const [clientes, setClientes] = useState([]), [prospectos, setProspectos] = useState([]), [obras, setObras] = useState([])
  const [clienteId, setClienteId] = useState(params.get('cliente') || ''), [prospectoId, setProspectoId] = useState(params.get('prospecto') || ''), [obraId, setObraId] = useState(params.get('obra') || '')
  const [texto, setTexto] = useState('')
  const [imagenes, setImagenes] = useState([])
  // Paso 2+
  const [modulos, setModulos] = useState([]), [manoObra, setManoObra] = useState([]), [estilo, setEstilo] = useState(''), [tipo, setTipo] = useState('')
  const [terminacion, setTerminacion] = useState('sin definir'), [m2Term, setM2Term] = useState('')
  const [preguntas, setPreguntas] = useState([]), [svg, setSvg] = useState(null)
  const [render, setRender] = useState(null), [cambio, setCambio] = useState('')
  const visor3d = useRef(null)
  const [cot, setCot] = useState(null), [ot, setOt] = useState(null)

  useEffect(() => {
    supabase.from('clientes').select('id,nombre,telefono,email').eq('activo', true).order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('prospectos').select('id,nombre,apellido,telefono,email,tipo_trabajo,descripcion_proyecto').eq('activo', true).eq('convertido_a_cliente', false).order('created_at', { ascending: false }).limit(300).then(({ data }) => setProspectos(data || []))
  }, [])
  useEffect(() => {
    if (para !== 'cliente' || !clienteId) { setObras([]); return }
    supabase.from('obras').select('id,nombre,direccion').eq('cliente_id', clienteId).order('created_at', { ascending: false }).then(({ data }) => setObras(data || []))
  }, [para, clienteId])
  // ?sesion=ID: abre el diseño de una sesión del Cotizador AI directo en el paso 2 para editar los módulos.
  useEffect(() => {
    const id = params.get('sesion')
    if (!id) return
    Promise.all([
      supabase.from('cotizacion_diseno').select('modulos,svg_tecnico,render_fotorrealista_url').eq('sesion_id', id).maybeSingle(),
      supabase.from('cotizacion_sesiones').select('tipo_trabajo,contexto_extra').eq('id', id).maybeSingle(),
    ]).then(([{ data: d }, { data: se }]) => {
      const cx = se?.contexto_extra || {}
      setSid(id); setModulos((d?.modulos || []).filter(m => m.puertas !== undefined)); setSvg(d?.svg_tecnico || null); setRender(d?.render_fotorrealista_url || null)
      setManoObra(cx.mano_obra || []); setEstilo(cx.estilo || ''); setTipo(se?.tipo_trabajo || ''); setTerminacion(cx.terminacion || 'sin definir')
      setPaso(1)
    })
  }, [])

  useEffect(() => { // el prospecto ya trae lo que pidió: arranca el texto con eso
    const p = prospectos.find(x => x.id === prospectoId)
    if (para === 'prospecto' && p && !texto) setTexto([p.tipo_trabajo, p.descripcion_proyecto].filter(Boolean).join('. '))
  }, [prospectoId, prospectos])

  async function paso_(nombre, fn) {
    setOcupado(nombre); setError('')
    try { await fn() } catch (e) { setError(e.message) } finally { setOcupado('') }
  }

  async function agregarArchivos(files) {
    const out = []
    for (const f of files) {
      if (f.type === 'application/pdf') out.push(...await pdfAJpegs(f))
      else if (f.type.startsWith('image/')) out.push(await imagenAJpeg(URL.createObjectURL(f)))
    }
    setImagenes(i => [...i, ...out].slice(0, 6))
  }

  const leer = () => paso_('Leyendo el plano y armando los módulos…', async () => {
    if (!texto.trim() && !imagenes.length) throw new Error('Escribí las medidas o subí un plano, foto o bosquejo.')
    const d = await llamar({ accion: 'leer', origen: 'web', mensaje: texto, imagenes_base64: imagenes.map(x => x.split(',')[1]),
      ...(para === 'cliente' ? { cliente_id: clienteId || null, obra_id: obraId || null } : {}), ...(para === 'prospecto' ? { prospecto_id: prospectoId || null } : {}) })
    setSid(d.sesion_id)
    const c = para === 'cliente' ? clientes.find(x => x.id === clienteId) : prospectos.find(x => x.id === prospectoId)
    if (c) await supabase.from('cotizacion_sesiones').update({ cliente_nombre: [c.nombre, c.apellido].filter(Boolean).join(' '), cliente_telefono: c.telefono || null, cliente_email: c.email || null }).eq('id', d.sesion_id)
    setModulos(d.modulos); setManoObra(d.mano_obra || []); setEstilo(d.estilo || ''); setTipo(d.tipo_trabajo || ''); setTerminacion(d.terminacion || 'sin definir'); setPreguntas(d.preguntas || []); setSvg(d.svg_tecnico)
    setPaso(1)
  })

  const guardar = () => llamar({ accion: 'guardar_diseno', sesion_id: sid, modulos, mano_obra: manoObra, estilo, tipo_trabajo: tipo, terminacion, laqueado_m2: Number(m2Term) || 0 }).then(d => { setModulos(d.modulos); setSvg(d.svg_tecnico) })
  const pedirRender = (conCambio) => paso_('Generando el render (puede tardar un minuto)…', async () => {
    if (!conCambio) await guardar()
    const d = await llamar({ accion: 'render', sesion_id: sid, cambio: conCambio ? cambio : undefined, base_3d: conCambio ? undefined : visor3d.current?.captura() || undefined })
    setRender(d.render_url); setCambio(''); setPaso(2)
  })
  const cotizar = (guardarAntes) => paso_('Calculando materiales, herrajes y mano de obra…', async () => {
    if (guardarAntes) await guardar()
    setCot(await llamar({ accion: 'cotizar', sesion_id: sid, mano_obra: manoObra, terminacion, laqueado_m2: Number(m2Term) || 0 })); setPaso(3)
  })
  const aprobar = () => window.confirm('¿Aprobar la cotización y crear la orden de trabajo? Queda en la cola de fábrica, sin fecha de inicio.') &&
    paso_('Creando obra, trabajo y orden de trabajo…', async () => { setOt(await llamar({ aprobar_cotizacion: true, sesion_id: sid })); setPaso(4) })

  const setMod = (i, k, v) => setModulos(ms => ms.map((m, j) => j === i ? { ...m, [k]: v } : m))
  const setMo = (i, k, v) => setManoObra(ms => ms.map((m, j) => j === i ? { ...m, [k]: v } : m))
  const resumen = cot?.resumen
  const horasPersona = manoObra.reduce((a, m) => a + (Number(m.horas_estimadas) || 0) * (Number(m.operarios) || 1), 0)

  return (
    <Layout>
      <Topbar title="Nuevo trabajo" subtitle="Plano, foto o medidas → diseño → render → cotización → orden de trabajo" />
      <PageContent>
        <div className="z-seg mb-5" role="group" aria-label="Pasos" style={{ flexWrap: 'wrap' }}>
          {PASOS.map((p, i) => <button key={p} aria-pressed={paso === i} aria-current={paso === i ? 'step' : undefined} disabled={i > paso || !!ot} onClick={() => setPaso(i)}>{i + 1}. {p}</button>)}
        </div>
        {error && <Card style={{ marginBottom: 14, borderColor: 'rgb(var(--z-danger-c))' }}><span role="alert">{error}</span></Card>}
        {ocupado && <Card style={{ marginBottom: 14 }}><span aria-live="polite">⏳ {ocupado}</span></Card>}

        {paso === 0 && <Card>
          <SectionTitle>¿Para quién es?</SectionTitle>
          <div className="z-seg mb-4" role="group" aria-label="Destinatario">
            {[['cliente', 'Cliente'], ['prospecto', 'Prospecto'], ['nuevo', 'Cliente nuevo']].map(([k, l]) => <button key={k} aria-pressed={para === k} onClick={() => setPara(k)}>{l}</button>)}
          </div>
          {para === 'cliente' && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <label style={{ flex: '1 1 240px' }}>Cliente<select value={clienteId} onChange={e => { setClienteId(e.target.value); setObraId('') }}>
              <option value="">Elegí un cliente…</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <label style={{ flex: '1 1 240px' }}>Obra<select value={obraId} onChange={e => setObraId(e.target.value)} disabled={!clienteId}>
              <option value="">Obra nueva (se crea al aprobar)</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}{o.direccion ? ` — ${o.direccion}` : ''}</option>)}</select></label>
          </div>}
          {para === 'prospecto' && <label style={{ display: 'block', marginBottom: 14 }}>Prospecto<select value={prospectoId} onChange={e => setProspectoId(e.target.value)}>
            <option value="">Elegí un prospecto…</option>{prospectos.map(p => <option key={p.id} value={p.id}>{[p.nombre, p.apellido].filter(Boolean).join(' ')}{p.tipo_trabajo ? ` · ${p.tipo_trabajo}` : ''}</option>)}</select></label>}
          {para === 'nuevo' && <p style={{ color: 'var(--z-text-2)', marginBottom: 14 }}>Poné nombre y teléfono en el texto: el cliente se crea al aprobar la cotización.</p>}
          <SectionTitle>¿Qué hay que hacer?</SectionTitle>
          <textarea rows={5} style={{ width: '100%' }} value={texto} onChange={e => setTexto(e.target.value)} aria-label="Descripción y medidas"
            placeholder="Ej.: cocina con bajo mesada de 2,40 m (720 x 550) con cajonera de 3 cajones, alacena de 1,80 m (700 x 350), melamina blanca, patas regulables." />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '12px 0' }}>
            <label className="btn btn-secondary btn-sm"><span className="material-symbols-outlined">upload</span>Plano, foto, bosquejo o PDF
              <input type="file" accept="image/*,application/pdf" multiple hidden onChange={e => agregarArchivos([...e.target.files]).catch(x => setError(x.message))} /></label>
            {imagenes.map((src, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <img src={src} alt={`Adjunto ${i + 1}`} style={{ height: 44, borderRadius: 6 }} />
              <button className="btn btn-quiet btn-sm" title="Girar 90°" aria-label={`Girar adjunto ${i + 1}`} onClick={() => girar(src).then(g => setImagenes(im => im.map((x, j) => j === i ? g : x)))}>↻</button>
              <button className="btn btn-quiet btn-sm" title="Quitar" aria-label={`Quitar adjunto ${i + 1}`} onClick={() => setImagenes(im => im.filter((_, j) => j !== i))}>✕</button></span>)}
            {imagenes.length > 0 && <span className="text-[12px]" style={{ color: 'var(--z-text-3)' }}>Si el plano está de costado, giralo con ↻ hasta que los textos se lean derechos: el agente lo lee mucho mejor.</span>}
          </div>
          <Btn icon="auto_awesome" onClick={leer} disabled={!!ocupado || (para === 'cliente' && !clienteId) || (para === 'prospecto' && !prospectoId)}>Leer y armar el diseño</Btn>
        </Card>}

        {paso === 1 && <>
          {preguntas.length > 0 && <Card style={{ marginBottom: 14 }}><SectionTitle>Para confirmar con el cliente</SectionTitle>
            <ul style={{ paddingLeft: 18 }}>{preguntas.map((p, i) => <li key={i}>{p}</li>)}</ul></Card>}
          <Card style={{ marginBottom: 14 }}>
            <SectionTitle action={<Btn small variant="ghost" icon="add" onClick={() => setModulos(m => [...m, nuevoModulo(m[0]?.material)])}>Módulo</Btn>}>Módulos (medidas del casco, en mm)</SectionTitle>
            <div style={{ overflowX: 'auto' }}><table className="z-table"><thead><tr>{COLS.map(c => <th key={c[0]}>{c[1]}</th>)}<th /></tr></thead>
              <tbody>{modulos.map((m, i) => <tr key={i}>{COLS.map(([k, , t, w]) => <td key={k}>
                {Array.isArray(t) ? <select value={m[k]} onChange={e => setMod(i, k, e.target.value)} style={{ width: w }} aria-label={k}>{t.map(o => <option key={o}>{o}</option>)}</select>
                  : <input value={m[k] ?? ''} type={t === 'n' ? 'number' : 'text'} min={0} onChange={e => setMod(i, k, t === 'n' ? Number(e.target.value) : e.target.value)} style={{ width: w || 70 }} aria-label={k} />}</td>)}
                <td><button className="btn btn-quiet btn-sm" aria-label="Quitar módulo" onClick={() => setModulos(ms => ms.filter((_, j) => j !== i))}>✕</button></td></tr>)}</tbody></table></div>
          </Card>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <Card style={{ flex: '1 1 320px' }}><SectionTitle>Mano de obra · {horasPersona.toFixed(1)} h-persona</SectionTitle>
              {manoObra.map((m, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <select value={m.etapa} onChange={e => setMo(i, 'etapa', e.target.value)} aria-label="Etapa">{ETAPAS_MO.map(o => <option key={o}>{o}</option>)}</select>
                <input type="number" step="0.5" min={0} value={m.horas_estimadas} onChange={e => setMo(i, 'horas_estimadas', Number(e.target.value))} style={{ width: 70 }} aria-label="Horas" /> h ×
                <input type="number" min={1} value={m.operarios} onChange={e => setMo(i, 'operarios', Number(e.target.value))} style={{ width: 56 }} aria-label="Personas" /> pers.
                <button className="btn btn-quiet btn-sm" aria-label="Quitar etapa" onClick={() => setManoObra(ms => ms.filter((_, j) => j !== i))}>✕</button></div>)}
              <Btn small variant="ghost" icon="add" onClick={() => setManoObra(ms => [...ms, { etapa: 'armado', horas_estimadas: 0, operarios: 1 }])}>Etapa</Btn>
              <label style={{ display: 'block', marginTop: 12 }}>Terminación<select value={terminacion} onChange={e => setTerminacion(e.target.value)}>
                {TERMINACIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              {/laque|lustr/.test(terminacion) && <label style={{ display: 'block', marginTop: 8 }}>m² a terminar (vacío = frentes de ambas caras + laterales a la vista)
                <input type="number" min={0} step="0.1" value={m2Term} onChange={e => setM2Term(e.target.value)} /></label>}
              <label style={{ display: 'block', marginTop: 12 }}>Estilo para el render<input value={estilo} onChange={e => setEstilo(e.target.value)} /></label>
            </Card>
            <Card style={{ flex: '2 1 420px' }}><SectionTitle>Vista 3D y plano</SectionTitle>
              {/* El 3D se arma con la tabla de arriba y es la base del render: la IA lo viste de foto de catálogo sin cambiar la geometría. */}
              <Suspense fallback={null}><Vista3D ref={visor3d} modulos={modulos} alto={320} /></Suspense>
              <p style={{ fontSize: 12, color: 'var(--z-text-3)', margin: '6px 0 10px' }}>Arrastrá para girar. El render parte de esta vista: dejala en el ángulo que quieras mostrar.</p>
              {svg ? <img alt="Plano técnico" style={{ width: '100%', background: '#fff', borderRadius: 8 }} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} /> : <p>Sin plano.</p>}
              <div style={{ marginTop: 10 }}><Btn small variant="ghost" icon="refresh" disabled={!!ocupado} onClick={() => paso_('Actualizando el plano…', guardar)}>Actualizar plano</Btn></div>
            </Card>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn icon="image" disabled={!!ocupado || !modulos.length} onClick={() => pedirRender(false)}>Aprobar diseño y generar render</Btn>
            <Btn variant="secondary" disabled={!!ocupado || !modulos.length} onClick={() => cotizar(true)}>Cotizar sin render</Btn>
          </div>
        </>}

        {paso === 2 && <Card>
          {render ? <img src={render} alt="Render del mueble" style={{ width: '100%', maxHeight: 520, objectFit: 'contain', borderRadius: 10 }} /> : <p>No hay render; podés cotizar igual.</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <input style={{ flex: '1 1 300px' }} value={cambio} onChange={e => setCambio(e.target.value)} placeholder="Pedir un cambio (ej.: tiradores negros, sin alacena del medio)" aria-label="Cambio del render" />
            <Btn variant="secondary" icon="edit" disabled={!!ocupado || !cambio.trim()} onClick={() => pedirRender(true)}>Rehacer render</Btn>
            <Btn icon="request_quote" disabled={!!ocupado} onClick={() => cotizar(false)}>Cotizar</Btn>
          </div>
          <p style={{ color: 'var(--z-text-2)', fontSize: 13, marginTop: 8 }}>Para cambiar medidas o módulos volvé al paso 2: el render es solo la imagen.</p>
        </Card>}

        {paso === 3 && resumen && <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <Card style={{ flex: '1 1 200px' }}><div style={{ color: 'var(--z-text-2)' }}>Precio sin factura</div><div style={{ fontSize: 28, fontWeight: 700 }}>{$(resumen.precioSugerido)}</div></Card>
            <Card style={{ flex: '1 1 200px' }}><div style={{ color: 'var(--z-text-2)' }}>En dólares</div><div style={{ fontSize: 28, fontWeight: 700 }}>USD {resumen.precioUsd?.toLocaleString('es-AR') ?? '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--z-text-2)' }}>oficial BCRA {resumen.tcUsd ? $(resumen.tcUsd) : '—'}</div></Card>
            <div style={{ flex: '1 1 260px' }}><ResumenOrden r={resumen} /></div>
          </div>
          <Card style={{ marginBottom: 14 }}><div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{cot.respuesta}</div></Card>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {resumen.documento_url && <a className="btn btn-secondary" href={resumen.documento_url} target="_blank" rel="noreferrer"><span className="material-symbols-outlined">picture_as_pdf</span>Presupuesto para el cliente</a>}
            <Btn variant="ghost" onClick={() => setPaso(1)}>Ajustar diseño u horas</Btn>
            <Btn icon="task_alt" disabled={!!ocupado} onClick={aprobar}>Aprobar y crear la OT</Btn>
          </div>
        </>}

        {paso === 4 && ot && <Card>
          <SectionTitle>Listo</SectionTitle>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 14 }}>{ot.respuesta}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn icon="precision_manufacturing" onClick={() => navigate('/produccion')}>Ver la cola de fábrica</Btn>
            <Btn variant="secondary" onClick={() => navigate('/proyectos')}>Ver en Proyectos</Btn>
            <Btn variant="ghost" onClick={() => window.location.reload()}>Otro trabajo</Btn>
          </div>
        </Card>}
      </PageContent>
    </Layout>
  )
}
