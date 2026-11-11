// Cerebro del Cotizador AI: prueba proveedores en orden y salta al siguiente si uno falla o se queda sin cupo.
// 1) llm-gateway propio (gratis, modelo "agente")  2) Google Gemini (capa gratis)  3) Claude  4) OpenAI.
// Cada proveedor se activa solo si su clave/URL existe en los secrets de Supabase.
// Devuelve también los tokens usados (usage) para registrar el consumo.
// @ts-nocheck
const AK = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const OK = Deno.env.get("OPENAI_API_KEY") ?? "";
const GK = Deno.env.get("GEMINI_API_KEY") ?? "";
const GW = Deno.env.get("LLM_GATEWAY_URL") ?? "";
const GWK = Deno.env.get("LLM_GATEWAY_KEY") ?? "";

function parse(raw) { try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; } }

// Mensajes formato Anthropic -> formato OpenAI (texto + imágenes base64)
function aOpenAI(msgs, system) {
  const out = [{ role: "system", content: system }];
  for (const m of msgs) {
    if (typeof m.content === "string") { out.push({ role: m.role, content: m.content }); continue; }
    out.push({ role: m.role, content: m.content.map((c) => c.type === "image"
      ? { type: "image_url", image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } }
      : { type: "text", text: c.text }) });
  }
  return out;
}

async function openaiCompat(url, key, model, msgs, system, extra = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, max_tokens: 8192, temperature: 0.2, messages: aOpenAI(msgs, system), ...extra }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(`${model} ${r.status}: ${d.error?.message ?? JSON.stringify(d).slice(0, 200)}`);
  const raw = d.choices?.[0]?.message?.content ?? "";
  return { raw, parsed: parse(raw), truncado: d.choices?.[0]?.finish_reason === "length",
    usage: { modelo: d.model || model, tokens_in: d.usage?.prompt_tokens ?? null, tokens_out: d.usage?.completion_tokens ?? null } };
}

async function claude(msgs, system) {
  const model = Deno.env.get("COTIZADOR_CLAUDE_MODEL") || "claude-sonnet-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": AK, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 8192, system, messages: msgs }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(`Claude ${r.status}: ${d.error?.message ?? ""}`);
  const raw = (d.content || []).find((c) => c.type === "text")?.text ?? "";
  return { raw, parsed: parse(raw), truncado: d.stop_reason === "max_tokens",
    usage: { modelo: d.model || model, tokens_in: d.usage?.input_tokens ?? null, tokens_out: d.usage?.output_tokens ?? null } };
}

// opts.preferir: proveedores que van primero si tienen clave, en ese orden (planos con imagen: Gemini flash los lee mal).
export async function callLLM(msgs, system, opts = {}) {
  const intentos = [];
  if (GW) intentos.push(["gateway", () => openaiCompat(`${GW.replace(/\/$/, "")}/chat/completions`, GWK, "agente", msgs, system)]);
  if (GK) intentos.push(["gemini", () => openaiCompat("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", GK,
    Deno.env.get("COTIZADOR_GEMINI_MODEL") || "gemini-2.5-flash", msgs, system,
    // Gemini 2.5 descuenta el razonamiento interno del tope de tokens: con despieces largos se cortaba
    { max_tokens: 32768, reasoning_effort: "low", response_format: { type: "json_object" } })]);
  if (AK) intentos.push(["claude", () => claude(msgs, system)]);
  if (OK) intentos.push(["openai", () => openaiCompat("https://api.openai.com/v1/chat/completions", OK,
    Deno.env.get("COTIZADOR_OPENAI_MODEL") || "gpt-4.1", msgs, system)]);
  for (const n of [...(opts.preferir ?? [])].reverse()) { const i = intentos.findIndex(([x]) => x === n); if (i > 0) intentos.unshift(...intentos.splice(i, 1)); }
  if (!intentos.length) return { raw: "", parsed: null, apiError: "No hay ningún modelo configurado (gateway, Gemini, Claude u OpenAI)" };
  const errores = [];
  for (const [nombre, fn] of intentos) {
    try {
      const r = await fn();
      // Si el modelo no devolvió JSON usable y hay otro proveedor, se prueba el siguiente
      if (!r.parsed && !r.truncado && nombre !== intentos[intentos.length - 1][0]) { errores.push(`${nombre}: sin JSON`); continue; }
      return { ...r, apiError: null, modelo: nombre, fallos: errores };
    } catch (e) { errores.push(`${nombre}: ${e.message}`); }
  }
  return { raw: "", parsed: null, apiError: "Ningún modelo respondió — " + errores.join(" | ") };
}
