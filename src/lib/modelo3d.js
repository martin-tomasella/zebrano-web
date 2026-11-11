// Modelo 3D paramétrico de los módulos de una OT (12/11/2026).
// Sale de las mismas medidas y reglas que el despiece (despiece.ts del cotizador): placa de 18 mm,
// fondo de 3 mm clavado, frentes superpuestos 2 cm delante del casco, cajones de 150 mm arriba si hay puertas.
// No es el render de la IA: es la geometría real, para armar.
// Ejes: x = ancho (izq→der), y = alto (piso→arriba), z = profundidad (pared→frente). Unidades: mm.
const T = 18, F = 3, LUZ = 3, TRAV = 100

// Piezas (cajas) de un módulo en coordenadas locales. dir = hacia dónde se separa en la vista explotada.
export function piezasModulo(m) {
  const W = +m.ancho_mm, H = +m.alto_mm, P = +m.prof_mm, Z = +m.zocalo_mm || 0
  const fam = String(m.familia || 'bajo').toLowerCase(), bajo = /bajo|cajonera|vanitory|isla/.test(fam)
  const emb = m.frentes === 'embutidos', out = []
  const add = (nombre, tipo, x, y, z, w, h, d, dir, paso) => w > 0 && h > 0 && d > 0 && out.push({ nombre, tipo, x, y, z, w, h, d, dir, paso })
  if (Z) add('Zócalo', 'casco', 0, 0, P - 60, W, Z, T, [0, -1, 0.3], 1)
  add('Base', 'casco', 0, Z, F, W, T, P - F, [0, -1, 0], 1)
  add('Lateral izquierdo', 'casco', 0, Z + T, F, T, H - 2 * T, P - F, [-1, 0, 0], 1)
  add('Lateral derecho', 'casco', W - T, Z + T, F, T, H - 2 * T, P - F, [1, 0, 0], 1)
  if (bajo) {
    add('Travesaño delantero', 'casco', 0, Z + H - T, P - TRAV, W, T, TRAV, [0, 1, 0.4], 2)
    add('Travesaño trasero', 'casco', 0, Z + H - T, F, W, T, TRAV, [0, 1, -0.4], 2)
  } else add('Techo', 'casco', 0, Z + H - T, F, W, T, P - F, [0, 1, 0], 2)
  add('Fondo', 'fondo', 0, Z, 0, W, H, F, [0, 0, -1], 3)
  const ne = +m.estantes || 0
  for (let i = 1; i <= ne; i++) add(`Estante ${i}`, 'estante', T, Z + T + ((H - 2 * T) * i) / (ne + 1), F + 10, W - 2 * T, T, P - F - 10, [0, 0, 0.6], 4)
  // Frentes
  const fw = emb ? W - 2 * T : W, fh = emb ? H - 2 * T : H, fx = emb ? T : 0, fy = Z + (emb ? T : 0), fz = emb ? P - T : P
  const nc = +m.cajones || 0, np = +m.puertas || 0
  const altoC = nc && np ? Math.min(150 * nc, fh / 2) : fh
  for (let i = 0; i < nc; i++) {
    const a = altoC / nc
    add(`Cajón ${i + 1}`, 'frente', fx + LUZ, fy + fh - a * (i + 1) + LUZ / 2, fz, fw - 2 * LUZ, a - LUZ, T, [0, 0, 1], 6)
  }
  if (np) {
    const ph = nc ? fh - altoC : fh, pw = fw / np
    for (let i = 0; i < np; i++) add(`Puerta ${i + 1}`, 'frente', fx + pw * i + LUZ / 2, fy + LUZ / 2, fz, pw - LUZ, ph - LUZ, T, [0, 0, 1], 5)
  }
  return out
}

// Ubica los módulos (con sus cantidades) uno al lado del otro; las alacenas van en una fila arriba (600 mm sobre los bajos).
export function escena(modulos) {
  const lista = (modulos || []).flatMap(m => Array.from({ length: Math.max(1, +m.cantidad || 1) }, (_, k) => ({ ...m, nombre: (+m.cantidad || 1) > 1 ? `${m.nombre} ${k + 1}` : m.nombre })))
  const alto = m => /alacena/i.test(m.familia || '')
  const altoBajo = Math.max(0, ...lista.filter(m => !alto(m)).map(m => (+m.alto_mm || 0) + (+m.zocalo_mm || 0)))
  const profMax = Math.max(0, ...lista.map(m => +m.prof_mm || 0))
  let xb = 0, xa = 0
  return lista.map((m, i) => {
    const a = alto(m), x = a ? xa : xb
    if (a) xa += +m.ancho_mm; else xb += +m.ancho_mm
    // Las alacenas, contra la pared (z = 0); los bajos también: la profundidad crece hacia el frente.
    return { i, modulo: m, x, y: a ? (altoBajo || 850) + 600 : 0, z: a ? 0 : 0, piezas: piezasModulo(m), profMax }
  })
}

// Pasos de armado de un módulo, en el orden en que se arma en el taller.
export function pasosArmado(m) {
  const ps = piezasModulo(m), hay = t => ps.some(p => p.nombre.startsWith(t))
  const pasos = []
  pasos.push(`Base y laterales: atornillar los laterales sobre la base (${+m.ancho_mm} mm de ancho exterior), a escuadra.`)
  pasos.push(hay('Travesaño') ? 'Travesaños: delantero y trasero arriba, entre laterales (dejan apoyar la mesada).' : 'Techo: entre los laterales, arriba.')
  if (+m.zocalo_mm) pasos.push(`Zócalo de ${+m.zocalo_mm} mm debajo de la base, retirado 4 cm del frente.`)
  if (+m.patas) pasos.push(`Patas: ${+m.patas} por módulo, debajo de la base.`)
  pasos.push('Fondo: escuadrar el casco midiendo diagonales y clavar el fondo de 3 mm.')
  if (+m.estantes) pasos.push(`Estantes: ${+m.estantes} (${+m.ancho_mm - 2 * T} mm), sobre soportes regulables o fijos según plano.`)
  if (+m.cajones) pasos.push(`Cajones: ${+m.cajones}. Armar las cajas, colocar correderas y presentar los frentes con luz de 3 mm.`)
  if (+m.puertas) pasos.push(`Puertas: ${+m.puertas}, ${m.frentes === 'embutidos' ? 'embutidas en el casco' : 'superpuestas al casco'}. Bisagras de cazoleta 35 mm y regular luces de 3 mm.`)
  if (+m.terminaciones) pasos.push(`Lateral${+m.terminaciones > 1 ? 'es' : ''} de terminación: ${+m.terminaciones}, cubriendo casco y frente.`)
  return pasos
}
