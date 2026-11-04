// @ts-nocheck
// zebrano-documentos (03/11/2026): arma el presupuesto para el cliente y la hoja de taller de la OT, en HTML imprimible
// (se guarda como PDF desde el navegador), los sube al bucket privado "documentos" y devuelve un link firmado.
// Lo llama el cotizador con el service role; un empleado con sesión también puede pedirlo.
// ponytail: HTML y no PDF nativo; si hace falta PDF real, renderizarlo con un servicio headless.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Content-Type": "application/json" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const cm = (mm) => (Number(mm) / 10).toLocaleString("es-AR") + " cm";

async function autorizado(req, sb) {
  const tok = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!tok) return false;
  if (tok === SERVICE) return true;
  const { data: u } = await sb.auth.getUser(tok);
  if (!u?.user) return false;
  const { data: e } = await sb.from("empleados").select("activo").eq("auth_user_id", u.user.id).maybeSingle();
  return !!e && e.activo !== false;
}

const CSS = `body{font-family:Arial,Helvetica,sans-serif;color:#222;max-width:820px;margin:24px auto;padding:0 16px;font-size:13px}
h1{font-size:20px;margin:0;letter-spacing:2px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #5b4636;color:#5b4636}
.cab{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5b4636;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin:6px 0}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#f3eee9}td.n{text-align:right;white-space:nowrap}.tot{font-size:16px;font-weight:bold;text-align:right;margin:8px 0}
img{max-width:100%;border:1px solid #ddd}.chico{font-size:11px;color:#555}ul{margin:4px 0 4px 18px;padding:0}
@media print{body{margin:0}.noprint{display:none}}`;

function moduloTexto(m) {
  const p = [];
  if (Number(m.puertas)) p.push(`${m.puertas} puerta${m.puertas > 1 ? "s" : ""}`);
  if (Number(m.cajones)) p.push(`${m.cajones} cajón${m.cajones > 1 ? "es" : ""}`);
  if (Number(m.estantes)) p.push(`${m.estantes} estante${m.estantes > 1 ? "s" : ""}`);
  const n = Number(m.cantidad) > 1 ? `${m.cantidad} x ` : "";
  return `${n}${m.nombre} de ${cm(m.ancho_mm)} de frente x ${cm(m.alto_mm)} de alto x ${cm(m.prof_mm)} de profundidad${p.length ? ", con " + p.join(", ") : ""}.`;
}

