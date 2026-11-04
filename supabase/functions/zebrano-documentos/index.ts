// @ts-nocheck
// zebrano-documentos (03/11/2026): arma en PDF el presupuesto para el cliente y la hoja de taller de la OT,
// los sube al bucket privado "documentos" y devuelve un link firmado (7 días).
// Lo llama el cotizador con el service role; un empleado con sesión también puede pedirlo.
// v2: PDF (Storage sirve los .html como texto plano, así que no se podían abrir).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import * as AT from "npm:jspdf-autotable@3.8.4";
const autoTable = (typeof AT.default === "function" ? AT.default : AT.default?.default) ?? AT.autoTable; // interop ESM/CJS

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Content-Type": "application/json" };
const $ = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const cm = (mm) => (Number(mm) / 10).toLocaleString("es-AR") + " cm";
const MARRON = [91, 70, 54];
let avisos = []; // problemas no fatales (ej. render que no se pudo embeber); vuelven en la respuesta

async function autorizado(req, sb) {
  const tok = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!tok) return false;
  if (tok === SERVICE) return true;
  const { data: u } = await sb.auth.getUser(tok);
  if (!u?.user) return false;
  const { data: e } = await sb.from("empleados").select("activo").eq("auth_user_id", u.user.id).maybeSingle();
  return !!e && e.activo !== false;
}

function moduloTexto(m) {
  const p = [];
  if (Number(m.puertas)) p.push(`${m.puertas} puerta${m.puertas > 1 ? "s" : ""}`);
  if (Number(m.cajones)) p.push(`${m.cajones} ${m.cajones > 1 ? "cajones" : "cajón"}`);
  if (Number(m.estantes)) p.push(`${m.estantes} estante${m.estantes > 1 ? "s" : ""}`);
  const n = Number(m.cantidad) > 1 ? `${m.cantidad} x ` : "";
  return `${n}${m.nombre} de ${cm(m.ancho_mm)} de frente x ${cm(m.alto_mm)} de alto x ${cm(m.prof_mm)} de profundidad${p.length ? ", con " + p.join(", ") : ""}.`;
}

// Imagen del render, escalada al ancho útil; si no se puede bajar, se omite.
async function imagen(doc, url, y, maxH = 95) {
  if (!url) { avisos.push("sin render"); return y; }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) { avisos.push(`render HTTP ${r.status}`); console.error("render", url, r.status); return y; }
    const b = new Uint8Array(await r.arrayBuffer());
    let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    const tipo = (r.headers.get("content-type") || "").includes("png") ? "PNG" : "JPEG";
    const data = `data:image/${tipo.toLowerCase()};base64,${btoa(s)}`;
    const p = doc.getImageProperties(data);
    let w = 180, h = (p.height * w) / p.width;
    if (h > maxH) { h = maxH; w = (p.width * h) / p.height; }
    doc.addImage(data, tipo, 15 + (180 - w) / 2, y, w, h);
    return y + h + 4;
  } catch (e) { avisos.push(`render: ${e?.message ?? e}`); console.error("render", url, e?.message ?? e); return y; }
}

function cabecera(doc, titulo, derecha) {
  doc.setTextColor(...MARRON).setFont("helvetica", "bold").setFontSize(18).text(titulo, 15, 18);
  doc.setTextColor(90).setFont("helvetica", "normal").setFontSize(9).text("Carpintería a medida", 15, 23);
  doc.setTextColor(30).setFontSize(9).text(derecha, 195, 13, { align: "right" });
  doc.setDrawColor(...MARRON).setLineWidth(0.8).line(15, 30, 195, 30);
  return 36;
}
const subtitulo = (doc, t, y) => { doc.setTextColor(...MARRON).setFont("helvetica", "bold").setFontSize(11).text(t, 15, y); doc.setTextColor(30).setFont("helvetica", "normal").setFontSize(9); return y + 5; };
const parrafo = (doc, t, y, size = 9) => { doc.setFontSize(size); const l = doc.splitTextToSize(t, 180); if (y + l.length * 4.2 > 285) { doc.addPage(); y = 15; } doc.text(l, 15, y); return y + l.length * 4.2 + 1; };
const tabla = (doc, y, head, body, opts = {}) => { autoTable(doc, { startY: y, head: [head], body, theme: "grid", styles: { fontSize: 8.5, cellPadding: 1.5 }, headStyles: { fillColor: [243, 238, 233], textColor: 30 }, margin: { left: 15, right: 15 }, ...opts }); return doc.lastAutoTable.finalY + 5; };

