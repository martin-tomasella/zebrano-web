import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Oficina virtual de agentes (14/11/2026). Escena low-poly: ventanal con ciudad, áreas con mesa larga, un escritorio
// por agente, TV con el tablero, zona de descanso. Los estados salen de oficina_estado(); no hay datos inventados.
// Unidades: 1 = 1 metro. x a la derecha, z hacia la cámara.

import { AREAS, COLOR_ESTADO } from '../lib/oficina'

// Cartel con fondo redondeado (sprite). Se regenera solo si cambia el texto.
function cartel(texto, { fondo = 'rgba(28,28,30,0.88)', color = '#fff', punto = null, tam = 34, alto = 0.42 } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d')
  x.font = `600 ${tam}px Inter, system-ui, sans-serif`
  const w = Math.ceil(x.measureText(texto).width) + (punto ? 70 : 44), h = tam + 26
  c.width = w; c.height = h
  x.font = `600 ${tam}px Inter, system-ui, sans-serif`
  x.fillStyle = fondo; x.beginPath(); x.roundRect(0, 0, w, h, h / 2); x.fill()
  if (punto) { x.fillStyle = punto; x.beginPath(); x.arc(28, h / 2, 10, 0, Math.PI * 2); x.fill() }
  x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(texto, punto ? 48 : 22, h / 2 + 1)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }))
  s.scale.set(alto * w / h, alto, 1); s.renderOrder = 10
  return s
}
const caja = (w, h, d, color, opts = {}) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }))

// Muñequito low-poly: cuerpo del color del agente, cabeza, brazos. Devuelve el grupo y sus partes para animar.
function persona(color) {
  const g = new THREE.Group()
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }))
  cuerpo.position.y = 0.78; g.add(cuerpo)
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), new THREE.MeshStandardMaterial({ color: '#e0b48f', roughness: 0.6 }))
  cabeza.position.y = 1.24; g.add(cabeza)
  const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), new THREE.MeshStandardMaterial({ color: '#3b2a20' }))
  pelo.position.y = 1.27; g.add(pelo)
  const brazoI = caja(0.09, 0.42, 0.09, color), brazoD = caja(0.09, 0.42, 0.09, color)
  brazoI.geometry.translate(0, -0.2, 0); brazoD.geometry.translate(0, -0.2, 0)
  brazoI.position.set(-0.27, 1.0, 0); brazoD.position.set(0.27, 1.0, 0)
  g.add(brazoI, brazoD)
  const piernas = caja(0.36, 0.42, 0.16, '#3d4148'); piernas.position.y = 0.3; g.add(piernas)
  return { g, cuerpo, cabeza, brazoI, brazoD }
}

