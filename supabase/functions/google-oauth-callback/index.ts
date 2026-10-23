// google-oauth-callback — conecta la cuenta de Google del negocio.
// Abrir esta URL en el navegador inicia la autorización; Google vuelve acá con el código y se guardan los tokens.
// Permisos: Google Fotos (lectura) + Google Drive (lectura y escritura, para archivar facturas en la carpeta del año).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GOOGLE_ID_de_Cliente") || Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_Secreto_de_Cliente") || Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// Supabase sirve las funciones como texto plano (no permite páginas HTML en su dominio): se responde texto legible.
const HTML = (body: string) => new Response(
  body.replace(/<br>/g, "\n").replace(/<\/(h2|p)>/g, "\n\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim(),
  { headers: { "Content-Type": "text/plain; charset=utf-8" } },
);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (url.searchParams.get("check")) return Response.json({ client_id: !!CLIENT_ID, client_secret: !!CLIENT_SECRET });
  if (!CLIENT_ID || !CLIENT_SECRET) return HTML(`<h2>Falta configuración</h2><p>Faltan las credenciales de Google en los secrets de Supabase.</p>`);
  if (error) return HTML(`<h2>Error de autorización</h2><p>${esc(error)}</p>`);

  if (!code) {
    const a = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    a.searchParams.set("client_id", CLIENT_ID);
    a.searchParams.set("redirect_uri", REDIRECT_URI);
    a.searchParams.set("response_type", "code");
    a.searchParams.set("scope", [
      "https://www.googleapis.com/auth/photoslibrary.readonly",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "));
    a.searchParams.set("access_type", "offline");
    a.searchParams.set("prompt", "consent select_account");
    return Response.redirect(a.toString(), 302);
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
  });
  if (!r.ok) return HTML(`<h2>Error obteniendo token</h2><p>${esc((await r.text()).slice(0, 400))}</p>`);
  const t = await r.json();
  if (!t.refresh_token) return HTML(`<h2>Falta el permiso permanente</h2><p>Google no devolvió el token de renovación. Quitá el acceso de la app en tu cuenta de Google y volvé a abrir este enlace.</p>`);

  let email = "";
  try {
    const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } });
    email = (await u.json()).email || "";
  } catch (_) { /* opcional */ }

  const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Se guarda el token nuevo primero; recién después se quitan los anteriores (si falla el guardado, el viejo sigue sirviendo).
  const { data: nuevo, error: e1 } = await sb.from("google_oauth_tokens").insert({
    access_token: t.access_token, refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(), scope: t.scope, token_type: email || t.token_type,
  }).select("id").single();
  if (e1) return HTML(`<h2>Error guardando token</h2><p>${esc(e1.message)}</p>`);
  await sb.from("google_oauth_tokens").delete().neq("id", nuevo.id);

  return HTML(`<h2>Google conectado ✓</h2><p>${email ? `Cuenta: <b>${esc(email)}</b><br>` : ""}Permisos: Drive y Fotos.<br>Las facturas que cargues en Compras se van a archivar en tu carpeta de Drive, dentro del año.</p><p style="color:#999;font-size:12px">Podés cerrar esta ventana.</p>`);
});
