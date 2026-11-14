import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { AREAS, COLOR_ESTADO } from '../lib/oficina'

// Oficina virtual de agentes — rediseño 14/11/2026. Planta tipo maqueta (piso con espesor), alfombra y nombre pintado
// por área, un escritorio con notebook por agente (la tapa muestra el color del estado), agentes más grandes y con cara,
// TV del tablero en Dirección y sillón de descanso. La cámara encuadra la planta según el ancho real de la pantalla.
// Los estados salen de oficina_estado(); no hay datos inventados. Unidades: 1 = 1 metro; x a la derecha, z hacia la cámara.

const FUENTE = "'Instrument Sans', Inter, system-ui, sans-serif"
const PLANTA = { cx: 2.6, cz: -0.4, ancho: 34, fondo: 15 }
const PIEL = ['#f0c9a4', '#d9a77f', '#e8b996', '#c98f68']
const PELO = ['#3b2a20', '#6b4a2e', '#1f1a17', '#8a5a3a', '#4a3a30']

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o })
const caja = (w, h, d, color, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o))

// Cartel flotante: punto de estado, nombre y globo con lo pendiente.
function cartel(texto, { punto = null, badge = 0, alto = 0.72, fondo = 'rgba(22,24,23,0.9)' } = {}) {
  const tam = 40, c = document.createElement('canvas'), x = c.getContext('2d')
  x.font = `600 ${tam}px ${FUENTE}`
  const tw = Math.ceil(x.measureText(texto).width), bw = badge ? Math.ceil(x.measureText(String(badge)).width) + 34 : 0
  const h = tam + 30, w = tw + (punto ? 78 : 48) + (badge ? bw + 12 : 0)
  c.width = w; c.height = h
  x.font = `600 ${tam}px ${FUENTE}`; x.textBaseline = 'middle'
  x.fillStyle = fondo; x.beginPath(); x.roundRect(0, 0, w, h, h / 2); x.fill()
  if (punto) { x.fillStyle = punto; x.beginPath(); x.arc(34, h / 2, 12, 0, Math.PI * 2); x.fill() }
  x.fillStyle = '#fff'; x.fillText(texto, punto ? 58 : 24, h / 2 + 2)
  if (badge) {
    const bx = w - bw - 10; x.fillStyle = '#f2b01e'; x.beginPath(); x.roundRect(bx, 9, bw, h - 18, (h - 18) / 2); x.fill()
    x.fillStyle = '#2a1d00'; x.font = `700 ${tam - 4}px ${FUENTE}`; x.fillText(String(badge), bx + 17, h / 2 + 2)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }))
  s.scale.set(alto * w / h, alto, 1); s.renderOrder = 10
  return s
}

// Nombre del área pintado sobre su alfombra (el lienzo se ajusta al texto para que la letra quede grande).
function rotulo(texto, maxAncho) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), tam = 72
  const fuente = `700 ${tam}px ${FUENTE}`; x.font = fuente
  const esp = 8, tw = Math.ceil(x.measureText(texto).width + esp * texto.length) + 16
  c.width = tw; c.height = tam + 24
  x.font = fuente; x.fillStyle = 'rgba(40,34,28,0.82)'; x.textBaseline = 'middle'
  if ('letterSpacing' in x) x.letterSpacing = `${esp}px`
  x.fillText(texto, 8, c.height / 2 + 2)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  const alto = Math.min(0.5, maxAncho * c.height / c.width), ancho = alto * c.width / c.height
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }))
  m.rotation.x = -Math.PI / 2; m.userData.ancho = ancho
  return m
}

function planta(x, z, s = 1) {
  const g = new THREE.Group()
  const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.17 * s, 0.4 * s, 12), mat('#efe9df')); maceta.position.y = 0.2 * s
  const hojas = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 0), mat('#5d8a55', { flatShading: true })); hojas.position.y = 0.72 * s
  g.add(maceta, hojas); g.position.set(x, 0, z); g.traverse(o => { if (o.isMesh) o.castShadow = true })
  return g
}

