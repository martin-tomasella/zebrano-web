import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { escena } from '../lib/modelo3d'

// Visor 3D de los módulos: girar con el mouse o el dedo, rueda para zoom. "explotado" separa las piezas para ver cómo se arma.
const color = (mat, tipo) => {
  if (tipo === 'fondo') return 0xd9d4cc
  const m = String(mat || '').toLowerCase()
  const base = /roble|rovere|nogal|paraiso|paraíso|cedro|madera|teka|teca/.test(m) ? 0xb88b5c : /negro/.test(m) ? 0x3a3a3a : /gris|grafito/.test(m) ? 0x8d9196 : 0xf1eee8
  return tipo === 'estante' ? new THREE.Color(base).offsetHSL(0, 0, 0.04) : base
}

const Vista3D = forwardRef(function Vista3D({ modulos, explotado = false, alto = 420 }, ref) {
  const caja = useRef(null), estado = useRef({})

  useImperativeHandle(ref, () => ({
    // Foto del visor desde un ángulo fijo (para el instructivo impreso).
    captura: () => { const s = estado.current; if (!s.renderer) return null; s.renderer.render(s.scene, s.camera); return s.renderer.domElement.toDataURL('image/png') },
  }))

  useEffect(() => {
    const el = caja.current, w = el.clientWidth || 600, h = alto
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h); el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 1.1))
    const sol = new THREE.DirectionalLight(0xffffff, 1.2); sol.position.set(2000, 3500, 3000); scene.add(sol)
    const camera = new THREE.PerspectiveCamera(35, w / h, 10, 100000)
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true
    const grupo = new THREE.Group(); scene.add(grupo)
    let raf = 0
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop) }
    const ro = new ResizeObserver(() => { const ww = el.clientWidth || w; renderer.setSize(ww, h); camera.aspect = ww / h; camera.updateProjectionMatrix() })
    ro.observe(el)
    estado.current = { renderer, scene, camera, controls, grupo }
    loop()
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement) }
  }, [alto])

  useEffect(() => {
    const { grupo, camera, controls } = estado.current
    if (!grupo) return
    grupo.clear()
    const mods = escena(modulos)
    mods.forEach((mm, k) => {
      // En el despiezado, cada pieza se separa en proporción al tamaño del módulo y los módulos se apartan entre sí.
      const sep = explotado ? Math.max(120, 0.15 * Math.max(+mm.modulo.ancho_mm || 0, +mm.modulo.alto_mm || 0)) : 0
      const dx = explotado ? k * 2.2 * sep : 0
      for (const p of mm.piezas) {
        const g = new THREE.BoxGeometry(p.w, p.h, p.d)
        const mat = new THREE.MeshStandardMaterial({ color: color(mm.modulo.material, p.tipo), roughness: 0.75, transparent: p.tipo === 'frente' && explotado, opacity: p.tipo === 'frente' && explotado ? 0.85 : 1 })
        const mesh = new THREE.Mesh(g, mat)
        const [ex, ey, ez] = p.dir
        mesh.position.set(mm.x + dx + p.x + p.w / 2 + ex * sep, mm.y + p.y + p.h / 2 + ey * sep, mm.z + p.z + p.d / 2 + ez * sep * (p.tipo === 'frente' ? 2.5 : 1))
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x2b2b2b })))
        grupo.add(mesh)
      }
    })
    // Encuadre: cámara al frente en diagonal, mirando el centro del conjunto.
    const box = new THREE.Box3().setFromObject(grupo)
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y, s.z)
      camera.position.set(c.x + r * 0.55, c.y + r * 0.45, c.z + r * 1.35); controls.target.copy(c); controls.update()
    }
  }, [modulos, explotado])

  return <div ref={caja} style={{ width: '100%', height: alto, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(#f4f1ec, #e2ddd5)', touchAction: 'none' }} aria-label="Modelo 3D del mueble; arrastrá para girar" role="img" />
})
export default Vista3D
