import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { AREAS, COLOR_ESTADO } from '../lib/oficina'

// Oficina virtual de agentes — estética corporativa (14/11/2026, 2.ª versión).
// Planta tipo maqueta en cemento claro, zonas en gris con una línea verde Zebrano, escritorios blancos con patas negras,
// monitor con una luz del color del estado, sillas negras, ventanales con marcos finos y un living gris oscuro.
// Agentes con proporciones reales y ropa de oficina, articulados (hombro/codo, cadera/rodilla) para sentarse, tipear y caminar.
// Los carteles tienen tamaño fijo en pantalla: no se agigantan al acercar la cámara.
// Los estados salen de oficina_estado(); no hay datos inventados. Unidades: 1 = 1 metro; x a la derecha, z hacia la cámara.

const FUENTE = "'Instrument Sans', Inter, system-ui, sans-serif"
const PLANTA = { cx: 2.6, cz: -0.4, ancho: 34, fondo: 15 }
const VERDE = '#0d7665'
const PIEL = ['#e9c4a3', '#c99a74', '#a8754f', '#f1d2b8', '#7d5238']
const PELO = ['#2a2420', '#5a4030', '#16130f', '#8c6a4a', '#3d3a38']
const SACO = ['#3d5a80', '#6b7280', '#9a8a72', '#4f6d5e', '#56598f', '#7a5c58']
const PANT = ['#2c3138', '#3f444b', '#2a3344']

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o })
const caja = (w, h, d, color, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o))
const luz = color => new THREE.MeshBasicMaterial({ color, toneMapped: false })
const sombra = g => { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } }); return g }

// Cartel flotante con tamaño fijo en pantalla (px de alto): punto de estado, nombre y globo con lo pendiente.
function cartel(texto, k, { punto = null, badge = 0, px = 24 } = {}) {
  const tam = 40, c = document.createElement('canvas'), x = c.getContext('2d')
  x.font = `600 ${tam}px ${FUENTE}`
  const tw = Math.ceil(x.measureText(texto).width), bw = badge ? Math.ceil(x.measureText(String(badge)).width) + 34 : 0
  const h = tam + 28, w = tw + (punto ? 76 : 44) + (badge ? bw + 12 : 0)
  c.width = w; c.height = h
  x.font = `600 ${tam}px ${FUENTE}`; x.textBaseline = 'middle'
  x.fillStyle = 'rgba(18,21,24,0.86)'; x.beginPath(); x.roundRect(0, 0, w, h, h / 2); x.fill()
  if (punto) { x.fillStyle = punto; x.beginPath(); x.arc(33, h / 2, 11, 0, Math.PI * 2); x.fill() }
  x.fillStyle = '#fff'; x.fillText(texto, punto ? 56 : 22, h / 2 + 2)
  if (badge) {
    const bx = w - bw - 9; x.fillStyle = '#f2b01e'; x.beginPath(); x.roundRect(bx, 9, bw, h - 18, (h - 18) / 2); x.fill()
    x.fillStyle = '#2a1d00'; x.font = `700 ${tam - 4}px ${FUENTE}`; x.fillText(String(badge), bx + 17, h / 2 + 2)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }))
  s.scale.set(px * k * w / h, px * k, 1); s.renderOrder = 10
  return s
}

// Nombre del área pintado sobre el piso, en gris y con letra espaciada.
function rotulo(texto, maxAncho) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), tam = 64
  const fuente = `600 ${tam}px ${FUENTE}`; x.font = fuente
  const esp = 12, tw = Math.ceil(x.measureText(texto).width + esp * texto.length) + 16
  c.width = tw; c.height = tam + 24
  x.font = fuente; x.fillStyle = 'rgba(38,42,46,0.8)'; x.textBaseline = 'middle'
  if ('letterSpacing' in x) x.letterSpacing = `${esp}px`
  x.fillText(texto, 8, c.height / 2 + 2)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  const alto = Math.min(0.42, maxAncho * c.height / c.width), ancho = alto * c.width / c.height
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }))
  m.rotation.x = -Math.PI / 2; m.userData.ancho = ancho
  return m
}

