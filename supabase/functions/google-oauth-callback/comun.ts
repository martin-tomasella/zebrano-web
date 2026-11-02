// Estados de OAuth: la conexión solo la inicia un empleado con sesión (POST desde el ERP).
// El callback exige un `state` creado así, sin usar y de menos de 15 minutos. Evita que un tercero
// reemplace la cuenta conectada por la suya.
export async function empleado(req: Request, sb: any): Promise<string | null> {
  const tok = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  const { data: u } = await sb.auth.getUser(tok);
  if (!u?.user) return null;
  const { data: emp } = await sb.from("empleados").select("activo").eq("auth_user_id", u.user.id).maybeSingle();
  return emp && emp.activo !== false ? u.user.id : null;
}
export async function nuevoEstado(sb: any, proveedor: string, uid: string): Promise<string> {
  const state = crypto.randomUUID();
  const { error } = await sb.from("oauth_estados").insert({ state, proveedor, creado_por: uid });
  if (error) throw new Error(error.message);
  return state;
}
export async function consumirEstado(sb: any, proveedor: string, state: string | null): Promise<boolean> {
  if (!state) return false;
  const desde = new Date(Date.now() - 15 * 60000).toISOString();
  const { data } = await sb.from("oauth_estados").update({ usado_at: new Date().toISOString() })
    .eq("state", state).eq("proveedor", proveedor).is("usado_at", null).gte("created_at", desde).select("state");
  return !!data?.length;
}
export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