// Agente: cabeza grande, ojos, cuerpo del color del agente. Brazos y piernas con pivote arriba para animar.
function persona(color, semilla = 0) {
  const g = new THREE.Group()
  const extremidad = (r, l, c) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), mat(c)); m.geometry.translate(0, -l / 2 - r * 0.4, 0); return m }
  const piernaI = extremidad(0.085, 0.32, '#3a3f47'), piernaD = extremidad(0.085, 0.32, '#3a3f47')
  piernaI.position.set(-0.12, 0.52, 0); piernaD.position.set(0.12, 0.52, 0)
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.3, 6, 14), mat(color, { roughness: 0.65 })); cuerpo.position.y = 0.9
  const cabeza = new THREE.Group(); cabeza.position.y = 1.5
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), mat(PIEL[semilla % PIEL.length], { roughness: 0.6 }))
  const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.315, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), mat(PELO[semilla % PELO.length]))
  pelo.rotation.x = -0.25; pelo.position.y = 0.03
  const ojo = () => new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: '#1b1b1b' }))
  const ojoI = ojo(), ojoD = ojo(); ojoI.position.set(-0.1, 0.02, 0.27); ojoD.position.set(0.1, 0.02, 0.27)
  cabeza.add(craneo, pelo, ojoI, ojoD)
  const brazoI = extremidad(0.07, 0.3, color), brazoD = extremidad(0.07, 0.3, color)
  brazoI.position.set(-0.34, 1.12, 0); brazoD.position.set(0.34, 1.12, 0)
  g.add(piernaI, piernaD, cuerpo, cabeza, brazoI, brazoD)
  g.traverse(o => { if (o.isMesh) o.castShadow = true })
  return { g, cuerpo, cabeza, brazoI, brazoD, piernaI, piernaD }
}

function escritorio(x, z, estado) {
  const g = new THREE.Group()
  const tapa = caja(1.6, 0.06, 0.78, '#c49a6c'); tapa.position.set(0, 0.74, 0)
  g.add(tapa)
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, j]) => { const p = caja(0.05, 0.72, 0.05, '#3d3f43'); p.position.set(i * 0.74, 0.36, j * 0.33); g.add(p) })
  const frente = caja(1.5, 0.42, 0.03, '#b88d60'); frente.position.set(0, 0.5, 0.37); g.add(frente)
  // Notebook: pantalla hacia el agente; en la tapa, el color del estado (es lo que se ve desde la cámara).
  const base = caja(0.52, 0.025, 0.36, '#2b2d31'); base.position.set(0, 0.785, 0.02)
  const lid = new THREE.Group(); lid.position.set(0, 0.8, -0.16); lid.rotation.x = -0.25
  const lidM = caja(0.52, 0.36, 0.02, '#2b2d31'); lidM.position.y = 0.18
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), new THREE.MeshBasicMaterial({ color: estado === 'trabajando' ? '#7fb3ff' : '#2f3237' }))
  pantalla.position.set(0, 0.18, -0.012); pantalla.rotation.y = Math.PI
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), new THREE.MeshBasicMaterial({ color: COLOR_ESTADO[estado] || '#9aa0a6' }))
  logo.position.set(0, 0.19, 0.012)
  lid.add(lidM, pantalla, logo)
  const taza = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 10), mat('#f4efe8')); taza.position.set(0.55, 0.82, 0.1)
  g.add(base, lid, taza)
  // Silla detrás del agente
  const asiento = caja(0.52, 0.07, 0.5, '#4a5058'); asiento.position.set(0, 0.46, -0.78)
  const respaldo = caja(0.52, 0.6, 0.07, '#4a5058'); respaldo.position.set(0, 0.8, -1.05)
  const pie = caja(0.06, 0.42, 0.06, '#2b2d31'); pie.position.set(0, 0.22, -0.78)
  g.add(asiento, respaldo, pie)
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  g.position.set(x, 0, z)
  return { g, logo }
}

