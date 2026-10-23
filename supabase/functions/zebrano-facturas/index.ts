// zebrano-facturas — lee una factura de proveedor (PDF digital, escaneo o foto)
// y la deja en facturas_compra como "pendiente" para revisión humana.
// Entrada: { archivo_path } (archivo ya subido al bucket privado "facturas") o { staging_id }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODELOS = [Deno.env.get("FACTURAS_MODEL") || "claude-haiku-5-5", "claude-haiku-4-5"];
const OAI = Deno.env.get("OPENAI_API_KEY") || "";
const OAI_MODELOS = [Deno.env.get("FACTURAS_OPENAI_MODEL") || "gpt-4.1-mini", "gpt-4o-mini"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const num = { type: ["number", "null"] };
const str = { type: ["string", "null"] };
const TOOL = {
  name: "registrar_factura",
  description: "Registra todos los datos de la factura de compra tal como figuran en el comprobante.",
  input_schema: {
    type: "object",
    required: ["proveedor", "comprobante", "comprador", "items", "totales"],
    properties: {
      proveedor: { type: "object", properties: { nombre: str, cuit: str, condicion_iva: str, direccion: str, telefono: str, email: str, web: str } },
      comprobante: { type: "object", properties: {
        tipo: { type: ["string", "null"], description: "A, B, C, M, remito o ticket" },
        punto_venta: str, numero: str, fecha: { type: ["string", "null"], description: "YYYY-MM-DD" },
        cae: str, cae_vto: { type: ["string", "null"], description: "YYYY-MM-DD" },
        condicion_pago: str, remito: str, moneda: { type: ["string", "null"], description: "ARS o USD" } } },
      comprador: { type: "object", properties: { nombre: str, cuit: str, direccion: str } },
      items: { type: "array", items: { type: "object", required: ["descripcion", "cantidad"], properties: {
        codigo: str, descripcion: { type: "string" }, cantidad: { type: "number" },
        unidad: { type: ["string", "null"], description: "unidad, metro, hoja, rollo, kg, etc. si se infiere" },
        precio_lista_unit: { ...num, description: "precio unitario antes del descuento, sin IVA" },
        descuento_pct: num,
        precio_neto_unit: { ...num, description: "precio unitario después del descuento, sin IVA" },
        iva_pct: num, importe_neto: { ...num, description: "importe del renglón sin IVA" },
        insumo_id: { type: ["string", "null"], description: "id del insumo del catálogo que corresponde, o null si ninguno es el mismo producto" },
        categoria: { type: ["string", "null"], description: "placa, canto, bisagra, corredera, tirador, piston, perfil, placard, barral, accesorio, ferreteria, pintura u otros" },
      } } },
      totales: { type: "object", properties: {
        neto_gravado: num, iva_21: num, iva_105: num,
        percepciones: { ...num, description: "suma de TODAS las percepciones y retenciones impresas (IIBB de cualquier provincia, IVA, ganancias)" },
        otros_impuestos: num, total: num } },
      observaciones: { type: ["string", "null"], description: "sellos (pagado), partes ilegibles, dudas de lectura" },
    },
  },
};

async function leer(b64: string, mime: string, catalogo: string) {
  const archivo = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: mime, data: b64 } };
  const prompt = `Sos el administrativo de compras de Zebrano, carpintería de muebles a medida en Buenos Aires.
Leé esta factura de proveedor (Argentina) y registrala con la herramienta. Reglas:
- Copiá los datos exactamente como figuran; números con punto decimal (1.272.532,70 -> 1272532.70).
- Si hay % de descuento por renglón: precio_lista_unit es el precio unitario impreso y precio_neto_unit = precio_lista_unit * (1 - descuento/100).
- Si no hay descuento: precio_neto_unit = precio unitario impreso.
- En factura A los precios e importes de los renglones YA son netos sin IVA: NO les saques IVA. Solo en factura B/C (precios con IVA incluido) dividí por 1,21.
- El código del artículo del proveedor va en "codigo". No confundas el número de despacho de aduana con el código.
- insumo_id: elegí del catálogo el insumo que sea el MISMO producto (misma medida y tipo). Si dudás, null.
- Percepciones: sumá todas las percepciones impresas (ej. "Percepción IIBB", "Perc. IIBB CABA/BA", "Percepción IVA") en totales.percepciones. Verificá que neto + IVA + percepciones + otros = total.
- categoria: clasificá cada renglón (placa, canto, bisagra, corredera, tirador, piston, perfil, placard, barral, accesorio, ferreteria, pintura, otros).
- Lo que no figure o no se lea, null. Anotá dudas en observaciones (no repitas datos que ya registraste).

Catálogo de insumos (id | nombre | categoría | unidad):
${catalogo}`;
  let err = "";
  for (const model of MODELOS) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, max_tokens: 8000, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: [archivo, { type: "text", text: prompt }] }],
      }),
    });
    if (!r.ok) { err = `${model}: ${r.status} ${await r.text()}`; if (r.status === 404 || r.status === 400) continue; break; }
    const d = await r.json();
    const t = d.content?.find((c: any) => c.type === "tool_use");
    if (t) return { datos: t.input, model, uso: d.usage };
    err = `${model}: sin respuesta estructurada`;
  }
  // Respaldo: OpenAI (mismo esquema vía function calling) si Anthropic no está disponible
  if (OAI) {
    for (const model of OAI_MODELOS) {
      const archivoOai = mime === "application/pdf"
        ? { type: "file", file: { filename: "factura.pdf", file_data: `data:application/pdf;base64,${b64}` } }
        : { type: "image_url", image_url: { url: `data:${mime};base64,${b64}`, detail: "high" } };
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${OAI}` },
        body: JSON.stringify({
          model, max_completion_tokens: 8000,
          tools: [{ type: "function", function: { name: TOOL.name, description: TOOL.description, parameters: TOOL.input_schema } }],
          tool_choice: { type: "function", function: { name: TOOL.name } },
          messages: [{ role: "user", content: [archivoOai, { type: "text", text: prompt }] }],
        }),
      });
      if (!r.ok) { err += ` | ${model}: ${r.status} ${(await r.text()).slice(0, 300)}`; continue; }
      const d = await r.json();
      const call = d.choices?.[0]?.message?.tool_calls?.[0];
      if (call) return { datos: JSON.parse(call.function.arguments), model, uso: d.usage };
      err += ` | ${model}: sin respuesta estructurada`;
    }
  }
  throw new Error("No se pudo leer la factura — " + err);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Dólar BCRA (minorista promedio vendedor, serie 4) vigente el día de la compra; lo carga tipo-cambio-bcra a diario.
async function tcDe(fecha: string | null): Promise<number | null> {
  const { data } = await sb.rpc("tc_usd", { p_fecha: fecha || new Date().toISOString().slice(0, 10) });
  return data != null ? Number(data) : null;
}
// ── Google Drive: archiva el original en <carpeta facturas>/<año>/ con un nombre ordenado ──
async function driveToken(): Promise<string | null> {
  const { data: t } = await sb.from("google_oauth_tokens").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!t?.refresh_token || !String(t.scope || "").includes("auth/drive ") && !String(t.scope || "").endsWith("auth/drive")) return null;
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
async function driveCarpetaAnio(tok: string, raiz: string, anio: string): Promise<string> {
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
async function archivarEnDrive(bytes: Uint8Array, mime: string, nombre: string, fecha: string | null) {
  const raiz = (await ctx("drive_facturas_folder")) as string | undefined;
  if (!raiz) return null;
  const tok = await driveToken();
  if (!tok) throw new Error("Google Drive no está conectado con permiso de escritura");
  const carpeta = await driveCarpetaAnio(tok, raiz, (fecha || new Date().toISOString()).slice(0, 4));
  const limite = "zbr" + crypto.randomUUID();
  const meta = JSON.stringify({ name: nombre, parents: [carpeta] });
  const enc = new TextEncoder();
  const ini = enc.encode(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`);
  const fin = enc.encode(`\r\n--${limite}--`);
  const cuerpo = new Uint8Array(ini.length + bytes.length + fin.length);
  cuerpo.set(ini); cuerpo.set(bytes, ini.length); cuerpo.set(fin, ini.length + bytes.length);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink", {
    method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": `multipart/related; boundary=${limite}` }, body: cuerpo,
  });
  if (!r.ok) throw new Error(`Drive subir ${r.status}: ${(await r.text()).slice(0, 150)}`);
  return await r.json() as { id: string; webViewLink: string };
}
async function ctx(clave: string) {
  const { data } = await sb.from("zebrano_contexto").select("valor").eq("clave", clave).maybeSingle();
  return data?.valor;
}
const cuitLimpio = (c?: string | null) => (c || "").replace(/\D/g, "") || null;
const fmtCuit = (c: string | null) => c && c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json();
    let archivo_path: string = body.archivo_path;
    let userId: string | null = null;

    if (body.staging_id) {
      // Carga programática: el archivo viene de facturas_staging (solo escribible por service_role)
      const { data: st } = await sb.from("facturas_staging").select("*").eq("id", body.staging_id).maybeSingle();
      if (!st) return json({ ok: false, error: "staging_id inexistente" }, 404);
      if (st.archivo_path) archivo_path = st.archivo_path; // ya está en el bucket (reproceso / repositorio)
      else {
        const ext = st.filename.split(".").pop()!.toLowerCase();
        const bytes = Uint8Array.from(atob(st.base64), (ch) => ch.charCodeAt(0));
        archivo_path = `carga/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${st.filename}`;
        const { error: eUp } = await sb.storage.from("facturas").upload(archivo_path, bytes, {
          contentType: ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`,
        });
        if (eUp) throw eUp;
        await sb.from("facturas_staging").update({ archivo_path, base64: "" }).eq("id", st.id);
      }
    } else {
      // Carga desde el ERP: exige un usuario logueado (la anon key sola no alcanza)
      const token = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
      const { data: u } = await sb.auth.getUser(token);
      if (!u?.user) return json({ ok: false, error: "Iniciá sesión para cargar facturas" }, 401);
      userId = u.user.id;
    }
    if (!archivo_path) return json({ ok: false, error: "Falta archivo_path" }, 400);

    const { data: blob, error: eDl } = await sb.storage.from("facturas").download(archivo_path);
    if (eDl || !blob) return json({ ok: false, error: "No se encontró el archivo en el bucket facturas" }, 404);
    const ext = archivo_path.split(".").pop()!.toLowerCase();
    const mime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const bytesArchivo = new Uint8Array(await blob.arrayBuffer());
    const b64 = encodeBase64(bytesArchivo);

    const { data: ins } = await sb.from("insumos").select("id,nombre,categoria,unidad").eq("activo", true).order("categoria");
    const catalogo = (ins || []).map((i) => `${i.id} | ${i.nombre} | ${i.categoria} | ${i.unidad}`).join("\n");

    const { datos: d, model, uso } = await leer(b64, mime, catalogo);
    const alertas: string[] = [];

    // Proveedor: por CUIT; si no existe, se crea
    const cuit = cuitLimpio(d.proveedor?.cuit);
    let proveedorId: string | null = null;
    if (cuit) {
      const { data: p } = await sb.from("proveedores").select("id").eq("cuit", fmtCuit(cuit)).maybeSingle();
      proveedorId = p?.id ?? null;
    }
    if (!proveedorId && d.proveedor?.nombre) {
      const { data: p } = await sb.from("proveedores").select("id").ilike("nombre", d.proveedor.nombre).maybeSingle();
      proveedorId = p?.id ?? null;
    }
    if (!proveedorId && d.proveedor?.nombre) {
      const { data: p, error } = await sb.from("proveedores").insert({
        nombre: d.proveedor.nombre, cuit: fmtCuit(cuit), condicion_iva: d.proveedor.condicion_iva,
        direccion: d.proveedor.direccion, telefono: d.proveedor.telefono, email: d.proveedor.email, web: d.proveedor.web,
        notas: "Creado al leer una factura", activo: true,
      }).select("id").single();
      if (error) throw error;
      proveedorId = p.id;
      alertas.push(`Proveedor nuevo: ${d.proveedor.nombre}`);
    }

    // ¿A nombre de quién? Zebrano o el cliente (compra por cuenta del cliente)
    const { data: ctx } = await sb.from("zebrano_contexto").select("valor").eq("clave", "cuit_zebrano").maybeSingle();
    const cuitZ = cuitLimpio(ctx?.valor as string);
    const compCuit = cuitLimpio(d.comprador?.cuit);
    const aNombre = (compCuit && cuitZ && compCuit === cuitZ) || /zebrano/i.test(d.comprador?.nombre || "") ? "zebrano" : "cliente";

    // Duplicado
    const c = d.comprobante || {};
    if (proveedorId && c.numero) {
      const { data: dup } = await sb.from("facturas_compra").select("id,estado").eq("proveedor_id", proveedorId)
        .eq("numero", c.numero).eq("punto_venta", c.punto_venta ?? "").neq("estado", "descartada").maybeSingle();
      if (dup) return json({ ok: false, duplicada: true, factura_id: dup.id, error: "Esa factura ya está cargada" }, 409);
    }

    // Controles aritméticos
    const items = (d.items || []).map((it: any, i: number) => {
      const neto = it.precio_neto_unit ?? (it.precio_lista_unit != null ? it.precio_lista_unit * (1 - (it.descuento_pct || 0) / 100) : null);
      const imp = it.importe_neto ?? (neto != null ? neto * it.cantidad : null);
      if (neto != null && imp != null && Math.abs(neto * it.cantidad - imp) > Math.max(1, imp * 0.005))
        alertas.push(`Renglón ${i + 1}: cantidad × precio no da el importe`);
      const insumoOk = (ins || []).some((x) => x.id === it.insumo_id);
      return {
        orden: i + 1, codigo_proveedor: it.codigo, descripcion: it.descripcion, cantidad: it.cantidad, unidad: it.unidad,
        precio_lista_unit: it.precio_lista_unit, descuento_pct: it.descuento_pct ?? 0,
        precio_neto_unit: neto != null ? r2(neto) : null, iva_pct: it.iva_pct ?? 21,
        importe_neto: imp != null ? r2(imp) : null, insumo_id: insumoOk ? it.insumo_id : null,
      };
    });
    // Código ya conocido de este proveedor manda sobre la sugerencia
    if (proveedorId) {
      const cods = items.map((i: any) => i.codigo_proveedor).filter(Boolean);
      if (cods.length) {
        const { data: map } = await sb.from("insumo_codigos").select("codigo,insumo_id").eq("proveedor_id", proveedorId).in("codigo", cods);
        for (const m of map || []) for (const it of items) if (it.codigo_proveedor === m.codigo) it.insumo_id = m.insumo_id;
      }
    }
    // Renglones sin insumo: se busca por nombre y, si no existe, se crea con el código del proveedor
    const creados: string[] = [];
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (it.insumo_id || !it.descripcion) continue;
      const nombre = String(it.descripcion).replace(/\s+/g, " ").trim().slice(0, 200);
      let { data: ex } = await sb.from("insumos").select("id").ilike("nombre", nombre).maybeSingle();
      if (!ex) {
        const ins = await sb.from("insumos").insert({
          nombre, categoria: (d.items?.[k]?.categoria || "otros").toLowerCase(), unidad: it.unidad || "unidad",
          precio_lista: it.precio_lista_unit ?? it.precio_neto_unit, descuento_pct: it.descuento_pct || 0,
          proveedor_id: proveedorId, origen: "factura",
        }).select("id").single();
        if (ins.error) ({ data: ex } = await sb.from("insumos").select("id").ilike("nombre", nombre).maybeSingle());
        else { ex = ins.data; creados.push(nombre); }
      }
      if (ex) {
        it.insumo_id = ex.id;
        if (proveedorId && it.codigo_proveedor)
          await sb.from("insumo_codigos").upsert({ proveedor_id: proveedorId, codigo: it.codigo_proveedor, insumo_id: ex.id }, { onConflict: "proveedor_id,codigo" });
      }
    }
    if (creados.length) alertas.push(`Insumo(s) nuevo(s) creados en el catálogo: ${creados.join("; ")}`);
    const t = d.totales || {};
    let sumaItems = items.reduce((s: number, i: any) => s + (i.importe_neto || 0), 0);
    // El modelo a veces le saca IVA a precios que ya eran netos: si ×1,21 cuadra con el neto, se corrige.
    if (t.neto_gravado && Math.abs(sumaItems * 1.21 - t.neto_gravado) <= Math.max(2, t.neto_gravado * 0.005)) {
      for (const i of items) {
        if (i.precio_neto_unit != null) i.precio_neto_unit = r2(i.precio_neto_unit * 1.21);
        if (i.importe_neto != null) i.importe_neto = r2(i.importe_neto * 1.21);
      }
      sumaItems = sumaItems * 1.21;
    }
    if (t.neto_gravado && Math.abs(sumaItems - t.neto_gravado) > Math.max(2, t.neto_gravado * 0.01))
      alertas.push(`La suma de renglones (${r2(sumaItems)}) no coincide con el neto gravado (${t.neto_gravado})`);
    const calc = (t.neto_gravado || 0) + (t.iva_21 || 0) + (t.iva_105 || 0) + (t.percepciones || 0) + (t.otros_impuestos || 0);
    if (t.total && Math.abs(calc - t.total) > Math.max(2, t.total * 0.005))
      alertas.push(`Neto + impuestos (${r2(calc)}) no coincide con el total (${t.total})`);
    if (!c.cae) alertas.push("Sin CAE: verificar que sea comprobante válido");
    if (d.observaciones) alertas.push(`Observación de la lectura: ${d.observaciones}`);
    const sinMatch = items.filter((i: any) => !i.insumo_id).length;
    if (sinMatch) alertas.push(`${sinMatch} renglón(es) sin insumo del catálogo asignado`);
    // Solo estas alertas son informativas; cualquier otra deja la factura para revisar a mano
    const informativa = (a: string) => /^(Proveedor nuevo|Insumo\(s\) nuevo|No se pudo guardar en Drive)/.test(a);

    const { data: f, error: eF } = await sb.from("facturas_compra").insert({
      proveedor_id: proveedorId, tipo_comprobante: c.tipo, punto_venta: c.punto_venta, numero: c.numero,
      fecha: c.fecha, cae: c.cae, cae_vto: c.cae_vto, condicion_pago: c.condicion_pago, remito: c.remito,
      moneda: c.moneda || "ARS", comprador_nombre: d.comprador?.nombre, comprador_cuit: fmtCuit(compCuit),
      a_nombre_de: aNombre, neto_gravado: t.neto_gravado, iva_21: t.iva_21, iva_105: t.iva_105,
      percepciones: t.percepciones, otros_impuestos: t.otros_impuestos, total: t.total,
      tc_usd: c.moneda === "USD" ? 1 : await tcDe(c.fecha), archivo_path, archivo_nombre: archivo_path.split("/").pop(), estado: "pendiente",
      extraccion: { ...d, _modelo: model, _uso: uso }, alertas, cargado_por: userId,
    }).select("id").single();
    if (eF) throw eF;
    if (items.length) {
      const { error: eI } = await sb.from("facturas_compra_items").insert(items.map((i: any) => ({ ...i, factura_id: f.id })));
      if (eI) throw eI;
    }
    // Archivo original a Drive (no frena la carga si falla: queda como alerta)
    let drive: { id: string; webViewLink: string } | null = null;
    try {
      const prov = (d.proveedor?.nombre || "Proveedor").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60);
      const nombre = `${c.fecha || "sin-fecha"} ${prov} ${c.tipo || ""} ${c.punto_venta || ""}-${c.numero || ""}.${ext}`.replace(/\s+/g, " ");
      drive = await archivarEnDrive(bytesArchivo, mime, nombre, c.fecha);
      if (drive) await sb.from("facturas_compra").update({ drive_file_id: drive.id, drive_url: drive.webViewLink }).eq("id", f.id);
    } catch (e) {
      alertas.push(`No se pudo guardar en Drive: ${(e as Error).message}`);
      await sb.from("facturas_compra").update({ alertas }).eq("id", f.id);
    }
    // Si los números cierran, se confirma sola: el precio de cada insumo queda actualizado
    let confirmada = false;
    if (proveedorId && alertas.every(informativa)) {
      const { error: eC } = await sb.rpc("confirmar_factura", { p_factura: f.id });
      if (!eC) { confirmada = true; await sb.from("facturas_compra").update({ auto_confirmada: true }).eq("id", f.id); }
    }
    if (body.staging_id) await sb.from("facturas_staging").delete().eq("id", body.staging_id);
    return json({ ok: true, factura_id: f.id, alertas, items: items.length, modelo: model, confirmada, drive_url: drive?.webViewLink ?? null });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