// Planta alta en maceta cilíndrica gris grafito.
function planta(x, z, s = 1) {
  const g = new THREE.Group()
  const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.17 * s, 0.55 * s, 24), mat('#3a3d41', { roughness: 0.5 })); maceta.position.y = 0.275 * s
  const hoja = mat('#3f6b47', { roughness: 0.9 })
  ;[[0, 1.0, 0, 0.32], [0.14, 1.3, 0.05, 0.24], [-0.12, 1.25, -0.06, 0.26], [0.02, 1.55, 0, 0.2]].forEach(([a, b, cc, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * s, 16, 12), hoja); m.position.set(a * s, b * s, cc * s); g.add(m)
  })
  const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.025 * s, 0.6 * s, 6), mat('#5b4a3a')); tallo.position.y = 0.8 * s
  g.add(maceta, tallo); g.position.set(x, 0, z)
  return sombra(g)
}

// Persona con proporciones reales y ropa de oficina. Pivotes: hombro→codo, cadera→rodilla, para sentarse, tipear y caminar.
function persona(acento, semilla = 0) {
  const g = new THREE.Group(), cuerpo = new THREE.Group(); g.add(cuerpo)
  const piel = mat(PIEL[semilla % PIEL.length], { roughness: 0.55 })
  const saco = mat(SACO[semilla % SACO.length], { roughness: 0.7 }), pant = mat(PANT[semilla % PANT.length], { roughness: 0.7 })
  const capsula = (r, l, m) => { const x = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 12), m); x.geometry.translate(0, -l / 2 - r * 0.6, 0); return x }

  // Piernas
  const pierna = lado => {
    const cadera = new THREE.Group(); cadera.position.set(lado * 0.095, 0.9, 0)
    cadera.add(capsula(0.075, 0.34, pant))
    const rodilla = new THREE.Group(); rodilla.position.y = -0.45; cadera.add(rodilla)
    rodilla.add(capsula(0.06, 0.34, pant))
    const zapato = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), mat('#141414', { roughness: 0.4 })); zapato.position.set(0, -0.45, 0.05); rodilla.add(zapato)
    cuerpo.add(cadera); return { cadera, rodilla }
  }
  const pI = pierna(-1), pD = pierna(1)
  // Torso: saco entallado, camisa, cuello
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.08, 6, 12), pant); pelvis.rotation.z = Math.PI / 2; pelvis.position.y = 0.94; pelvis.scale.set(1, 1.15, 0.8)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.165, 0.5, 20), saco); torso.position.y = 1.22; torso.scale.z = 0.72
  const hombros = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.26, 6, 12), saco); hombros.rotation.z = Math.PI / 2; hombros.position.y = 1.44; hombros.scale.z = 0.8
  const camisa = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 3), mat('#f2f2f0')); camisa.rotation.x = Math.PI; camisa.position.set(0, 1.38, 0.115); camisa.scale.z = 0.25
  const credencial = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.01), luz(acento)); credencial.position.set(0.1, 1.3, 0.125)
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), piel); cuello.position.y = 1.53
  cuerpo.add(pelvis, torso, hombros, camisa, credencial, cuello)
  // Cabeza y pelo (tres estilos)
  const cabeza = new THREE.Group(); cabeza.position.y = 1.67
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 20), piel); craneo.scale.set(0.9, 1.08, 0.98)
  const peloM = mat(PELO[semilla % PELO.length], { roughness: 0.85 })
  const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.122, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.05), peloM)
  pelo.scale.set(0.92, 1.0, 1.02); pelo.position.set(0, 0.012, -0.008); pelo.rotation.x = -0.18
  cabeza.add(craneo, pelo)
  const estilo = semilla % 3
  if (estilo === 1) { const largo = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.12, 6, 12), peloM); largo.position.set(0, -0.06, -0.05); largo.scale.set(1.05, 1, 0.7); cabeza.add(largo) }
  if (estilo === 2) { const rodete = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), peloM); rodete.position.set(0, 0.07, -0.11); cabeza.add(rodete) }
  cuerpo.add(cabeza)
  // Brazos
  const brazo = lado => {
    const hombro = new THREE.Group(); hombro.position.set(lado * 0.24, 1.43, 0)
    hombro.add(capsula(0.055, 0.22, saco))
    const codo = new THREE.Group(); codo.position.y = -0.31; hombro.add(codo)
    codo.add(capsula(0.048, 0.2, saco))
    const mano = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), piel); mano.position.y = -0.31; mano.scale.set(0.8, 1.1, 0.6); codo.add(mano)
    cuerpo.add(hombro); return { hombro, codo }
  }
  const bI = brazo(-1), bD = brazo(1)
  sombra(g); g.scale.setScalar(1.2)
  const sentar = () => { cuerpo.position.y = -0.47; pI.cadera.rotation.x = pD.cadera.rotation.x = -Math.PI / 2; pI.rodilla.rotation.x = pD.rodilla.rotation.x = Math.PI / 2 }
  return { g, cuerpo, cabeza, bI, bD, pI, pD, sentar }
}

