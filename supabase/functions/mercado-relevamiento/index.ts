// mercado-relevamiento — actualiza precios de la competencia en Mercado Libre (API oficial).
// GET  ?conectar=1  → inicia la autorización con la cuenta de Mercado Libre (una sola vez).
// GET  ?code=...    → vuelta de Mercado Libre: guarda el token.
// POST {}           → relevamiento: para cada producto de catálogo guarda precio ganador, mínimo y cantidad de vendedores.
// Lo dispara pg_cron el 1er y 3er lunes de cada mes. Credenciales: secrets ML_CLIENT_ID / ML_CLIENT_SECRET.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const CLIENT_ID = Deno.env.get("ML_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET") || "";
const REDIRECT = `${SUPABASE_URL}/functions/v1/mercado-relevamiento`;
const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const texto = (t: string) => new Response(t, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function estado(v: Record<string, unknown>) {
  await sb.from("zebrano_contexto").upsert({ clave: "mercado_relevamiento", valor: { ...v, fecha: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "clave" });
}

async function tokenML(): Promise<string> {
  const { data: t } = await sb.from("ml_oauth_tokens").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!t) throw new Error("Mercado Libre no está conectado");
  if (new Date(t.expires_at).getTime() > Date.now() + 120_000) return t.access_token;
  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: t.refresh_token }),
  });
  if (!r.ok) throw new Error(`Renovar token ML ${r.status}: ${(await r.text()).slice(0, 150)}`);
  const n = await r.json();
  // El refresh token de ML es de un solo uso: se guarda el nuevo.
  await sb.from("ml_oauth_tokens").update({ access_token: n.access_token, refresh_token: n.refresh_token, expires_at: new Date(Date.now() + n.expires_in * 1000).toISOString() }).eq("id", t.id);
  return n.access_token;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    if (!CLIENT_ID || !CLIENT_SECRET) return texto("Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en los secrets de Supabase.");
    if (url.searchParams.get("conectar")) {
      const a = new URL("https://auth.mercadolibre.com.ar/authorization");
      a.searchParams.set("response_type", "code"); a.searchParams.set("client_id", CLIENT_ID); a.searchParams.set("redirect_uri", REDIRECT);
      return Response.redirect(a.toString(), 302);
    }
    const code = url.searchParams.get("code");
    if (!code) return texto("Abrí esta dirección con ?conectar=1 para vincular Mercado Libre.");
    const r = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT }),
    });
    if (!r.ok) return texto(`Error obteniendo token: ${(await r.text()).slice(0, 300)}`);
    const t = await r.json();
    const { data: nuevo, error } = await sb.from("ml_oauth_tokens").insert({ access_token: t.access_token, refresh_token: t.refresh_token, user_id: String(t.user_id ?? ""), expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() }).select("id").single();
    if (error) return texto(`Error guardando token: ${error.message}`);
    await sb.from("ml_oauth_tokens").delete().neq("id", nuevo.id);
    return texto("Mercado Libre conectado ✓\n\nEl relevamiento de precios corre solo el 1er y 3er lunes de cada mes. Podés cerrar esta ventana.");
  }

  // POST: relevamiento (solo pg_cron o el botón de la web vía rpc, con la clave interna)
  const { data: autorizado } = await sb.rpc("cron_key_ok", { k: req.headers.get("x-cron-key") || "" });
  if (!autorizado) return json({ ok: false, error: "no autorizado" }, 401);
  try {
    const tok = await tokenML();
    const H = { Authorization: `Bearer ${tok}` };
    const { data: prods } = await sb.from("mercado_productos").select("id,ext_id").eq("activo", true).like("ext_id", "MLA%");
    const hoy = new Date().toISOString().slice(0, 10);
    let ok = 0; const errores: string[] = [];
    for (const p of prods || []) {
      try {
        const [rp, ri] = await Promise.all([
          fetch(`https://api.mercadolibre.com/products/${p.ext_id}`, { headers: H }),
          fetch(`https://api.mercadolibre.com/products/${p.ext_id}/items?limit=50`, { headers: H }),
        ]);
        if (rp.status === 404) { await sb.from("mercado_productos").update({ activo: false, notas: `Publicación de catálogo inexistente (${hoy})` }).eq("id", p.id); continue; }
        if (!rp.ok) throw new Error(`products ${rp.status}`);
        const prod = await rp.json();
        const items = ri.ok ? ((await ri.json()).results || []) : [];
        const precios = items.map((i: { price: number }) => Number(i.price)).filter((x: number) => x > 0);
        const precio = Number(prod.buy_box_winner?.price) || (precios.length ? Math.min(...precios) : null);
        if (!precio) { errores.push(`${p.ext_id}: sin precio activo`); continue; }
        await sb.from("mercado_precios").delete().eq("producto_id", p.id).eq("fecha", hoy).eq("fuente", "ml_api");
        await sb.from("mercado_precios").insert({ producto_id: p.id, fecha: hoy, precio, precio_min_vendedores: precios.length ? Math.min(...precios) : null, precio_max_vendedores: precios.length ? Math.max(...precios) : null, vendedores: items.length || null, fuente: "ml_api" });
        ok++;
      } catch (e) { errores.push(`${p.ext_id}: ${(e as Error).message}`); }
    }
    await estado({ ok: true, actualizados: ok, total: prods?.length || 0, errores: errores.slice(0, 20) });
    return json({ ok: true, actualizados: ok, errores });
  } catch (e) {
    await estado({ ok: false, error: (e as Error).message });
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