export default function Oficina3D({ datos, vista, seguir, onSelect, alto = 560 }) {
  const caja3d = useRef(null), st = useRef({})

  // Escena fija (una vez)
  useEffect(() => {
    const el = caja3d.current, w = el.clientWidth || 900
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, alto)
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#dfe6e9')
    scene.add(new THREE.HemisphereLight('#ffffff', '#8c8478', 1.25))
    const sol = new THREE.DirectionalLight('#fff4e0', 1.6); sol.position.set(-12, 22, 14); sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048); Object.assign(sol.shadow.camera, { left: -26, right: 26, top: 20, bottom: -20 }); scene.add(sol)
    const camera = new THREE.PerspectiveCamera(38, w / alto, 0.1, 300)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.15; controls.minDistance = 6; controls.maxDistance = 60

    // Piso, ventanal y ciudad
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), new THREE.MeshStandardMaterial({ color: '#cfccc6', roughness: 0.95 }))
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso)
    const vidrio = new THREE.MeshStandardMaterial({ color: '#a9c7d6', transparent: true, opacity: 0.18, roughness: 0.1 })
    for (let i = -22; i <= 22; i += 2.2) { const m = caja(0.08, 3.6, 0.08, '#55595f'); m.position.set(i, 1.8, -13.5); scene.add(m) }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(44, 3.6, 0.04), vidrio); panel.position.set(0, 1.8, -13.5); scene.add(panel)
    const baranda = caja(44, 0.06, 0.06, '#55595f'); baranda.position.set(0, 1.1, -13.4); scene.add(baranda)
    const pared = caja(0.3, 3.6, 30, '#ece9e4'); pared.position.set(-22, 1.8, 1.5); scene.add(pared)
    const ciudad = new THREE.Group(), azotea = ['#d9d2c5', '#c9b8a6', '#b9c7b0', '#d6a58c', '#a7b6c2']
    for (let i = 0; i < 160; i++) {
      const h = 1 + Math.random() * 7, b = caja(1.4 + Math.random() * 1.6, h, 1.4 + Math.random() * 1.6, azotea[i % azotea.length])
      b.position.set(-40 + Math.random() * 80, h / 2 - 6, -20 - Math.random() * 40); ciudad.add(b)
    }
    const verde = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshStandardMaterial({ color: '#b6c9a5' }))
    verde.rotation.x = -Math.PI / 2; verde.position.set(0, -6, -60); ciudad.add(verde); scene.add(ciudad)

    // Zona de descanso
    const d = AREAS.descanso
    const sofa = caja(3.2, 0.45, 0.9, '#7d8a8f'); sofa.position.set(d.x, 0.25, d.z); sofa.castShadow = true
    const resp = caja(3.2, 0.7, 0.25, '#6f7b80'); resp.position.set(d.x, 0.6, d.z - 0.45)
    const mesita = caja(1.2, 0.35, 0.7, '#a07850'); mesita.position.set(d.x, 0.18, d.z + 1.2)
    const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.5, 10), new THREE.MeshStandardMaterial({ color: '#d9d4cc' })); maceta.position.set(d.x + 2.2, 0.25, d.z - 0.3)
    const planta = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 7), new THREE.MeshStandardMaterial({ color: '#4f7a4a' })); planta.position.set(d.x + 2.2, 1.1, d.z - 0.3)
    scene.add(sofa, resp, mesita, maceta, planta)
    const lblDesc = cartel(d.label, { tam: 32, alto: 0.8 }); lblDesc.position.set(d.x, 2.3, d.z); scene.add(lblDesc)

    // TV del tablero (textura que se actualiza con los datos)
    const tvCanvas = document.createElement('canvas'); tvCanvas.width = 1024; tvCanvas.height = 576
    const tvTex = new THREE.CanvasTexture(tvCanvas); tvTex.colorSpace = THREE.SRGBColorSpace
    const tv = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 0.1), [caja(1, 1, 1, '#111').material, caja(1, 1, 1, '#111').material, caja(1, 1, 1, '#111').material, caja(1, 1, 1, '#111').material, new THREE.MeshBasicMaterial({ map: tvTex }), caja(1, 1, 1, '#111').material])
    tv.position.set(2, 2.1, 6.2); tv.castShadow = true
    const pie = caja(0.15, 1.0, 0.15, '#222'); pie.position.set(2, 0.5, 6.2)
    const baseTv = caja(1.6, 0.06, 0.6, '#222'); baseTv.position.set(2, 0.03, 6.2)
    scene.add(tv, pie, baseTv)
    // Banquetas
    ;[[0.6, 8.5], [2, 8.9], [3.4, 8.5]].forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 12), new THREE.MeshStandardMaterial({ color: '#8d8f93' })); b.position.set(x, 0.23, z); b.castShadow = true; scene.add(b) })

    const dinamico = new THREE.Group(); scene.add(dinamico)
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2()
    const click = e => {
      const r = renderer.domElement.getBoundingClientRect()
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(mouse, camera)
      const hit = ray.intersectObjects(dinamico.children, true).find(h => { let o = h.object; while (o && !o.userData.slug) o = o.parent; return o })
      if (hit) { let o = hit.object; while (!o.userData.slug) o = o.parent; st.current.onSelect?.(o.userData.slug) }
    }
    renderer.domElement.addEventListener('click', click)

    let raf = 0; const reloj = new THREE.Clock()
    const loop = () => {
      const t = reloj.getElapsedTime(), s = st.current
      for (const a of s.anim || []) a(t)
      if (s.seguir && s.puestos?.[s.seguir]) { const p = s.puestos[s.seguir].obj.getWorldPosition(new THREE.Vector3()); controls.target.lerp(p, 0.08); camera.position.lerp(p.clone().add(new THREE.Vector3(3.5, 4.5, 6)), 0.04) }
      controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop)
    }
    const ro = new ResizeObserver(() => { const ww = el.clientWidth || w; renderer.setSize(ww, alto); camera.aspect = ww / alto; camera.updateProjectionMatrix() })
    ro.observe(el)
    st.current = { renderer, scene, camera, controls, dinamico, tvCanvas, tvTex, anim: [] }
    loop()
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.domElement.removeEventListener('click', click); controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement) }
  }, [alto])

  useEffect(() => { st.current.onSelect = onSelect }, [onSelect])

  // Agentes, escritorios, pases y TV (cada vez que cambian los datos)
  useEffect(() => {
    const s = st.current; if (!s.dinamico || !datos) return
    s.dinamico.clear(); s.anim = []; s.puestos = {}
    const agentes = datos.agentes || []
    const porArea = {}; agentes.forEach(a => (porArea[a.area] = porArea[a.area] || []).push(a))
    const ahora = Date.now()
    Object.entries(porArea).forEach(([area, lista]) => {
      const A = AREAS[area] || AREAS.direccion, n = lista.length, largo = Math.max(3, 2.2 * n + 0.8)
      const mesa = caja(largo, 0.06, 1.3, '#b98b5e'); mesa.position.set(A.x, 0.76, A.z); mesa.castShadow = true; mesa.receiveShadow = true
      const patas = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => { const p = caja(0.06, 0.74, 0.06, '#444'); p.position.set(A.x + i * (largo / 2 - 0.1), 0.37, A.z + j * 0.55); return p })
      s.dinamico.add(mesa, ...patas)
      const lbl = cartel(A.label, { tam: 32, alto: 0.8 }); lbl.position.set(A.x, 3.1, A.z - 0.9); s.dinamico.add(lbl)
      lista.forEach((a, i) => {
        const x = A.x - largo / 2 + 1.5 + i * 2.2, z = A.z + 1.15
        // Monitor y silla
        const mon = caja(0.7, 0.42, 0.04, '#1d1f22'); mon.position.set(x, 1.05, A.z + 0.15)
        const pant = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.36), new THREE.MeshBasicMaterial({ color: a.estado === 'trabajando' ? '#3a7bd5' : a.estado === 'trabado' ? '#6b1f22' : '#2a2d31' }))
        pant.position.set(x, 1.05, A.z + 0.175)
        const silla = caja(0.5, 0.08, 0.5, '#8d9196'); silla.position.set(x, 0.48, z + 0.1)
        const resp = caja(0.5, 0.55, 0.06, '#8d9196'); resp.position.set(x, 0.8, z + 0.38)
        s.dinamico.add(mon, pant, silla, resp)
        // El agente: en el sillón si no trabaja hace más de un día; si no, en su escritorio
        const ult = a.ultima?.at ? new Date(a.ultima.at).getTime() : 0
        const enDescanso = a.estado === 'libre' && (!ult || ahora - ult > 864e5)
        const p = persona(a.color); p.g.userData.slug = a.slug
        p.g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.slug = a.slug } })
        if (enDescanso) { const dd = AREAS.descanso, k = (s.dinamico.children.filter(o => o.userData.descanso).length); p.g.position.set(dd.x - 1.1 + (k % 3) * 1.1, 0.0, dd.z + 0.05); p.g.userData.descanso = true }
        else { p.g.position.set(x, 0.02, z); p.g.rotation.y = Math.PI }
        s.dinamico.add(p.g)
        const tag = cartel(a.nombre + (a.pendientes ? `  ·  ${a.pendientes}` : ''), { punto: COLOR_ESTADO[a.estado], tam: 32, alto: 0.62 })
        tag.position.set(0, 2.05, 0); p.g.add(tag)
        if (a.estado === 'trabado') { const aro = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: '#e5484d', side: THREE.DoubleSide })); aro.rotation.x = -Math.PI / 2; aro.position.y = 0.03; p.g.add(aro) }
        s.puestos[a.slug] = { obj: p.g, x, z }
        const fase = i * 0.7 + area.length
        if (a.estado === 'trabajando') s.anim.push(t => { p.brazoI.rotation.x = -1.1 + Math.sin(t * 9 + fase) * 0.15; p.brazoD.rotation.x = -1.1 + Math.cos(t * 9 + fase) * 0.15; p.cabeza.rotation.y = Math.sin(t * 0.8 + fase) * 0.15 })
        else if (a.estado === 'esperando') s.anim.push(t => { p.brazoD.rotation.z = 2.6 + Math.sin(t * 3 + fase) * 0.2; p.brazoI.rotation.x = -0.6 })
        else if (a.estado === 'trabado') s.anim.push(t => { p.cabeza.rotation.y = Math.sin(t * 2 + fase) * 0.5 })
        else s.anim.push(t => { p.cuerpo.scale.y = 1 + Math.sin(t * 1.2 + fase) * 0.015 })
      })
    })
    // Pases de trabajo: el que entrega camina hasta el escritorio del otro con un cartel
    ;(datos.pases || []).slice(0, 3).forEach((ps, k) => {
      const de = s.puestos[ps.de], a = s.puestos[ps.a], ag = agentes.find(x => x.slug === ps.de)
      if (!de || !a || !ag) return
      const w = persona(ag.color); w.g.traverse(o => { if (o.isMesh) o.castShadow = true })
      const dest = agentes.find(x => x.slug === ps.a)
      const tag = cartel(`${ag.nombre} · llevándole a ${dest?.nombre}: ${ps.tarea.slice(0, 38)}${ps.tarea.length > 38 ? '…' : ''}`, { punto: '#3a7bd5', tam: 28, alto: 0.5 })
      tag.position.set(0, 1.85, 0); w.g.add(tag); s.dinamico.add(w.g)
      const desde = new THREE.Vector3(de.x, 0.02, de.z + 0.9), hasta = new THREE.Vector3(a.x, 0.02, a.z + 0.9), T = 9, off = k * 3
      s.anim.push(t => {
        const f = ((t + off) % (T + 2)) / T, u = Math.min(1, f)
        w.g.visible = f <= 1
        w.g.position.lerpVectors(desde, hasta, u); w.g.lookAt(hasta.x, 0.02, hasta.z)
        w.brazoI.rotation.x = Math.sin(t * 8) * 0.5; w.brazoD.rotation.x = -Math.sin(t * 8) * 0.5
      })
    })
    // TV
    const c = s.tvCanvas.getContext('2d'), tb = datos.tablero || {}
    c.fillStyle = '#16181b'; c.fillRect(0, 0, 1024, 576)
    c.fillStyle = '#c9a227'; c.font = '700 40px Inter, system-ui'; c.fillText('ZEBRANO · OFICINA', 40, 64)
    c.fillStyle = '#9aa0a6'; c.font = '500 24px Inter, system-ui'; c.fillText(new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }), 760, 62)
    const kpi = [['Consultas 7 d', tb.consultas_7d], ['Cotizaciones 7 d', tb.cotizaciones_7d], ['Aprobadas 30 d', tb.aprobadas_30d], ['Por aprobar', tb.por_aprobar], ['Aprendizajes', (tb.conocimiento || 0) + (tb.aprendizajes || 0)]]
    kpi.forEach(([l, v], i) => { const x = 40 + i * 196; c.fillStyle = '#23262a'; c.fillRect(x, 92, 180, 104); c.fillStyle = '#fff'; c.font = '700 44px Inter, system-ui'; c.fillText(String(v ?? 0), x + 16, 150); c.fillStyle = '#9aa0a6'; c.font = '500 20px Inter, system-ui'; c.fillText(l, x + 16, 182) })
    agentes.forEach((a, i) => {
      const y = 236 + i * 40; c.fillStyle = COLOR_ESTADO[a.estado]; c.beginPath(); c.arc(56, y - 8, 9, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#fff'; c.font = '600 24px Inter, system-ui'; c.fillText(a.nombre, 80, y)
      c.fillStyle = '#9aa0a6'; c.font = '400 22px Inter, system-ui'
      const txt = a.estado === 'trabado' ? (a.bloqueo || 'Trabado') : (a.ultima?.tarea || a.puesto)
      c.fillText(txt.length > 62 ? txt.slice(0, 61) + '…' : txt, 240, y)
      if (a.pendientes) { c.fillStyle = '#f2b01e'; c.font = '700 22px Inter, system-ui'; c.fillText(String(a.pendientes), 975, y) }
    })
    s.tvTex.needsUpdate = true
  }, [datos])

  // Cámaras: plano general, un área o seguir a un agente
  useEffect(() => {
    const s = st.current; if (!s.camera) return
    s.seguir = seguir || null
    if (seguir) return
    const A = vista && AREAS[vista]
    if (A) { s.controls.target.set(A.x, 0.8, A.z); s.camera.position.set(A.x + 4, 7, A.z + 10) }
    else { s.controls.target.set(0, 0, 2); s.camera.position.set(0, 24, 31) }
    s.controls.update()
  }, [vista, seguir])

  return <div ref={caja3d} style={{ width: '100%', height: alto, borderRadius: 14, overflow: 'hidden', touchAction: 'none', cursor: 'pointer' }} role="img" aria-label="Oficina virtual de agentes de Zebrano en 3D. Tocá un agente para ver su bandeja." />
}