// Escritorio blanco con patas negras, monitor mirando a la cámara (luz de estado bajo la pantalla), teclado y silla negra.
// El agente se sienta del lado de la cámara, de espaldas, frente a su pantalla encendida.
function escritorio(x, z, estado, acento) {
  const g = new THREE.Group()
  const tapa = caja(1.6, 0.04, 0.8, '#f3f3f1', { roughness: 0.4 }); tapa.position.y = 0.74
  const patas = mat('#1d1f22', { roughness: 0.35, metalness: 0.4 })
  ;[-0.76, 0.76].forEach(px => {
    const lado = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), patas)
    ;[-0.34, 0.34].forEach(pz => { const p = lado.clone(); p.position.set(px, 0.36, pz); g.add(p) })
    const travesano = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.72), patas); travesano.position.set(px, 0.04, 0); g.add(travesano)
  })
  const faldon = caja(1.48, 0.28, 0.02, '#e7e7e4'); faldon.position.set(0, 0.58, -0.36)
  g.add(tapa, faldon)
  // Monitor: pantalla hacia el agente; atrás (hacia la cámara) una tira de luz con el color del estado
  const mon = new THREE.Group(); mon.position.set(0, 0.76, -0.14); mon.rotation.y = Math.PI
  const pie = caja(0.2, 0.012, 0.16, '#202225', { metalness: 0.4, roughness: 0.3 }); pie.position.y = 0.006
  const brazo = caja(0.03, 0.2, 0.03, '#202225', { metalness: 0.4, roughness: 0.3 }); brazo.position.set(0, 0.1, 0.03)
  const panel = caja(0.62, 0.36, 0.025, '#17181a', { roughness: 0.35 }); panel.position.set(0, 0.36, 0.03)
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.32), luz(estado === 'trabajando' ? '#9cc4ff' : estado === 'trabado' ? '#5a2226' : '#3a3f46'))
  pantalla.position.set(0, 0.36, 0.016); pantalla.rotation.y = Math.PI
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.018, 0.005), luz(COLOR_ESTADO[estado] || '#9aa0a6')); led.position.set(0, 0.194, 0.014)
  mon.add(pie, brazo, panel, pantalla, led)
  const teclado = caja(0.42, 0.015, 0.13, '#d9dadc', { roughness: 0.5 }); teclado.position.set(0, 0.768, 0.14)
  const mouse = caja(0.06, 0.02, 0.09, '#d9dadc'); mouse.position.set(0.32, 0.77, 0.14)
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.11, 16), mat('#ffffff', { roughness: 0.3 })); vaso.position.set(-0.6, 0.815, -0.15)
  g.add(mon, teclado, mouse, vaso)
  // Silla ejecutiva negra, con una línea del color del agente en el respaldo
  const silla = new THREE.Group(); silla.position.set(0, 0, 0.8); silla.rotation.y = Math.PI
  const tela = mat('#1f2124', { roughness: 0.9 })
  const asiento = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.48), tela); asiento.position.y = 0.47
  const respaldo = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.05), tela); respaldo.position.set(0, 0.86, -0.24); respaldo.rotation.x = -0.1
  const linea = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.01), luz(acento)); linea.position.set(0, 1.14, -0.27); linea.rotation.x = -0.1
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 10), patas); columna.position.y = 0.24
  silla.add(asiento, respaldo, linea, columna)
  for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.04), patas); r.position.set(Math.cos(i * 1.2566) * 0.15, 0.04, Math.sin(i * 1.2566) * 0.15); r.rotation.y = -i * 1.2566; silla.add(r) }
  g.add(silla)
  sombra(g); g.position.set(x, 0, z)
  return { g, led }
}

