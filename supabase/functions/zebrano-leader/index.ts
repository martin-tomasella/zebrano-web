import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// v21 (01/11/2026): llama a cotizador-ai con el service role (cotizador-ai ya no es pública).
// v22 (02/11/2026): exige credenciales (empleado con sesión, x-kb-secret, service role o x-webhook-secret).
// El workflow n8n Leader_Zebrano_v1 tiene que mandar x-kb-secret.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret, x-kb-secret',
  'Content-Type': 'application/json',
};

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')  ?? '';
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('ZEBRANO_WEBHOOK_SECRET') ?? '';

async function autorizado(req: Request, sb: any): Promise<boolean> {
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') === WEBHOOK_SECRET) return true;
  const tok = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (tok && tok === SUPABASE_KEY) return true;
  const llave = req.headers.get('x-kb-secret');
  if (llave) { const { data } = await sb.rpc('kb_sync_secret'); return !!data && llave === data; }
  if (!tok) return false;
  const { data: u } = await sb.auth.getUser(tok);
  if (!u?.user) return false;
  const { data: emp } = await sb.from('empleados').select('activo').eq('auth_user_id', u.user.id).maybeSingle();
  return !!emp && emp.activo !== false;
}

const SYSTEM_PROMPT = `Sos el agente operacional de Zebrano, una carpintería premium a medida.
Recibís comandos en lenguaje natural de Alfred (asistente de voz) o de n8n y debés:

1. Identificar el INTENT del comando
2. Extraer las ENTIDADES relevantes
3. Devolver JSON con la acción a ejecutar

Intents posibles:
- cotizar: generar desglose de módulo
- crear_proyecto: nuevo proyecto para cliente
- actualizar_avance: modificar % de avance de una OT
- consultar_estado: estado de proyecto/OT/cliente
- agregar_cliente: registrar nuevo cliente
- agregar_oportunidad: nueva oportunidad en pipeline
- resumen_diario: resumen operacional del día
- otro: comando no reconocido

Responde ÚNICAMENTE con JSON válido:
{
  "intent": "string",
  "entidades": {
    "cliente_nombre": "string|null",
    "proyecto_nombre": "string|null",
    "modulo_descripcion": "string|null",
    "numero_ot": "string|null",
    "avance_pct": "number|null",
    "dimensiones": { "ancho_mm": number, "alto_mm": number, "profundidad_mm": number } | null,
    "tipo_modulo": "string|null",
    "valor_estimado": "number|null",
    "notas": "string|null"
  },
  "respuesta_voz": "string",
  "requiere_confirmacion": boolean
}

respuesta_voz debe ser en español, concisa (máximo 2 oraciones), tono profesional de asistente.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (!(await autorizado(req, supabase))) {
    return new Response(JSON.stringify({ ok: false, error: 'no autorizado' }), { status: 401, headers: CORS });
  }

  let comandoId: string | null = null;

  try {
    const body = await req.json();
    const { comando, fuente = 'n8n', contexto = {} } = body;

    if (!comando) {
      return new Response(JSON.stringify({ ok: false, error: 'campo comando requerido' }), { status: 400, headers: CORS });
    }
    if (String(comando).length > 2000) {
      return new Response(JSON.stringify({ ok: false, error: 'comando demasiado largo' }), { status: 400, headers: CORS });
    }

    // Registrar comando entrante
    const { data: cmdRow } = await supabase
      .from('alfred_comandos')
      .insert({ fuente, comando_raw: comando, estado: 'procesando' })
      .select('id')
      .single();

    comandoId = cmdRow?.id ?? null;

    // Obtener contexto activo
    const { data: ctxRows } = await supabase.from('zebrano_contexto').select('clave, valor');
    const contextoActivo = Object.fromEntries((ctxRows ?? []).map((r: {clave: string; valor: unknown}) => [r.clave, r.valor]));

    // Obtener resumen operacional para que el agente tenga contexto
    const { data: resumen } = await supabase.from('v_resumen_operacional').select('*').single();

    // Llamar a Claude para parsear el intent
    const userMsg = [
      `Comando recibido: "${comando}"`,
      `Contexto activo: ${JSON.stringify(contextoActivo)}`,
      `Estado operacional: ${JSON.stringify(resumen)}`,
      contexto && Object.keys(contexto).length ? `Info adicional: ${JSON.stringify(contexto)}` : '',
    ].filter(Boolean).join('\n');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const anthropicData = await anthropicRes.json();
    const textBlock = (anthropicData.content || []).find((c: any) => c.type === 'text');
    const rawText: string = textBlock?.text ?? '{}';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { intent: 'otro', respuesta_voz: 'No pude interpretar el comando.' };
    }

    const intent = parsed.intent as string;
    const entidades = parsed.entidades as Record<string, unknown>;
    const tiempoMs = Date.now() - startTime;

    let resultado: Record<string, unknown> = { intent, entidades };

    if (intent === 'resumen_diario') {
      const { data: otActivas } = await supabase.from('v_ot_activas').select('*');
      const { data: pipeline } = await supabase.from('v_pipeline_resumen').select('*');
      resultado = { intent, resumen, ot_activas: otActivas, pipeline };
    }

    if (intent === 'consultar_estado' && entidades?.numero_ot) {
      const { data: ot } = await supabase
        .from('v_ot_activas')
        .select('*')
        .eq('numero_ot', entidades.numero_ot)
        .single();
      resultado = { intent, ot };
    }

    if (intent === 'actualizar_avance' && entidades?.numero_ot && entidades?.avance_pct != null) {
      const { data: otRow } = await supabase
        .from('ordenes_trabajo')
        .select('id')
        .eq('numero_ot', entidades.numero_ot)
        .single();
      if (otRow?.id) {
        await supabase
          .from('ordenes_trabajo')
          .update({ avance_pct: entidades.avance_pct })
          .eq('id', otRow.id);
        resultado = { intent, actualizado: true, numero_ot: entidades.numero_ot, avance_pct: entidades.avance_pct };
      }
    }

    if (intent === 'cotizar' && entidades?.modulo_descripcion) {
      const cotizadorRes = await fetch(`${SUPABASE_URL}/functions/v1/cotizador-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          descripcion: entidades.modulo_descripcion,
          tipo_modulo: entidades.tipo_modulo,
          dimensiones: entidades.dimensiones,
        }),
      });
      const cotizadorData = await cotizadorRes.json();
      resultado = { intent, desglose: cotizadorData.desglose };
    }

    await supabase
      .from('alfred_comandos')
      .update({
        intent,
        entidades,
        estado: 'completado',
        resultado,
        tiempo_ms: tiempoMs,
      })
      .eq('id', comandoId);

    return new Response(JSON.stringify({
      ok: true,
      intent,
      respuesta_voz: parsed.respuesta_voz,
      requiere_confirmacion: parsed.requiere_confirmacion ?? false,
      resultado,
      tiempo_ms: tiempoMs,
    }), { headers: CORS });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    if (comandoId) {
      const supabase2 = createClient(SUPABASE_URL, SUPABASE_KEY);
      await supabase2.from('alfred_comandos').update({ estado: 'error', error_msg: msg }).eq('id', comandoId);
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: CORS });
  }
});
