// @ts-nocheck
// Acceso, topes de uso y registro de consumo del cotizador (01/11/2026).
// - Empleado con sesión, x-kb-secret (public.kb_sync_secret()) o service role => acceso completo.
// - Cualquier otro llamado es anónimo: canal externo forzado, sin aprobar cotizaciones y con topes.
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const num = (k, d) => Number(Deno.env.get(k) ?? d) || d;
export const TOPES = {
  largoMensaje: num("COTIZ_EXT_MAX_CHARS", 1500),
  imagenes: num("COTIZ_EXT_MAX_IMAGENES", 3),
  mensajesSesion: num("COTIZ_EXT_MSGS_SESION", 20),
  sesionesIpDia: num("COTIZ_EXT_SESIONES_IP_DIA", 3),
  llamadasDia: num("COTIZ_EXT_LLAMADAS_DIA", 150),
  rendersSesion: num("COTIZ_EXT_RENDERS_SESION", 2),
};
export const MSG_TOPE = "Por hoy llegamos al límite de consultas automáticas. Dejanos tu nombre y un teléfono o email, y el equipo de Zebrano te arma el presupuesto a medida.";

export async function autorizado(req, sb) {
  const tok = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (tok && tok === SERVICE_KEY) return true;
  const llave = req.headers.get("x-kb-secret");
  if (llave) { const { data } = await sb.rpc("kb_sync_secret"); return !!data && llave === data; }
  if (!tok) return false;
  const { data: u } = await sb.auth.getUser(tok);
  if (!u?.user) return false;
  const { data: emp } = await sb.from("empleados").select("activo").eq("auth_user_id", u.user.id).maybeSingle();
  return !!emp && emp.activo !== false;
}

export async function ipHash(req) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|zebrano"));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const hace24h = () => new Date(Date.now() - 86400000).toISOString();

// Devuelve null si puede seguir, o el motivo del tope.
// ponytail: conteos sin lock; dos pedidos simultáneos pueden pasar el tope por 1. Suficiente para frenar abuso.
export async function topeExterno(sb, { sid, ip, mensaje, imagenes }) {
  if (String(mensaje ?? "").length > TOPES.largoMensaje) return `El mensaje es muy largo (máximo ${TOPES.largoMensaje} caracteres). Resumilo o dejanos tu contacto y te escribimos.`;
  if ((imagenes ?? []).length > TOPES.imagenes) return `Podés adjuntar hasta ${TOPES.imagenes} imágenes por mensaje.`;
  const desde = hace24h();
  const { count: total } = await sb.from("ia_consumo").select("id", { count: "exact", head: true }).eq("canal", "externo").gte("created_at", desde);
  if ((total ?? 0) >= TOPES.llamadasDia) return MSG_TOPE;
  if (sid) {
    const { count: msgs } = await sb.from("cotizacion_mensajes").select("id", { count: "exact", head: true }).eq("sesion_id", sid).eq("rol", "user");
    if ((msgs ?? 0) >= TOPES.mensajesSesion) return MSG_TOPE;
  }
  const { data: propias } = await sb.from("ia_consumo").select("sesion_id").eq("canal", "externo").eq("ip_hash", ip).gte("created_at", desde).limit(500);
  const sesiones = new Set((propias ?? []).map((r) => r.sesion_id).filter(Boolean));
  if (!(sid && sesiones.has(sid)) && sesiones.size >= TOPES.sesionesIpDia) return MSG_TOPE;
  return null;
}

export async function rendersDeSesion(sb, sid) {
  const { data } = await sb.from("ia_consumo").select("renders").eq("sesion_id", sid).gt("renders", 0);
  return (data ?? []).reduce((s, r) => s + (r.renders || 0), 0);
}

export async function registrar(sb, fila) {
  try { await sb.from("ia_consumo").insert({ funcion: "zebrano-cotizador", ...fila }); } catch { /* el registro nunca corta la respuesta */ }
}