async function presupuesto(d) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = cabecera(doc, "ZEBRANO", `Cotización: ${d.numero}\nFecha: ${d.fecha}\nCliente: ${d.cliente || "-"}\nTel: ${d.telefono || "-"}`);
  y = await imagen(doc, d.render_url, y);
  const filas = [["1", "1", d.titulo, $(d.precio_base)]];
  if (Number(d.adicional) > 0) filas.push(["2", "1", `Adicional por color (${d.adicional_detalle ?? ""})`, $(d.adicional)]);
  y = tabla(doc, y, ["Item", "Cant.", "Descripción", "Total"], filas, { columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 14 }, 3: { cellWidth: 32, halign: "right" } } });
  const mods = d.modulos ?? [];
  y = subtitulo(doc, "Descripción", y);
  for (const m of mods) y = parrafo(doc, "• " + moduloTexto(m), y);
  const mat = [...new Set(mods.map((m) => m.material).filter(Boolean))].join(", ") || "Melamina 18 mm";
  y = parrafo(doc, `Materiales: ${mat}. Cantos al tono aplicados a máquina. Fondo fibro 3 mm blanco. ${mods.some((m) => m.frentes === "embutidos") ? "Frentes embutidos." : "Frentes superpuestos."} Correderas telescópicas y bisagras cazoleta.`, y + 1);
  doc.setFont("helvetica", "bold").setFontSize(12).text(`Total efectivo: ${$(d.total)}`, 195, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  y = subtitulo(doc, "Condiciones", y + 12);
  for (const c of ["El presupuesto no incluye IVA.", "Validez de la oferta: 7 días.",
    "Condiciones de fabricación: se deberán relevar las medidas en obra al momento de la contratación.",
    "Condiciones de contratación: anticipo 50%. Saldos contra entregas parciales/final.",
    "Condiciones de pago: valor en efectivo, sin IVA. Por medios electrónicos +21% (MercadoPago, transferencia bancaria).",
    "El total debe estar cancelado al momento de la entrega; de lo contrario se reprogramará la instalación.",
    "Una vez señado el presupuesto, el plazo para cambios de diseño o materialidad es de 7 días corridos.",
    "Plazo de entrega: 10/25 días hábiles según terminaciones elegidas.",
    "Forma y lugar de entrega: en el domicilio indicado por el cliente dentro de CABA. Fuera de esa área se notificará con anticipación el costo adicional."]) y = parrafo(doc, "• " + c, y, 8);
  y = parrafo(doc, "Sin otro particular, saluda a ud. muy atentamente.", y + 3);
  doc.setFont("helvetica", "bold").text("Rocío Tomasella", 15, y + 6); doc.setFont("helvetica", "normal").text("Proyectos", 15, y + 10);
  return doc;
}

async function hojaOT(d) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = cabecera(doc, "ORDEN DE FABRICACIÓN", `${d.numero_ot} · PPTO ${d.presupuesto}\nCliente: ${d.cliente || "-"}\nTel: ${d.telefono || "-"}\nFecha: ${d.fecha} · ${d.tipo_trabajo || ""}`);
  y = await imagen(doc, d.render_url, y, 80);
  y = subtitulo(doc, "Módulos", y);
  for (const m of d.modulos ?? []) y = parrafo(doc, `• ${moduloTexto(m)} ${m.material ?? ""}${m.frentes ? " · frentes " + m.frentes : ""}${Number(m.zocalo_mm) ? ` · zócalo ${m.zocalo_mm} mm` : ""}${Number(m.patas) ? ` · ${m.patas} patas` : ""}${Number(m.terminaciones) ? ` · ${m.terminaciones} lateral(es) de terminación` : ""}`, y);
  y = tabla(doc, y + 2, ["Herraje", "Cant."], (d.herrajes ?? []).map((h) => [h.nombre, String(h.cantidad)]), { columnStyles: { 1: { cellWidth: 20, halign: "right" } } });
  y = tabla(doc, y, ["Etapa", "Horas", "Personas"], (d.mano_obra ?? []).map((m) => [m.etapa ?? m.operacion, String(m.horas_estimadas ?? ""), String(m.operarios ?? "")]), { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } } });
  const porMod = {};
  for (const p of d.piezas ?? []) (porMod[p.modulo_nombre || p.modulo || "General"] ??= []).push(p);
  const canto = (p) => [p.con_canto_largo ? "L" : "", p.con_canto_ancho ? "A" : ""].filter(Boolean).join("+") || "-";
  y = subtitulo(doc, "Despiece", y);
  for (const [mod, ps] of Object.entries(porMod)) {
    y = tabla(doc, y, [mod, "Cant.", "Largo", "Ancho", "Material", "Canto"], ps.map((p) => [p.nombre_pieza, String(p.cantidad), String(p.largo_mm), String(p.ancho_mm), p.material, canto(p)]),
      { columnStyles: { 1: { halign: "right", cellWidth: 12 }, 2: { halign: "right", cellWidth: 16 }, 3: { halign: "right", cellWidth: 16 }, 5: { cellWidth: 14 } } });
  }
  parrafo(doc, "Despiece calculado con las reglas del taller. Verificar medidas en obra antes de cortar.", y, 8);
  return doc;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", SERVICE);
  if (!(await autorizado(req, sb))) return Response.json({ ok: false, error: "no autorizado" }, { status: 401, headers: CORS });
  try {
    const d = await req.json();
    if (!d?.sesion_id || !["presupuesto", "ot"].includes(d.tipo)) return Response.json({ ok: false, error: "tipo y sesion_id requeridos" }, { status: 400, headers: CORS });
    avisos = [];
    const doc = d.tipo === "presupuesto" ? await presupuesto(d) : await hojaOT(d);
    const path = d.tipo === "presupuesto" ? `presupuestos/${d.sesion_id}-v${Number(d.version) || 1}.pdf` : `ot/${d.numero_ot || d.sesion_id}.pdf`;
    const { error } = await sb.storage.from("documentos").upload(path, new Uint8Array(doc.output("arraybuffer")), { contentType: "application/pdf", upsert: true });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
    const { data: s } = await sb.storage.from("documentos").createSignedUrl(path, 7 * 86400);
    return Response.json({ ok: true, path, url: s?.signedUrl ?? null, avisos }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500, headers: CORS });
  }
});
