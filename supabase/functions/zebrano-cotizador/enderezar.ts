// v69 (11/11/2026): los planos de arquitectura suelen venir girados 90°, y así los modelos los leen mal
// (toman el largo por el alto, inventan módulos). Antes de leerlos se pregunta a la IA cuánto girar cada imagen
// y se giran acá, en múltiplos exactos de 90° (sin depender de la rotación de la librería).
// @ts-nocheck
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { callLLM } from "./llm.ts";

const SYS = `Mirás imágenes de planos, bosquejos o fotos de muebles. Para cada imagen decí cuántos grados hay que girarla EN SENTIDO HORARIO (0, 90, 180 o 270) para que los textos y las cotas se lean derechos, de izquierda a derecha. Si no tiene textos o ya está derecha, 0. Respondé SOLO este JSON: {"rotar":[un numero por imagen, en orden]}`;

// Giro horario de 90° sobre el bitmap RGBA (u32 por pixel).
function giro90(im) {
  const w = im.width, h = im.height, out = new Image(h, w);
  const src = new Uint32Array(im.bitmap.buffer, im.bitmap.byteOffset, w * h);
  const dst = new Uint32Array(out.bitmap.buffer, out.bitmap.byteOffset, w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dst[x * h + (h - 1 - y)] = src[y * w + x];
  return out;
}
const aB64 = (b) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

export async function enderezar(imgs) {
  if (!imgs?.length) return { imgs, rotar: [], usage: null };
  const cont = imgs.map((b) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b } }));
  cont.push({ type: "text", text: "¿Cuántos grados en sentido horario hay que girar cada imagen?" });
  const r = await callLLM([{ role: "user", content: cont }], SYS).catch(() => null);
  const rotar = (r?.parsed?.rotar ?? []).map((g) => [90, 180, 270].includes(Number(g)) ? Number(g) : 0);
  const out = [];
  for (let i = 0; i < imgs.length; i++) {
    const g = rotar[i] || 0;
    if (!g) { out.push(imgs[i]); continue; }
    try {
      let im = await Image.decode(Uint8Array.from(atob(imgs[i]), (c) => c.charCodeAt(0)));
      for (let k = 0; k < g / 90; k++) im = giro90(im);
      out.push(aB64(await im.encodeJPEG(85)));
    } catch { out.push(imgs[i]); }
  }
  return { imgs: out, rotar, usage: r?.usage ?? null };
}
