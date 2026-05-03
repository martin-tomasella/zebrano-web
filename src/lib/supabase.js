import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
)

export const N8N_COTIZADOR = process.env.REACT_APP_N8N_COTIZADOR
export const N8N_LEADER    = process.env.REACT_APP_N8N_LEADER
