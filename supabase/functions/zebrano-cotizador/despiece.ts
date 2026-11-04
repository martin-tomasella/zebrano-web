// @ts-nocheck
// Despiece por reglas del taller Zebrano (03/11/2026). La IA solo describe los módulos; las piezas y herrajes salen de acá,
// así el mismo mueble da siempre el mismo despiece.
// Reglas (Martín): placa 18 mm; base y techo apoyan por encima/debajo de los laterales (los laterales van entre ellos);
// los bajos llevan dos travesaños en lugar de techo; fondo de fibro 3 mm clavado atrás; luz de 3 mm;
// puertas y frentes superpuestos al casco (casco 55 + puerta 2 = 57) salvo que se indique "embutidos";
// bisagras: 2 hasta 900 mm de alto, 3 hasta 1600, 4 más; cajones con laterales y frente en 18 mm, fondo fibro 3 mm,
// lateral según el alto del frente; zócalo o patas solo si se indican.
const T = 18, LUZ = 3, FIBRO = 3, TRAV = 100, COR_LADO = 13;

const bisagrasPorPuerta = (alto) => (alto <= 900 ? 2 : alto <= 1600 ? 3 : 4);
const r = (x) => Math.round(x);

/**
 * @param {Array<{nombre:string, familia:string, ancho_mm:number, alto_mm:number, prof_mm:number, puertas?:number,
 *   cajones?:number, estantes?:number, frentes?:"superpuestos"|"embutidos", zocalo_mm?:number, patas?:number, cantidad?:number}>} modulos
 * @param {{placa:string, fondo:string}} mat  nombres exactos de catálogo
 * @returns {{piezas:any[], herrajes:{bisagras:number, correderas:{largo_mm:number, pares:number}[], patas:number}, avisos:string[]}}
 */
export function despiece(modulos, mat) {
  const piezas = [], avisos = [];
  const herr = { bisagras: 0, correderas: [], patas: 0 };
  for (const m of modulos ?? []) {
    const n = Math.max(1, Number(m.cantidad) || 1);
    const W = Number(m.ancho_mm), H = Number(m.alto_mm), P = Number(m.prof_mm);
    if (!(W > 2 * T && H > 2 * T && P > 2 * T)) { avisos.push(`${m.nombre}: medidas incompletas, no lo despiecé`); continue; }
    const placa = m.material || mat.placa;
    const fam = String(m.familia ?? "bajo").toLowerCase();
    const bajo = /bajo|cajonera|vanitory|isla/.test(fam);
    const emb = m.frentes === "embutidos";
    const add = (nombre, largo, ancho, cant, material = placa, cl = false, ca = false) => {
      if (cant > 0 && largo > 0 && ancho > 0)
        piezas.push({ modulo: m.nombre, nombre, material, largo_mm: r(Math.max(largo, ancho)), ancho_mm: r(Math.min(largo, ancho)), cantidad: cant * n,
          canto_largo: largo >= ancho ? cl : ca, canto_ancho: largo >= ancho ? ca : cl });
    };
    // Casco: base y techo enteros, laterales entre ellos.
    add("Lateral", H - 2 * T, P, 2, placa, true);
    add("Base", W, P, 1, placa, true);
    if (bajo) { add("Travesaño delantero", W, TRAV, 1, placa, true); add("Travesaño trasero", W, TRAV, 1); }
    else add("Techo", W, P, 1, placa, true);
    add("Estante", W - 2 * T, P - 10, Number(m.estantes) || 0, placa, true);
    add("Fondo (clavado)", W, H, 1, mat.fondo);
    if (Number(m.zocalo_mm) > 0) add("Zócalo", W, Number(m.zocalo_mm), 1, placa, true);
    herr.patas += (Number(m.patas) || 0) * n;

    // Frentes: superpuestos cubren todo el casco; embutidos van dentro del hueco.
    const fw = emb ? W - 2 * T : W, fh = emb ? H - 2 * T : H;
    const nc = Number(m.cajones) || 0, np = Number(m.puertas) || 0;
    // Con puertas y cajones, el cajón va arriba (150 mm por cajón) y las puertas abajo; solo cajones: frentes iguales.
    const altoCajones = nc && np ? Math.min(150 * nc, fh / 2) : fh;
    if (nc) {
      const fa = (altoCajones - LUZ * nc) / nc;
      add("Frente de cajón", fw - 2 * LUZ, fa, nc, placa, true, true);
      const largoC = Math.floor((P - 50) / 50) * 50, latA = Math.max(80, fa - 40), anchoInt = W - 2 * T - 2 * COR_LADO;
      add("Lateral de cajón", largoC, latA, 2 * nc);
      add("Contrafrente/trasero de cajón", anchoInt - 2 * T, latA, 2 * nc);
      add("Fondo de cajón", anchoInt, largoC, nc, mat.fondo);
      herr.correderas.push({ largo_mm: largoC, pares: nc * n });
    }
    if (np) {
      const altoP = fh - (nc ? altoCajones : 0) - LUZ;
      const anchoP = (fw - LUZ * (np + 1)) / np;
      add("Puerta", anchoP, altoP, np, placa, true, true);
      herr.bisagras += bisagrasPorPuerta(altoP) * np * n;
    }
  }
  return { piezas, herrajes: herr, avisos };
}

// Prueba mínima (node despiece.mjs): bajo de 600x720x550 con 2 puertas y 1 estante.
if (typeof Deno === "undefined" && import.meta.url.endsWith("despiece.mjs")) {
  const d = despiece([{ nombre: "Bajo", familia: "bajo", ancho_mm: 600, alto_mm: 720, prof_mm: 550, puertas: 2, estantes: 1 }], { placa: "MB", fondo: "F" });
  const by = Object.fromEntries(d.piezas.map((p) => [p.nombre, p]));
  console.assert(by["Lateral"].largo_mm === 684 && by["Lateral"].ancho_mm === 550 && by["Lateral"].cantidad === 2, "lateral");
  console.assert(by["Base"].largo_mm === 600 && !by["Techo"] && by["Travesaño delantero"].ancho_mm === 100, "base/travesaños");
  console.assert(by["Estante"].largo_mm === 564 && by["Estante"].ancho_mm === 540, "estante");
  console.assert(by["Puerta"].ancho_mm === 296 && by["Puerta"].largo_mm === 717 && by["Puerta"].cantidad === 2, "puertas");
  console.assert(d.herrajes.bisagras === 4, "bisagras");
  const c = despiece([{ nombre: "Cajonera", familia: "cajonera", ancho_mm: 450, alto_mm: 720, prof_mm: 550, cajones: 3 }], { placa: "MB", fondo: "F" });
  const cj = Object.fromEntries(c.piezas.map((p) => [p.nombre, p]));
  console.assert(cj["Frente de cajón"].cantidad === 3 && cj["Lateral de cajón"].largo_mm === 500 && c.herrajes.correderas[0].pares === 3, "cajones");
  const a = despiece([{ nombre: "Alacena", familia: "alacena", ancho_mm: 800, alto_mm: 1700, prof_mm: 350, puertas: 2, frentes: "embutidos" }], { placa: "MB", fondo: "F" });
  console.assert(a.piezas.some((p) => p.nombre === "Techo") && a.herrajes.bisagras === 8, "alacena alta embutida: 4 bisagras por puerta");
  console.log("ok", d.piezas.length, c.piezas.length, a.piezas.length);
}