export default function Oficina3D({ datos, vista, seguir, onSelect, alto = 560 }) {
  const caja3d = useRef(null), st = useRef({})

  // Escena fija (una vez)
  useEffect(() => {
    const el = caja3d.current, w = el.clientWidth || 900
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, alto); renderer.setClearColor(0, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight('#ffffff', '#a89e90', 1.15))
    const sol = new THREE.DirectionalLight('#fff6ea', 1.7); sol.position.set(-8, 22, 10); sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.radius = 4
    Object.assign(sol.shadow.camera, { left: -22, right: 22, top: 14, bottom: -14 }); sol.target.position.set(PLANTA.cx, 0, PLANTA.cz); scene.add(sol, sol.target)
    const relleno = new THREE.DirectionalLight('#dfe9ff', 0.5); relleno.position.set(12, 8, 16); scene.add(relleno)
    const camera = new THREE.PerspectiveCamera(26, w / alto, 0.1, 300)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.enableZoom = false; controls.maxPolarAngle = Math.PI / 2.3; controls.minDistance = 5; controls.maxDistance = 70

    // Maqueta: losa de cemento claro, canto oscuro, ventanal con marcos finos y pared lateral blanca
    const { cx, cz, ancho, fondo } = PLANTA
    const piso = caja(ancho, 0.3, fondo, '#d2c3aa', { roughness: 0.8 }); piso.position.set(cx, -0.15, cz); piso.receiveShadow = true; scene.add(piso)
    const canto = caja(ancho + 0.04, 0.12, fondo + 0.04, '#2a2d31', { roughness: 0.5 }); canto.position.set(cx, -0.36, cz); scene.add(canto)
    const atras = cz - fondo / 2
    const vidrio = new THREE.MeshStandardMaterial({ color: '#bcd3e0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 })
    const marco = mat('#1d1f22', { roughness: 0.35, metalness: 0.5 })
    const ventanal = new THREE.Mesh(new THREE.BoxGeometry(ancho, 3, 0.04), vidrio); ventanal.position.set(cx, 1.5, atras + 0.05); scene.add(ventanal)
    for (let x = cx - ancho / 2; x <= cx + ancho / 2 + 0.01; x += 1.7) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3, 0.08), marco); m.position.set(x, 1.5, atras + 0.05); scene.add(m) }
    ;[0.02, 2.98].forEach(y => { const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.06, 0.1), marco); m.position.set(cx, y, atras + 0.05); scene.add(m) })
    const lateral = caja(0.18, 3, fondo, '#f6f6f4', { roughness: 0.8 }); lateral.position.set(cx - ancho / 2 + 0.09, 1.5, cz); lateral.receiveShadow = true; scene.add(lateral)

    // Living: alfombra gris, sofá grafito, mesa ratona redonda blanca y plantas
    const D = AREAS.descanso
    const alfD = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.6), mat('#b3b9b4', { roughness: 1 })); alfD.rotation.x = -Math.PI / 2; alfD.position.set(D.x, 0.004, D.z); alfD.receiveShadow = true
    const tapiz = mat('#3c4046', { roughness: 0.95 })
    const sofa = new THREE.Group()
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 0.95), tapiz); base.position.y = 0.25
    const almohadones = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.8), mat('#474c53', { roughness: 0.95 })); almohadones.position.set(0, 0.46, 0.05)
    const resp = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.55, 0.22), tapiz); resp.position.set(0, 0.62, -0.38)
    const brazoI = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.95), tapiz); brazoI.position.set(-1.66, 0.4, 0)
    const brazoD = brazoI.clone(); brazoD.position.x = 1.66
    ;[-1.6, 1.6].forEach(px => [-0.38, 0.38].forEach(pz => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.1, 8), marco); p.position.set(px, 0.05, pz); sofa.add(p) }))
    sofa.add(base, almohadones, resp, brazoI, brazoD); sofa.position.set(D.x, 0, D.z - 1); sombra(sofa)
    const mesita = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 40), mat('#f3f3f1', { roughness: 0.35 })); mesita.position.set(D.x, 0.4, D.z + 0.55)
    const pieM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 0.38, 16), marco); pieM.position.set(D.x, 0.19, D.z + 0.55)
    ;[mesita, pieM].forEach(m => { m.castShadow = true; m.receiveShadow = true })
    const rD = rotulo(D.label, 4.4); rD.position.set(D.x - 2.4 + rD.userData.ancho / 2, 0.012, D.z + 2.45)
    scene.add(alfD, sofa, mesita, pieM, rD, planta(D.x + 2.25, D.z - 2.3, 1.15), planta(D.x - 2.25, D.z - 2.3, 0.95))

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
      const porFondo = ((fondo * Math.sin(elev) + 3 * Math.cos(elev)) / 2) / Math.tan(v) + (fondo / 2) * Math.cos(elev)
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
    // k: escala de los carteles para que midan siempre los mismos píxeles en pantalla
    st.current = { ...st.current, renderer, scene, camera, controls, dinamico, encuadre, anim: [], k: 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / alto }
    encuadre(); loop()
    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      renderer.domElement.removeEventListener('click', click); renderer.domElement.removeEventListener('pointermove', mover)
      controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement)
    }
  }, [alto])

  useEffect(() => { st.current.onSelect = onSelect }, [onSelect])

  // Zonas, escritorios, agentes, pases y TV (cada vez que cambian los datos)
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
      // Zona: alfombra gris con una línea verde Zebrano al frente
      const zona = new THREE.Mesh(new THREE.PlaneGeometry(largo, 4.4), mat('#a9adb0', { roughness: 1 }))
      zona.rotation.x = -Math.PI / 2; zona.position.set(A.x, 0.004, A.z); zona.receiveShadow = true
      const linea = new THREE.Mesh(new THREE.PlaneGeometry(largo, 0.05), luz(VERDE)); linea.rotation.x = -Math.PI / 2; linea.position.set(A.x, 0.006, A.z + 2.2)
      const r = rotulo(A.label, largo - 0.6); r.position.set(A.x - largo / 2 + 0.3 + r.userData.ancho / 2, 0.012, A.z + 1.85)
      s.dinamico.add(zona, linea, r, planta(A.x + largo / 2 - 0.4, A.z - 1.8, 0.85))
      const x0 = A.x - (n - 1) * 1.2 - (area === 'direccion' ? 1.3 : 0)

      lista.forEach((a, i) => {
        const x = x0 + i * 2.4, zD = A.z + 0.15, semilla = a.slug.length * 3 + i
        const esc = escritorio(x, zD, a.estado, a.color); s.dinamico.add(esc.g)
        const p = persona(a.color, semilla); p.g.userData.slug = a.slug
        p.g.traverse(o => { if (o.isMesh) o.userData.slug = a.slug })
        // Libre y sin actividad hace más de un día: está en el living; si no, en su escritorio
        const ult = a.ultima?.at ? new Date(a.ultima.at).getTime() : 0
        const descansa = a.estado === 'libre' && (!ult || ahora - ult > 864e5)
        p.sentar()
        if (descansa) { const D = AREAS.descanso; p.g.position.set(D.x - 1.05 + (enSillon % 3) * 1.05, 0, D.z - 0.95); p.g.userData.sillon = enSillon++ }
        else { p.g.position.set(x, 0, zD + 0.86); p.g.rotation.y = Math.PI }
        s.dinamico.add(p.g)
        const tag = cartel(a.nombre, s.k, { punto: COLOR_ESTADO[a.estado], badge: a.pendientes || 0 })
        tag.position.set(0, 1.6 + ((p.g.userData.sillon ?? 0) % 3) * 0.36, 0); p.g.add(tag)
        s.puestos[a.slug] = { obj: p.g, x, z: zD }
        const f = i * 0.9 + area.length, { bI, bD, cabeza } = p
        // Brazos apoyados en el escritorio, listos para tipear
        const apoyar = () => { bI.hombro.rotation.x = bD.hombro.rotation.x = -0.35; bI.codo.rotation.x = bD.codo.rotation.x = -1.2; bI.hombro.rotation.z = -0.12; bD.hombro.rotation.z = 0.12 }
        if (descansa) s.anim.push(t => {
          bI.hombro.rotation.x = bD.hombro.rotation.x = -0.2; bI.codo.rotation.x = bD.codo.rotation.x = -0.9
          cabeza.rotation.y = Math.sin(t * 0.5 + f) * 0.45; p.cuerpo.rotation.x = -0.06
        })
        else if (a.estado === 'trabajando') s.anim.push(t => {
          apoyar(); bI.codo.rotation.x = -1.2 + Math.sin(t * 11 + f) * 0.06; bD.codo.rotation.x = -1.2 + Math.cos(t * 11 + f) * 0.06
          cabeza.rotation.x = 0.08 + Math.sin(t * 0.9 + f) * 0.03; cabeza.rotation.y = Math.sin(t * 0.35 + f) * 0.1
        })
        else if (a.estado === 'esperando') s.anim.push(t => {
          apoyar(); bD.hombro.rotation.x = -0.2; bD.hombro.rotation.z = 2.7 + Math.sin(t * 3.2 + f) * 0.12; bD.codo.rotation.x = 0; bD.codo.rotation.z = -0.35 + Math.sin(t * 3.2 + f) * 0.2
          cabeza.rotation.x = -0.12; esc.led.scale.x = 0.75 + Math.abs(Math.sin(t * 2 + f)) * 0.25
        })
        else if (a.estado === 'trabado') s.anim.push(t => {
          bI.hombro.rotation.x = bD.hombro.rotation.x = -0.15; bI.codo.rotation.x = bD.codo.rotation.x = -1.6; bI.hombro.rotation.z = -0.35; bD.hombro.rotation.z = 0.35
          cabeza.rotation.x = 0.18; cabeza.rotation.y = Math.sin(t * 1.6 + f) * 0.35; esc.led.visible = Math.sin(t * 5) > -0.3
        })
        else s.anim.push(t => { apoyar(); p.cuerpo.rotation.x = -0.08; cabeza.rotation.y = Math.sin(t * 0.3 + f) * 0.3 })
      })

      if (area === 'direccion') {
        // Pantalla del tablero sobre un pie delgado, detrás del jefe de oficina
        const tvCanvas = document.createElement('canvas'); tvCanvas.width = 1024; tvCanvas.height = 576
        const tvTex = new THREE.CanvasTexture(tvCanvas); tvTex.colorSpace = THREE.SRGBColorSpace
        const negro = mat('#111214', { roughness: 0.3 })
        const tv = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.65, 0.05), [negro, negro, negro, negro, new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false }), negro])
        tv.position.set(A.x + 1.6, 1.85, A.z - 1.2); tv.castShadow = true
        const pie = caja(0.06, 1.05, 0.06, '#1d1f22', { metalness: 0.5, roughness: 0.3 }); pie.position.set(A.x + 1.6, 0.52, A.z - 1.25)
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 32), mat('#1d1f22', { metalness: 0.5, roughness: 0.3 })); base.position.set(A.x + 1.6, 0.015, A.z - 1.25)
        s.dinamico.add(tv, pie, base)
        dibujarTv(tvCanvas, datos, agentes); tvTex.needsUpdate = true
      }
    })

    // Pases de trabajo: el que entrega camina por el pasillo central hasta el escritorio del otro
    ;(datos.pases || []).slice(0, 3).forEach((ps, k) => {
      const de = s.puestos[ps.de], a = s.puestos[ps.a], ag = agentes.find(x => x.slug === ps.de), dest = agentes.find(x => x.slug === ps.a)
      if (!de || !a || !ag) return
      const w = persona(ag.color, ag.slug.length * 3 + 1); s.dinamico.add(w.g)
      const carpeta = caja(0.24, 0.32, 0.03, '#f3f3f1'); carpeta.position.set(0, -0.3, 0.06); w.bD.codo.add(carpeta)
      const tag = cartel(`${ag.nombre} → ${dest?.nombre}: ${ps.tarea.slice(0, 32)}${ps.tarea.length > 32 ? '…' : ''}`, s.k, { punto: '#3a7bd5', px: 20 })
      tag.position.set(0, 1.9, 0); w.g.add(tag)
      const V = (x, z) => new THREE.Vector3(x, 0, z)
      const ruta = [V(de.x + 0.9, de.z + 1.2), V(de.x + 0.9, 0), V(a.x + 0.9, 0), V(a.x + 0.9, a.z + 1.2)]
      const tramos = ruta.slice(1).map((p, i) => ruta[i].distanceTo(p)), total = tramos.reduce((x, y) => x + y, 0), vel = 1.3
      const ciclo = total / vel + 2.5, off = k * 4
      s.anim.push(t => {
        let d = ((t + off) % ciclo) * vel
        w.g.visible = d <= total
        if (!w.g.visible) return
        let i = 0; while (i < tramos.length - 1 && d > tramos[i]) { d -= tramos[i]; i++ }
        const u = Math.min(1, d / (tramos[i] || 1)), p0 = ruta[i], p1 = ruta[i + 1]
        w.g.position.lerpVectors(p0, p1, u); w.g.lookAt(p1.x, 0, p1.z)
        const fase = t * 7, paso = Math.sin(fase) * 0.45
        w.pI.cadera.rotation.x = paso; w.pD.cadera.rotation.x = -paso
        w.pI.rodilla.rotation.x = Math.max(0, -Math.sin(fase)) * 0.7; w.pD.rodilla.rotation.x = Math.max(0, Math.sin(fase)) * 0.7
        w.bI.hombro.rotation.x = -paso * 0.6; w.bD.hombro.rotation.x = -0.5; w.bD.codo.rotation.x = -1.1
        w.g.position.y = Math.abs(Math.cos(fase)) * 0.025
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
  c.fillStyle = '#0f1214'; c.fillRect(0, 0, 1024, 576)
  c.fillStyle = '#5fd3bc'; c.font = `700 38px ${FUENTE}`; c.fillText('ZEBRANO · OFICINA', 40, 62)
  c.fillStyle = '#9aa0a6'; c.font = `500 24px ${FUENTE}`; c.fillText(new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }), 770, 60)
  const kpi = [['Consultas 7 d', tb.consultas_7d], ['Cotizaciones 7 d', tb.cotizaciones_7d], ['Aprobadas 30 d', tb.aprobadas_30d], ['Por aprobar', tb.por_aprobar], ['Aprendidos', (tb.conocimiento || 0) + (tb.aprendizajes || 0)]]
  kpi.forEach(([l, v], i) => { const x = 40 + i * 196; c.fillStyle = '#1b2023'; c.fillRect(x, 90, 180, 104); c.fillStyle = i === 3 ? '#f2b01e' : '#fff'; c.font = `700 46px ${FUENTE}`; c.fillText(String(v ?? 0), x + 16, 150); c.fillStyle = '#9aa0a6'; c.font = `500 20px ${FUENTE}`; c.fillText(l, x + 16, 182) })
  agentes.forEach((a, i) => {
    const y = 238 + i * 40; c.fillStyle = COLOR_ESTADO[a.estado]; c.beginPath(); c.arc(56, y - 8, 9, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#fff'; c.font = `600 25px ${FUENTE}`; c.fillText(a.nombre, 80, y)
    c.fillStyle = '#a3ada7'; c.font = `400 22px ${FUENTE}`
    const txt = a.estado === 'trabado' ? (a.bloqueo || 'Trabado') : (a.ultima?.tarea || a.puesto)
    c.fillText(txt.length > 60 ? txt.slice(0, 59) + '…' : txt, 240, y)
    if (a.pendientes) { c.fillStyle = '#f2b01e'; c.font = `700 22px ${FUENTE}`; c.fillText(String(a.pendientes), 970, y) }
  })
}
