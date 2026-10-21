// tipo-cambio-bcra — trae del BCRA (API pública de estadísticas) el dólar minorista promedio vendedor (serie 4)
// y el mayorista de referencia A3500 (serie 5) y los guarda en tipos_cambio. Body opcional: { desde: "YYYY-MM-DD" }.
// Corre todos los días por pg_cron; con "desde" carga el histórico.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function serie(id: number, desde: string, hasta: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let offset = 0;
  for (;;) {
    const r = await fetch(`https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${id}?desde=${desde}&hasta=${hasta}&limit=3000&offset=${offset}`);
    if (!r.ok) throw new Error(`BCRA serie ${id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    // v4 devuelve results:[{idVariable, detalle:[{fecha, valor}]}]; se aceptan también filas planas
    const filas = (d.results || []).flatMap((x: any) => x.detalle ?? [x]);
    for (const f of filas) if (f.fecha && f.valor != null) out.set(f.fecha.slice(0, 10), Number(f.valor));
    const total = d.metadata?.resultset?.count ?? filas.length;
    offset += 3000;
    if (offset >= total || !filas.length) break;
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const hasta = new Date().toISOString().slice(0, 10);
    const desde = body.desde || new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
    const [min, may] = await Promise.all([serie(4, desde, hasta), serie(5, desde, hasta)]);
    const fechas = [...new Set([...min.keys(), ...may.keys()])];
    const filas = fechas.map((f) => ({ fecha: f, oficial_venta: min.get(f) ?? null, mayorista: may.get(f) ?? null, blue_venta: null, fuente: "bcra" }));
    for (let i = 0; i < filas.length; i += 500) {
      const { error } = await sb.from("tipos_cambio").upsert(filas.slice(i, i + 500), { onConflict: "fecha" });
      if (error) throw error;
    }
    return json({ ok: true, dias: filas.length, desde, hasta });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
