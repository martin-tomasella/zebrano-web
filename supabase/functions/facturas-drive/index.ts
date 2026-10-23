// facturas-drive — sube al Drive las facturas que todavía no tienen copia (por ejemplo, cargadas antes de conectar Google
// o cuando Drive falló). Body opcional: { factura_id }. Sin body, procesa todas las pendientes de archivo (máx. 20 por vez).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function token(): Promise<string> {
  const { data: t } = await sb.from("google_oauth_tokens").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!t?.refresh_token || !/auth\/drive( |$)/.test(String(t.scope))) throw new Error("Google Drive no está conectado con permiso de escritura");
  if (t.access_token && new Date(t.expires_at).getTime() > Date.now() + 60_000) return t.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_ID_de_Cliente") || Deno.env.get("GOOGLE_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_Secreto_de_Cliente") || Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
      refresh_token: t.refresh_token, grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error(`Google token ${r.status}: ${(await r.text()).slice(0, 150)}`);
  const n = await r.json();
  await sb.from("google_oauth_tokens").update({ access_token: n.access_token, expires_at: new Date(Date.now() + n.expires_in * 1000).toISOString() }).eq("id", t.id);
  return n.access_token;
}
async function carpetaAnio(tok: string, raiz: string, anio: string): Promise<string> {
  const q = encodeURIComponent(`'${raiz}' in parents and name = '${anio}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new Error(`Drive buscar carpeta ${r.status}: ${(await r.text()).slice(0, 150)}`);
  const id = (await r.json()).files?.[0]?.id;
  if (id) return id;
  const c = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: anio, mimeType: "application/vnd.google-apps.folder", parents: [raiz] }),
  });
  if (!c.ok) throw new Error(`Drive crear carpeta ${c.status}: ${(await c.text()).slice(0, 150)}`);
  return (await c.json()).id;
}

Deno.serve(async (req) => {
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { data: cfg } = await sb.from("zebrano_contexto").select("valor").eq("clave", "drive_facturas_folder").maybeSingle();
    const raiz = cfg?.valor as string;
    if (!raiz) return json({ ok: false, error: "Falta la carpeta de facturas" }, 400);
    let q = sb.from("facturas_compra").select("id,fecha,tipo_comprobante,punto_venta,numero,archivo_path,alertas,proveedores(nombre)").is("drive_file_id", null).neq("estado", "descartada").limit(20);
    if (body.factura_id) q = q.eq("id", body.factura_id);
    const { data: fs } = await q;
    const tok = await token();
    const out = [];
    for (const f of fs || []) {
      try {
        const { data: blob, error } = await sb.storage.from("facturas").download(f.archivo_path);
        if (error || !blob) throw new Error("archivo no encontrado en el bucket");
        const ext = f.archivo_path.split(".").pop()!.toLowerCase();
        const mime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        const prov = ((f as any).proveedores?.nombre || "Proveedor").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60);
        const nombre = `${f.fecha || "sin-fecha"} ${prov} ${f.tipo_comprobante || ""} ${f.punto_venta || ""}-${f.numero || ""}.${ext}`.replace(/\s+/g, " ");
        const carpeta = await carpetaAnio(tok, raiz, (f.fecha || new Date().toISOString()).slice(0, 4));
        const lim = "zbr" + crypto.randomUUID(), enc = new TextEncoder();
        const ini = enc.encode(`--${lim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nombre, parents: [carpeta] })}\r\n--${lim}\r\nContent-Type: ${mime}\r\n\r\n`);
        const bytes = new Uint8Array(await blob.arrayBuffer()), fin = enc.encode(`\r\n--${lim}--`);
        const cuerpo = new Uint8Array(ini.length + bytes.length + fin.length);
        cuerpo.set(ini); cuerpo.set(bytes, ini.length); cuerpo.set(fin, ini.length + bytes.length);
        const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink", {
          method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": `multipart/related; boundary=${lim}` }, body: cuerpo,
        });
        if (!r.ok) throw new Error(`Drive subir ${r.status}: ${(await r.text()).slice(0, 150)}`);
        const d = await r.json();
        const alertas = (f.alertas || []).filter((a: string) => !a.startsWith("No se pudo guardar en Drive"));
        await sb.from("facturas_compra").update({ drive_file_id: d.id, drive_url: d.webViewLink, alertas }).eq("id", f.id);
        out.push({ id: f.id, nombre, ok: true });
      } catch (e) { out.push({ id: f.id, ok: false, error: (e as Error).message }); }
    }
    return json({ ok: true, procesadas: out.length, resultados: out });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
