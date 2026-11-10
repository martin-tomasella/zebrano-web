// Optimizador de corte en guillotina (F2, 10/11/2026).
// Cada placa empieza como un rectángulo libre; cada pieza se ubica en el libre donde menos sobra del lado más ajustado
// y el resto se parte en dos con un corte de lado a lado (guillotina), así la sierra puede cortarlo.
// La sierra se come `kerf` mm entre piezas. Si el material tiene veta, la pieza no se gira:
// su largo va a lo largo de la placa.
// ponytail: heurística (mejor ajuste por el lado corto, piezas de mayor a menor); no es el óptimo exacto, pero da 80–90% en muebles típicos.

export const PLACA = { largo: 2750, ancho: 1830, kerf: 4 }
export const tieneVeta = material => /rovere|roble|nogal|paraiso|paraíso|cedro|teka|teca|madera|veta|wengue|haya|fresno|olmo|guatambu/i.test(material || '')

export function optimizar(piezas, { largo = PLACA.largo, ancho = PLACA.ancho, kerf = PLACA.kerf, veta = false } = {}) {
  const items = []
  for (const p of piezas) for (let i = 0; i < (Number(p.cantidad) || 1); i++)
    items.push({ nombre: p.nombre, modulo: p.modulo, l: Number(p.largo_mm), a: Number(p.ancho_mm) })
  items.sort((x, y) => y.l * y.a - x.l * x.a || y.l - x.l)

  const placas = [], noEntran = []
  const nueva = () => { const pl = { libres: [{ x: 0, y: 0, w: largo, h: ancho }], piezas: [] }; placas.push(pl); return pl }
  const encaja = (r, w, h) => w <= r.w && h <= r.h

  for (const it of items) {
    const opciones = veta ? [[it.l, it.a, false]] : [[it.l, it.a, false], [it.a, it.l, true]]
    if (!opciones.some(([w, h]) => w <= largo && h <= ancho)) { noEntran.push(it); continue }
    let mejor = null
    for (const pl of placas) pl.libres.forEach((r, i) => opciones.forEach(([w, h, rot]) => {
      if (!encaja(r, w, h)) return
      const lado = Math.min(r.w - w, r.h - h), sobra = r.w * r.h - w * h
      if (!mejor || lado < mejor.lado || (lado === mejor.lado && sobra < mejor.sobra)) mejor = { pl, i, w, h, rot, lado, sobra }
    }))
    if (!mejor) {
      const pl = nueva(), r = pl.libres[0]
      const [w, h, rot] = opciones.filter(([w, h]) => encaja(r, w, h)).sort((p, q) => Math.min(r.w - p[0], r.h - p[1]) - Math.min(r.w - q[0], r.h - q[1]))[0]
      mejor = { pl, i: 0, w, h, rot }
    }
    const { pl, i, w, h, rot } = mejor
    const r = pl.libres.splice(i, 1)[0]
    pl.piezas.push({ ...it, x: r.x, y: r.y, w, h, rot })
    // Corte guillotina: se corta a lo largo del lado sobrante más corto, para dejar el retazo más grande entero.
    const W = w + kerf, H = h + kerf
    const derecha = { x: r.x + W, y: r.y, w: r.w - W, h: 0 }, abajo = { x: r.x, y: r.y + H, w: 0, h: r.h - H }
    if (r.w - W < r.h - H) { derecha.h = h; abajo.w = r.w } else { derecha.h = r.h; abajo.w = w }
    for (const n of [derecha, abajo]) if (n.w > 0 && n.h > 0) pl.libres.push(n)
  }
  const areaPlaca = largo * ancho
  return {
    placas: placas.map(pl => ({
      piezas: pl.piezas,
      uso: pl.piezas.reduce((a, p) => a + p.w * p.h, 0) / areaPlaca,
      retazos: pl.libres.filter(r => r.w >= 300 && r.h >= 300),
    })),
    noEntran,
    uso: placas.length ? items.filter(it => !noEntran.includes(it)).reduce((a, p) => a + p.l * p.a, 0) / (placas.length * areaPlaca) : 0,
  }
}

// Agrupa piezas por material y optimiza cada uno.
export function optimizarPorMaterial(piezas, placasCfg = []) {
  const grupos = {}
  for (const p of piezas) (grupos[p.material || 'Sin material'] ??= []).push(p)
  return Object.entries(grupos).map(([material, ps]) => {
    const c = placasCfg.find(c => c.material === material) || placasCfg.find(c => material.startsWith(c.material) || c.material.startsWith(material))
    const largo = c?.largo_mm || PLACA.largo, ancho = c?.ancho_mm || PLACA.ancho
    return { material, largo, ancho, veta: tieneVeta(material), ...optimizar(ps, { largo, ancho, veta: tieneVeta(material) }) }
  })
}

// Chequeo mínimo: node src/lib/corte.check.mjs
export function _check() {
  const r = optimizar([{ nombre: 'Lateral', largo_mm: 684, ancho_mm: 550, cantidad: 2 }, { nombre: 'Base', largo_mm: 600, ancho_mm: 550, cantidad: 1 }, { nombre: 'Puerta', largo_mm: 717, ancho_mm: 296, cantidad: 2 }])
  console.assert(r.placas.length === 1 && r.placas[0].piezas.length === 5, 'un bajo entra en una placa')
  const solapa = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
  const ps = r.placas[0].piezas
  console.assert(ps.every((p, i) => ps.every((q, j) => i === j || !solapa(p, q))), 'sin superposiciones')
  console.assert(ps.every(p => p.x + p.w <= 2750 && p.y + p.h <= 1830), 'dentro de la placa')
  const muchas = optimizar([{ largo_mm: 1830, ancho_mm: 900, cantidad: 6 }])
  console.assert(muchas.placas.length === 2, `6 piezas de 1830x900 = 2 placas (3 por placa) (dio ${muchas.placas.length})`)
  const v = optimizar([{ largo_mm: 1800, ancho_mm: 400, cantidad: 1 }], { veta: true })
  console.assert(!v.placas[0].piezas[0].rot, 'con veta no gira')
  return r
}