export default function Oficina3D({ datos, vista, seguir, onSelect, alto = 560 }) {
  const caja3d = useRef(null), st = useRef({})

  // Escena fija (una vez)
  useEffect(() => {
    const el = caja3d.current, w = el.clientWidth || 900
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, alto); renderer.setClearColor(0, 0)
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight('#ffffff', '#9a9084', 1.35))
    const sol = new THREE.DirectionalLight('#fff3df', 1.7); sol.position.set(-10, 20, 12); sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0005
    Object.assign(sol.shadow.camera, { left: -22, right: 22, top: 14, bottom: -14 }); sol.target.position.set(PLANTA.cx, 0, PLANTA.cz); scene.add(sol, sol.target)
    const camera = new THREE.PerspectiveCamera(26, w / alto, 0.1, 300)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.enableZoom = false; controls.maxPolarAngle = Math.PI / 2.3; controls.minDistance = 5; controls.maxDistance = 70

    // Maqueta: piso con espesor, pared del fondo con ventanas y pared izquierda
    const { cx, cz, ancho, fondo } = PLANTA
    const piso = caja(ancho, 0.35, fondo, '#e2d9cc', { roughness: 0.95 }); piso.position.set(cx, -0.175, cz); piso.receiveShadow = true; scene.add(piso)
    const borde = caja(ancho + 0.02, 0.05, fondo + 0.02, '#b9ad9c'); borde.position.set(cx, -0.33, cz); scene.add(borde)
    const atras = cz - fondo / 2
    const pared = caja(ancho, 2.6, 0.2, '#f1ece5'); pared.position.set(cx, 1.3, atras + 0.1); pared.receiveShadow = true; scene.add(pared)
    const ventana = new THREE.MeshBasicMaterial({ color: '#cfe2ec' })
    for (let x = cx - ancho / 2 + 2; x < cx + ancho / 2 - 1.5; x += 3.1) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.3), ventana); v.position.set(x, 1.55, atras + 0.21); scene.add(v)
    }
    const lateral = caja(0.2, 2.6, fondo, '#ebe5dd'); lateral.position.set(cx - ancho / 2 + 0.1, 1.3, cz); lateral.receiveShadow = true; scene.add(lateral)

    // Descanso: alfombra, sillón, mesita y plantas
    const D = AREAS.descanso
    const alfD = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 6), mat(D.alfombra)); alfD.rotation.x = -Math.PI / 2; alfD.position.set(D.x, 0.005, D.z); alfD.receiveShadow = true
    const sofa = caja(3.4, 0.42, 0.95, '#7e8f8a'); sofa.position.set(D.x, 0.25, D.z - 1)
    const resp = caja(3.4, 0.7, 0.28, '#6f807b'); resp.position.set(D.x, 0.62, D.z - 1.5)
    const braI = caja(0.25, 0.6, 0.95, '#6f807b'); braI.position.set(D.x - 1.82, 0.32, D.z - 1)
    const braD = braI.clone(); braD.position.x = D.x + 1.82
    const mesita = caja(1.4, 0.36, 0.7, '#b48a5e'); mesita.position.set(D.x, 0.18, D.z + 0.6)
    ;[sofa, resp, braI, braD, mesita].forEach(m => { m.castShadow = true; m.receiveShadow = true })
    const rD = rotulo(D.label, 4.6); rD.position.set(D.x, 0.012, D.z + 2.4)
    scene.add(alfD, sofa, resp, braI, braD, mesita, rD, planta(D.x + 2.3, D.z - 2.4, 1.2), planta(D.x - 2.3, D.z - 2.4))

    const dinamico = new THREE.Group(); scene.add(dinamico)
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2()
    const slugEn = e => {
      const r = renderer.domElement.getBoundingClientRect()
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(mouse, camera)
      for (const h of ray.intersectObjects(dinamico.children, true)) { let o = h.object; while (o && !o.userData.slug) o = o.parent; if (o) return o.userData.slug }
      return null
    }
    const click = e => { const s = slugEn(e); if (s) st.current.onSelect?.(s) }
    let ultimoMov = 0
    const mover = e => { const t = performance.now(); if (t - ultimoMov < 80) return; ultimoMov = t; renderer.domElement.style.cursor = slugEn(e) ? 'pointer' : 'grab' }
    renderer.domElement.addEventListener('click', click)
    renderer.domElement.addEventListener('pointermove', mover)

    // Encuadre del plano general según el ancho disponible: entra toda la planta, sin bordes vacíos.
    const encuadre = () => {
      const v = THREE.MathUtils.degToRad(camera.fov) / 2, h = Math.atan(Math.tan(v) * camera.aspect)
      const dir = new THREE.Vector3(0, 1.55, 1).normalize(), elev = Math.asin(dir.y)
      const porAncho = (ancho / 2) / Math.tan(h) + (fondo / 2) * Math.cos(elev)
      const porFondo = ((fondo * Math.sin(elev) + 2.6 * Math.cos(elev)) / 2) / Math.tan(v) + (fondo / 2) * Math.cos(elev)
      const t = new THREE.Vector3(cx, 0.4, cz)
      controls.target.copy(t); camera.position.copy(t.addScaledVector(dir, Math.max(porAncho, porFondo) * 0.96)); controls.update()
    }

    let raf = 0; const reloj = new THREE.Clock()
    const loop = () => {
      const t = reloj.getElapsedTime(), s = st.current
      for (const a of s.anim || []) a(t)
      if (s.seguir && s.puestos?.[s.seguir]) { const p = s.puestos[s.seguir].obj.getWorldPosition(new THREE.Vector3()); controls.target.lerp(p, 0.08); camera.position.lerp(p.clone().add(new THREE.Vector3(2.5, 4.2, 6)), 0.04) }
      controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop)
    }
    const ro = new ResizeObserver(() => {
      const ww = el.clientWidth || w; renderer.setSize(ww, alto); camera.aspect = ww / alto; camera.updateProjectionMatrix()
      if (!st.current.vista && !st.current.seguir) encuadre()
    })
    ro.observe(el)
    st.current = { ...st.current, renderer, scene, camera, controls, dinamico, encuadre, anim: [] }
    encuadre(); loop()
    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      renderer.domElement.removeEventListener('click', click); renderer.domElement.removeEventListener('pointermove', mover)
      controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement)
    }
  }, [alto])

  useEffect(() => { st.current.onSelect = onSelect }, [onSelect])

  // Áreas, escritorios, agentes, pases y TV (cada vez que cambian los datos)
  useEffect(() => {
    const s = st.current; if (!s.dinamico || !datos) return
    s.dinamico.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.() })
    s.dinamico.clear(); s.anim = []; s.puestos = {}
    const agentes = datos.agentes || [], ahora = Date.now()
    const porArea = {}; agentes.forEach(a => (porArea[a.area] = porArea[a.area] || []).push(a))
    let enSillon = 0

    Object.entries(porArea).forEach(([area, lista]) => {
      const A = AREAS[area] || AREAS.direccion, n = lista.length
      const largo = Math.max(area === 'direccion' ? 6 : 5, n * 2.4 + 1.4)
      const alf = new THREE.Mesh(new THREE.PlaneGeometry(largo, 4.4), mat(A.alfombra, { roughness: 1 }))
      alf.rotation.x = -Math.PI / 2; alf.position.set(A.x, 0.005, A.z); alf.receiveShadow = true
      const r = rotulo(A.label, largo - 0.6); r.position.set(A.x - largo / 2 + 0.3 + r.userData.ancho / 2, 0.012, A.z + 1.82)
      s.dinamico.add(alf, r, planta(A.x + largo / 2 - 0.45, A.z - 1.75, 0.9))
      const x0 = A.x - (n - 1) * 1.2 - (area === 'direccion' ? 1.3 : 0)

      lista.forEach((a, i) => {
        const x = x0 + i * 2.4, zD = A.z + 0.15, semilla = a.slug.length + i
        const esc = escritorio(x, zD, a.estado); s.dinamico.add(esc.g)
        const p = persona(a.color, semilla); p.g.userData.slug = a.slug
        p.g.traverse(o => { if (o.isMesh) o.userData.slug = a.slug })
        // Libre y sin actividad hace más de un día: está en el sillón; si no, en su escritorio
        const ult = a.ultima?.at ? new Date(a.ultima.at).getTime() : 0
        const descansa = a.estado === 'libre' && (!ult || ahora - ult > 864e5)
        if (descansa) {
          const D = AREAS.descanso
          p.g.position.set(D.x - 1.1 + (enSillon % 3) * 1.1, 0.0, D.z - 0.95); p.g.userData.sillon = enSillon++
          p.piernaI.rotation.x = p.piernaD.rotation.x = -1.45
        } else {
          p.g.position.set(x, 0, zD - 0.72)
          p.piernaI.rotation.x = p.piernaD.rotation.x = -1.45
        }
        s.dinamico.add(p.g)
        const tag = cartel(a.nombre, { punto: COLOR_ESTADO[a.estado], badge: a.pendientes || 0 })
        tag.position.set(0, 2.35 + ((p.g.userData.sillon ?? 0) % 3) * 0.5, 0); p.g.add(tag)
        if (a.estado === 'trabado') {
          const aro = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: '#e5484d' }))
          aro.rotation.x = Math.PI / 2; aro.position.y = 2.0; p.g.add(aro)
          s.anim.push(t => { aro.scale.setScalar(1 + Math.sin(t * 4) * 0.12) })
        }
        s.puestos[a.slug] = { obj: p.g, x, z: zD }
        const f = i * 0.9 + area.length
        if (descansa) s.anim.push(t => { p.cabeza.rotation.z = Math.sin(t * 0.7 + f) * 0.08; p.brazoI.rotation.x = p.brazoD.rotation.x = -0.5 })
        else if (a.estado === 'trabajando') s.anim.push(t => {
          p.brazoI.rotation.x = -1.25 + Math.sin(t * 10 + f) * 0.12; p.brazoD.rotation.x = -1.25 + Math.cos(t * 10 + f) * 0.12
          p.cabeza.rotation.x = 0.18 + Math.sin(t * 1.3 + f) * 0.05; p.cabeza.rotation.y = Math.sin(t * 0.6 + f) * 0.12
        })
        else if (a.estado === 'esperando') s.anim.push(t => {
          p.brazoD.rotation.z = 2.5 + Math.sin(t * 4 + f) * 0.3; p.brazoI.rotation.x = -1.1
          p.cabeza.rotation.y = Math.sin(t * 1.5 + f) * 0.2; tag.position.y = 2.35 + Math.abs(Math.sin(t * 2.5 + f)) * 0.12
        })
        else if (a.estado === 'trabado') s.anim.push(t => { p.cabeza.rotation.y = Math.sin(t * 2.4 + f) * 0.55; p.brazoI.rotation.z = -0.25; p.brazoD.rotation.z = 0.25 })
        else s.anim.push(t => { p.cuerpo.scale.y = 1 + Math.sin(t * 1.3 + f) * 0.02; p.brazoI.rotation.x = p.brazoD.rotation.x = -0.9; p.cabeza.rotation.y = Math.sin(t * 0.4 + f) * 0.25 })
      })

      if (area === 'direccion') {
        // TV del tablero, detrás del jefe de oficina
        const tvCanvas = document.createElement('canvas'); tvCanvas.width = 1024; tvCanvas.height = 576
        const tvTex = new THREE.CanvasTexture(tvCanvas); tvTex.colorSpace = THREE.SRGBColorSpace
        const negro = mat('#151617')
        const tv = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.65, 0.08), [negro, negro, negro, negro, new THREE.MeshBasicMaterial({ map: tvTex }), negro])
        tv.position.set(A.x + 1.6, 1.75, A.z - 1.2); tv.castShadow = true
        const pie = caja(0.1, 0.95, 0.1, '#222'); pie.position.set(A.x + 1.6, 0.47, A.z - 1.2)
        const base = caja(1.2, 0.05, 0.5, '#222'); base.position.set(A.x + 1.6, 0.03, A.z - 1.2)
        s.dinamico.add(tv, pie, base)
        dibujarTv(tvCanvas, datos, agentes); tvTex.needsUpdate = true
      }
    })

    // Pases de trabajo: el que entrega camina por el pasillo central hasta el escritorio del otro
    ;(datos.pases || []).slice(0, 3).forEach((ps, k) => {
      const de = s.puestos[ps.de], a = s.puestos[ps.a], ag = agentes.find(x => x.slug === ps.de), dest = agentes.find(x => x.slug === ps.a)
      if (!de || !a || !ag) return
      const w = persona(ag.color, ag.slug.length); s.dinamico.add(w.g)
      const tag = cartel(`${ag.nombre} → ${dest?.nombre}: ${ps.tarea.slice(0, 32)}${ps.tarea.length > 32 ? '…' : ''}`, { punto: '#3a7bd5', alto: 0.5 })
      tag.position.set(0, 2.2, 0); w.g.add(tag)
      const V = (x, z) => new THREE.Vector3(x, 0, z)
      const ruta = [V(de.x, de.z + 1.0), V(de.x, 0), V(a.x, 0), V(a.x, a.z + 1.0)]
      const tramos = ruta.slice(1).map((p, i) => ruta[i].distanceTo(p)), total = tramos.reduce((x, y) => x + y, 0), vel = 1.5
      const ciclo = total / vel + 2.5, off = k * 4
      s.anim.push(t => {
        let d = ((t + off) % ciclo) * vel
        w.g.visible = d <= total
        if (!w.g.visible) return
        let i = 0; while (i < tramos.length - 1 && d > tramos[i]) { d -= tramos[i]; i++ }
        const u = Math.min(1, d / (tramos[i] || 1)), p0 = ruta[i], p1 = ruta[i + 1]
        w.g.position.lerpVectors(p0, p1, u); w.g.lookAt(p1.x, 0, p1.z)
        const paso = Math.sin(t * 9) * 0.55
        w.piernaI.rotation.x = paso; w.piernaD.rotation.x = -paso; w.brazoI.rotation.x = -paso * 0.7; w.brazoD.rotation.x = paso * 0.7
        w.g.position.y = Math.abs(Math.sin(t * 9)) * 0.04
      })
    })
  }, [datos])

  // Cámaras: plano general, un área o seguir a un agente
  useEffect(() => {
    const s = st.current; if (!s.camera) return
    s.seguir = seguir || null; s.vista = vista || null
    if (seguir) return
    const A = vista && AREAS[vista]
    if (A) { s.controls.target.set(A.x, 0.8, A.z); s.camera.position.set(A.x + 2, 6.5, A.z + 9); s.controls.update() }
    else s.encuadre()
  }, [vista, seguir])

  return <div ref={caja3d} style={{ width: '100%', height: alto, borderRadius: 16, overflow: 'hidden', touchAction: 'none', background: 'linear-gradient(180deg, var(--z-bg-2), var(--z-bg))', border: '1px solid var(--z-border)' }} role="img" aria-label="Oficina virtual de agentes de Zebrano en 3D. Tocá un agente para ver su bandeja." />
}