function presupuesto(d) {
  const mods = d.modulos ?? [];
  const mat = [...new Set(mods.map((m) => m.material).filter(Boolean))].join(", ") || "Melamina 18 mm";
  const filas = [[1, 1, d.titulo, d.precio_base]];
  if (Number(d.adicional) > 0) filas.push([2, 1, `Adicional por color (${esc(d.adicional_detalle ?? "")})`, d.adicional]);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto ${esc(d.numero)}</title><style>${CSS}</style></head><body>
<div class="cab"><div><h1>ZEBRANO</h1><div class="chico">Carpintería a medida</div></div>
<div><b>Cotización:</b> ${esc(d.numero)}<br><b>Fecha:</b> ${esc(d.fecha)}<br><b>Cliente:</b> ${esc(d.cliente || "-")}<br><b>Tel:</b> ${esc(d.telefono || "-")}</div></div>
${d.render_url ? `<h2>Imagen de referencia</h2><img src="${esc(d.render_url)}" alt="render">` : ""}
<h2>Detalle</h2><table><tr><th>Item</th><th>Cant.</th><th>Descripción</th><th>Total</th></tr>
${filas.map(([i, c, t, v]) => `<tr><td>${i}</td><td>${c}</td><td>${esc(t)}</td><td class="n">${$(v)}</td></tr>`).join("")}</table>
<p><b>Descripción:</b></p><ul>${mods.map((m) => `<li>${esc(moduloTexto(m))}</li>`).join("")}</ul>
<p><b>Materiales:</b> ${esc(mat)}. Cantos al tono aplicados a máquina. Fondo fibro 3 mm blanco. ${mods.some((m) => m.frentes === "embutidos") ? "Frentes embutidos." : "Frentes superpuestos."} Correderas telescópicas y bisagras cazoleta.</p>
<div class="tot">Total efectivo: ${$(d.total)}</div>
<h2>Condiciones</h2><ul class="chico">
<li>El presupuesto no incluye IVA.</li><li>Validez de la oferta: 7 días.</li>
<li>Condiciones de fabricación: se deberán relevar las medidas en obra al momento de la contratación.</li>
<li>Condiciones de contratación: anticipo 50%. Saldos contra entregas parciales/final.</li>
<li>Condiciones de pago: valor en efectivo, sin IVA. Por medios electrónicos +21% (MercadoPago, transferencia bancaria).</li>
<li>El total debe estar cancelado al momento de la entrega; de lo contrario se reprogramará la instalación.</li>
<li>Una vez señado el presupuesto, el plazo para cambios de diseño o materialidad es de 7 días corridos.</li>
<li>Plazo de entrega: 10/25 días hábiles según terminaciones elegidas.</li>
<li>Forma y lugar de entrega: en el domicilio indicado por el cliente dentro de CABA. Fuera de esa área se notificará con anticipación el costo adicional.</li></ul>
<p>Sin otro particular, saluda a ud. muy atentamente.<br><br><b>Rocío Tomasella</b><br>Proyectos</p></body></html>`;
}

function hojaOT(d) {
  const porMod = {};
  for (const p of d.piezas ?? []) (porMod[p.modulo_nombre || p.modulo || "General"] ??= []).push(p);
  const canto = (p) => [p.con_canto_largo ?? p.canto_largo ? "L" : "", p.con_canto_ancho ?? p.canto_ancho ? "A" : ""].filter(Boolean).join("+") || "-";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(d.numero_ot)}</title><style>${CSS}</style></head><body>
<div class="cab"><div><h1>ORDEN DE FABRICACIÓN</h1><div class="chico">${esc(d.numero_ot)} · PPTO ${esc(d.presupuesto)}</div></div>
<div><b>Cliente:</b> ${esc(d.cliente || "-")}<br><b>Tel:</b> ${esc(d.telefono || "-")}<br><b>Fecha:</b> ${esc(d.fecha)}<br><b>Tipo:</b> ${esc(d.tipo_trabajo || "-")}</div></div>
${d.render_url ? `<h2>Modelo</h2><img src="${esc(d.render_url)}" alt="render">` : ""}
<h2>Módulos</h2><ul>${(d.modulos ?? []).map((m) => `<li>${esc(moduloTexto(m))} ${esc(m.material ?? "")}${m.frentes ? " · frentes " + esc(m.frentes) : ""}${Number(m.zocalo_mm) ? ` · zócalo ${m.zocalo_mm} mm` : ""}${Number(m.patas) ? ` · ${m.patas} patas` : ""}</li>`).join("") || "<li>Ver despiece</li>"}</ul>
<h2>Herrajes</h2><table><tr><th>Herraje</th><th>Cant.</th></tr>${(d.herrajes ?? []).map((h) => `<tr><td>${esc(h.nombre)}</td><td class="n">${esc(h.cantidad)}</td></tr>`).join("")}</table>
<h2>Tiempos estimados</h2><table><tr><th>Etapa</th><th>Horas</th><th>Personas</th></tr>${(d.mano_obra ?? []).map((m) => `<tr><td>${esc(m.etapa ?? m.operacion)}</td><td class="n">${esc(m.horas_estimadas ?? m.horas)}</td><td class="n">${esc(m.operarios ?? m.personas)}</td></tr>`).join("")}</table>
<h2>Despiece</h2>${Object.entries(porMod).map(([mod, ps]) => `<p><b>${esc(mod)}</b></p><table><tr><th>Pieza</th><th>Cant.</th><th>Largo</th><th>Ancho</th><th>Material</th><th>Canto</th></tr>
${ps.map((p) => `<tr><td>${esc(p.nombre_pieza ?? p.nombre)}</td><td class="n">${esc(p.cantidad)}</td><td class="n">${esc(p.largo_mm)}</td><td class="n">${esc(p.ancho_mm)}</td><td>${esc(p.material)}</td><td>${canto(p)}</td></tr>`).join("")}</table>`).join("")}
<p class="chico">Despiece calculado con las reglas del taller. Verificar medidas en obra antes de cortar.</p></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", SERVICE);
  if (!(await autorizado(req, sb))) return Response.json({ ok: false, error: "no autorizado" }, { status: 401, headers: CORS });
  try {
    const d = await req.json();
    if (!d?.sesion_id || !["presupuesto", "ot"].includes(d.tipo)) return Response.json({ ok: false, error: "tipo y sesion_id requeridos" }, { status: 400, headers: CORS });
    const html = d.tipo === "presupuesto" ? presupuesto(d) : hojaOT(d);
    const path = d.tipo === "presupuesto" ? `presupuestos/${d.sesion_id}-v${Number(d.version) || 1}.html` : `ot/${d.numero_ot || d.sesion_id}.html`;
    const { error } = await sb.storage.from("documentos").upload(path, new TextEncoder().encode(html), { contentType: "text/html; charset=utf-8", upsert: true });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
    const { data: s } = await sb.storage.from("documentos").createSignedUrl(path, 7 * 86400);
    return Response.json({ ok: true, path, url: s?.signedUrl ?? null }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500, headers: CORS });
  }
});
