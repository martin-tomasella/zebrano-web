import { supabase } from './supabase';

// Llamadas a edge functions de Zebrano con el token de la sesión del empleado.
// Las funciones verifican ese token (01/11/2026): sin sesión de un empleado responden 401.
// Cualquier otra URL pasa como un fetch normal (no se le agrega el token).
export async function authFetch(url, opts = {}) {
  const u = typeof url === 'string' ? url : (url && url.url) || '';
  if (u.includes('.supabase.co/functions/v1/')) {
    const { data } = await supabase.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (token) opts = { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } };
  }
  return window.fetch(url, opts);
}