function dibujarTv(cv, datos, agentes) {
  const c = cv.getContext('2d'), tb = datos.tablero || {}
  c.fillStyle = '#121413'; c.fillRect(0, 0, 1024, 576)
  c.fillStyle = '#c9a227'; c.font = `700 40px ${FUENTE}`; c.fillText('ZEBRANO · OFICINA', 40, 62)
  c.fillStyle = '#9aa0a6'; c.font = `500 24px ${FUENTE}`; c.fillText(new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }), 770, 60)
  const kpi = [['Consultas 7 d', tb.consultas_7d], ['Cotizaciones 7 d', tb.cotizaciones_7d], ['Aprobadas 30 d', tb.aprobadas_30d], ['Por aprobar', tb.por_aprobar], ['Aprendidos', (tb.conocimiento || 0) + (tb.aprendizajes || 0)]]
  kpi.forEach(([l, v], i) => { const x = 40 + i * 196; c.fillStyle = '#202422'; c.fillRect(x, 90, 180, 104); c.fillStyle = i === 3 ? '#f2b01e' : '#fff'; c.font = `700 46px ${FUENTE}`; c.fillText(String(v ?? 0), x + 16, 150); c.fillStyle = '#9aa0a6'; c.font = `500 20px ${FUENTE}`; c.fillText(l, x + 16, 182) })
  agentes.forEach((a, i) => {
    const y = 238 + i * 40; c.fillStyle = COLOR_ESTADO[a.estado]; c.beginPath(); c.arc(56, y - 8, 9, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#fff'; c.font = `600 25px ${FUENTE}`; c.fillText(a.nombre, 80, y)
    c.fillStyle = '#a3ada7'; c.font = `400 22px ${FUENTE}`
    const txt = a.estado === 'trabado' ? (a.bloqueo || 'Trabado') : (a.ultima?.tarea || a.puesto)
    c.fillText(txt.length > 60 ? txt.slice(0, 59) + '…' : txt, 240, y)
    if (a.pendientes) { c.fillStyle = '#f2b01e'; c.font = `700 22px ${FUENTE}`; c.fillText(String(a.pendientes), 970, y) }
  })
}
