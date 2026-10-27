-- PROSPECTOR — instalación en cualquier unidad (proyecto Supabase propio).
-- 1) Correr este archivo en el SQL Editor del proyecto de la unidad (reemplazá <PROYECTO> en prospector_correr).
-- 2) Desplegar supabase/functions/prospector (mismo código, verify_jwt=false) y, si la unidad tiene agente
--    de Alfred, sumarle el paso "Prospección" del ciclo y el envío en /alfred/ejecutar (ver agente-zebrano).
-- 3) Cargar prosp_config: unidad, firma, remitente, zonas OSM, segmentos (filtros osm + oferta).
-- Requiere: pg_net, pg_cron, vault, y las funciones de rol es_admin()/get_mi_rol() (o ajustar las policies).

create table if not exists prosp_config (
  id int primary key default 1 check (id = 1), unidad text not null,
  remitente_nombre text, remitente_email text, firma text, dominios_propios text[] default '{}',
  linea_baja text not null default 'Si no te interesa, respondé "no gracias" y no te vuelvo a escribir.',
  direccion_postal text, zonas text[] not null default '{}', segmentos jsonb not null default '[]',
  max_perfiles_dia int not null default 25, max_borradores_dia int not null default 10,
  frases_prohibidas text[] default '{}', activo boolean not null default true, ultimo_ciclo jsonb, updated_at timestamptz default now()
);
create table if not exists prosp_senales (codigo text primary key, descripcion text not null, costo text not null default 'gratis',
  estado text not null default 'propuesta' check (estado in ('propuesta','confirmada','descartada')));
create table if not exists prosp_empresas (
  id uuid primary key default gen_random_uuid(), fuente text not null, ext_id text not null,
  nombre text not null, segmento text, rubro text, web text, email text, telefono text, instagram text, direccion text, zona text, lat numeric, lon numeric,
  estado text not null default 'nueva' check (estado in ('nueva','perfilada','sin_contacto','en_borrador','propuesta','contactada','respondio','descartada','baja')),
  perfilada_at timestamptz, prospecto_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(), unique (fuente, ext_id));
create table if not exists prosp_observaciones (id bigint generated always as identity primary key,
  empresa_id uuid not null references prosp_empresas(id) on delete cascade, senal text not null references prosp_senales(codigo),
  valor_num numeric, valor_text text, confianza numeric default 1, evidencia_url text, observado_at timestamptz default now());
create index if not exists prosp_obs_emp on prosp_observaciones(empresa_id, senal);
create table if not exists prosp_mensajes (id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references prosp_empresas(id) on delete cascade, paso int not null default 1,
  para text not null, asunto text not null, cuerpo text not null,
  estado text not null default 'borrador' check (estado in ('borrador','propuesto','aprobado','enviado','rechazado','bloqueado','error')),
  gate jsonb default '[]', propuesta_origen text, modelo text, enviado_at timestamptz, error text, created_at timestamptz default now());
create table if not exists prosp_bajas (valor text primary key, motivo text not null, created_at timestamptz default now());

do $$ declare t text; begin
  foreach t in array array['prosp_config','prosp_senales','prosp_empresas','prosp_observaciones','prosp_mensajes','prosp_bajas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using ((select es_admin()) or (select get_mi_rol()) = ''gestion'')', t||'_sel', t);
    execute format('create policy %I on %I for all using ((select es_admin()) or (select get_mi_rol()) = ''gestion'') with check ((select es_admin()) or (select get_mi_rol()) = ''gestion'')', t||'_w', t);
  end loop;
end $$;

create or replace view prosp_cohorte with (security_invoker = on) as
select e.*, coalesce(jsonb_object_agg(o.senal, coalesce(o.valor_text, o.valor_num::text)) filter (where o.senal is not null), '{}') as senales,
  (select m.estado from prosp_mensajes m where m.empresa_id = e.id order by m.created_at desc limit 1) as ultimo_mensaje
from prosp_empresas e left join prosp_observaciones o on o.empresa_id = e.id group by e.id;
grant select on prosp_cohorte to authenticated;

-- Clave interna para que solo pg_cron / la web llamen a la función
select vault.create_secret(encode(gen_random_bytes(24),'hex'), 'cron_key_prospector') where not exists (select 1 from vault.secrets where name in ('cron_key_prospector','cron_key_mercado'));
create or replace function cron_key_ok(k text) returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name in ('cron_key_prospector','cron_key_mercado') and decrypted_secret = k); $$;
revoke execute on function cron_key_ok(text) from public, anon, authenticated; grant execute on function cron_key_ok(text) to service_role;
create or replace function prospector_correr(p_etapa text, p_extra jsonb default '{}') returns bigint language sql security definer set search_path = public as $$
  select net.http_post(url := 'https://<PROYECTO>.supabase.co/functions/v1/prospector',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-key',(select decrypted_secret from vault.decrypted_secrets where name in ('cron_key_prospector','cron_key_mercado') limit 1)),
    body := jsonb_build_object('etapa', p_etapa) || p_extra, timeout_milliseconds := 150000); $$;
revoke execute on function prospector_correr(text, jsonb) from public, anon; grant execute on function prospector_correr(text, jsonb) to authenticated;
select cron.schedule('prospector-descubrir', '0 11 * * 1', $$ select prospector_correr('descubrir') $$);
select cron.schedule('prospector-perfilar', '30 10 * * 1-5', $$ select prospector_correr('perfilar') $$);
select cron.schedule('prospector-escribir', '15 11 * * 1-5', $$ select prospector_correr('escribir') $$);

insert into prosp_senales (codigo, descripcion, costo, estado) values
 ('RUBRO','Rubro según el mapa','gratis','confirmada'), ('TIENE_WEB','Tiene sitio web propio','gratis','confirmada'),
 ('SIN_WEB','Figura en el mapa sin sitio web','gratis','confirmada'), ('EMAIL_ENCONTRADO','Email publicado en su web o en el mapa','gratis','confirmada'),
 ('TELEFONO','Teléfono publicado','gratis','confirmada'), ('INSTAGRAM','Instagram enlazado','gratis','confirmada'),
 ('WHATSAPP','WhatsApp enlazado en la web','gratis','confirmada'), ('VENDE_ONLINE','Tienda online en la web','gratis','confirmada'),
 ('FABRICA_PROPIA','Dice que fabrica (posible competidor)','gratis','confirmada'), ('A_MEDIDA','Ofrece trabajos a medida','gratis','confirmada'),
 ('MARCAS_TERCEROS','Revende marcas de terceros','gratis','confirmada'), ('OBRAS_EN_CURSO','Publica obras o proyectos','gratis','confirmada')
on conflict (codigo) do nothing;
