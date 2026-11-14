-- Oficina virtual de agentes (14/11/2026).
-- Cada agente tiene puesto y área; su actividad se registra sola con triggers sobre las tablas que ya usa
-- (no hay que tocar cada función). La bandeja es agente_propuestas (la misma que va a Alfred).
-- Al aprobarse una cotización se guarda en conocimiento_cotizaciones; las correcciones de la tarjeta, en cotizador_aprendizajes.

-- ── Agentes ────────────────────────────────────────────────────────────────
create table if not exists public.agentes (
  slug text primary key,
  nombre text not null,
  puesto text not null,
  area text not null,
  color text not null,
  orden int not null default 0,
  pagina text,
  descripcion text,
  bloqueo text,
  activo boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.agentes enable row level security;
drop policy if exists agentes_sel on public.agentes;
create policy agentes_sel on public.agentes for select to authenticated using (es_empleado());
drop policy if exists agentes_upd on public.agentes;
create policy agentes_upd on public.agentes for update to authenticated using (es_admin()) with check (es_admin());

insert into public.agentes (slug, nombre, puesto, area, color, orden, pagina, descripcion, bloqueo) values
 ('zebrano','Zebrano','Jefe de oficina','direccion','#c9a227',0,'/','Reparte el trabajo, junta lo que hay que aprobar y le informa a Alfred.',null),
 ('roble','Roble','Atención de contactos','comercial','#8b5a2b',1,'/prospectos','Responde lo que llega por la web y las redes, junta medidas y fotos y se lo pasa a Nogal.','Faltan WhatsApp Business, Instagram y Facebook conectados: hoy solo recibe lo que entra por la web.'),
 ('cedro','Cedro','Seguimiento y cierre','comercial','#b5651d',2,'/cotizador','Sigue las cotizaciones sin respuesta y, cuando se aprueban, pasa el trabajo a OT.',null),
 ('algarrobo','Algarrobo','Prospector','comercial','#6b4f2a',3,'/prospeccion','Busca clientes nuevos (arquitectos, constructoras, inmobiliarias), los perfila y escribe el primer mail.','Falta la casilla de envío: los mails aprobados quedan listos y no salen.'),
 ('nogal','Nogal','Cotizador','diseno','#5d3a1a',4,'/cotizador','Lee planos, arma el 3D, el render y la cotización con la planilla del taller.',null),
 ('lapacho','Lapacho','Redes sociales','contenidos','#c2185b',5,'/marketing','Arma el calendario con fotos de trabajos terminados, escribe los textos y publica con el "dale".','Faltan las cuentas de Instagram y Facebook.'),
 ('quebracho','Quebracho','Mercado y competencia','mercado','#7b1f1f',6,'/mercado','Mira qué publica y a qué precio la competencia y marca dónde se puede ganar.','Faltan ML_CLIENT_ID y ML_CLIENT_SECRET: usa los precios del 21/10.'),
 ('guatambu','Guatambú','Compras y taller','operaciones','#d4b483',7,'/compras','Lee facturas, actualiza precios y stock, y avisa qué comprar para cada OT.',null)
on conflict (slug) do update set nombre=excluded.nombre, puesto=excluded.puesto, area=excluded.area, color=excluded.color, orden=excluded.orden, pagina=excluded.pagina, descripcion=excluded.descripcion;

-- ── Actividad ──────────────────────────────────────────────────────────────
create table if not exists public.agentes_actividad (
  id bigserial primary key,
  agente text not null references public.agentes(slug),
  estado text not null check (estado in ('trabajando','esperando','hecho','trabado')),
  tarea text not null,
  hacia text references public.agentes(slug),
  ref_tipo text,
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists agentes_actividad_agente_idx on public.agentes_actividad (agente, created_at desc);
create index if not exists agentes_actividad_fecha_idx on public.agentes_actividad (created_at desc);
alter table public.agentes_actividad enable row level security;
drop policy if exists agact_sel on public.agentes_actividad;
create policy agact_sel on public.agentes_actividad for select to authenticated using (es_empleado());

create or replace function public.agente_act(p_agente text, p_estado text, p_tarea text, p_hacia text default null, p_ref_tipo text default null, p_ref_id text default null)
returns void language sql security definer set search_path = public as $$
  insert into agentes_actividad (agente, estado, tarea, hacia, ref_tipo, ref_id) values (p_agente, p_estado, left(p_tarea, 200), p_hacia, p_ref_tipo, p_ref_id);
$$;
revoke all on function public.agente_act(text,text,text,text,text,text) from public, anon, authenticated;

-- ── Bandeja: agente_propuestas con dueño y vía de aprobación ───────────────
alter table public.agente_propuestas add column if not exists agente text references public.agentes(slug);
alter table public.agente_propuestas add column if not exists aprobado_via text check (aprobado_via in ('oficina','alfred'));
alter table public.agente_propuestas add column if not exists resuelta_por uuid;
create or replace function public.agente_de_propuesta(p_origen text, p_tipo text) returns text language sql immutable as $$
  select case
    when p_origen like 'zebrano:prosp:%' then 'algarrobo'
    when p_origen like 'zebrano:seguimiento:%' then 'cedro'
    when p_origen like 'zebrano:post:%' or p_tipo = 'publicar_rrss' then 'lapacho'
    when p_origen like 'zebrano:atraso:%' then 'guatambu'
    when p_tipo = 'responder_consulta' then 'roble'
    when p_tipo = 'enviar_cotizacion' then 'cedro'
    else 'zebrano' end;
$$;
update public.agente_propuestas set agente = public.agente_de_propuesta(origen, tipo) where agente is null;

create or replace function public.tg_propuesta_oficina() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.agente := coalesce(new.agente, agente_de_propuesta(new.origen, new.tipo));
    return new;
  end if;
  return new;
end $$;
drop trigger if exists propuesta_oficina_bi on public.agente_propuestas;
create trigger propuesta_oficina_bi before insert on public.agente_propuestas for each row execute function public.tg_propuesta_oficina();

create or replace function public.tg_propuesta_actividad() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform agente_act(new.agente, 'esperando', 'Propone: ' || coalesce(new.titulo, new.tipo), case when new.agente <> 'zebrano' then 'zebrano' end, 'propuesta', new.id::text);
  elsif new.estado is distinct from old.estado and new.estado in ('ejecutada','descartada') then
    perform agente_act(new.agente, 'hecho', (case when new.estado = 'ejecutada' then 'Aprobada' else 'Descartada' end) || coalesce(' en ' || case new.aprobado_via when 'oficina' then 'la Oficina' when 'alfred' then 'Alfred' end, '') || ': ' || coalesce(new.titulo, new.tipo), null, 'propuesta', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists propuesta_actividad_ai on public.agente_propuestas;
create trigger propuesta_actividad_ai after insert or update of estado on public.agente_propuestas for each row execute function public.tg_propuesta_actividad();

-- ── Actividad desde las tablas que ya usan los agentes ─────────────────────
create or replace function public.tg_act_cotizacion() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; quien text;
begin
  if tg_table_name = 'cotizacion_sesiones' then
    quien := coalesce(nullif(new.cliente_nombre, ''), new.tipo_trabajo, 'consulta');
    if tg_op = 'INSERT' then
      if new.canal in ('externo','web') then perform agente_act('roble','trabajando','Atiende una consulta desde la web', 'nogal', 'sesion', new.id::text);
      else perform agente_act('nogal','trabajando','Nueva cotización', null, 'sesion', new.id::text); end if;
    elsif new.estado = 'aprobada' and old.estado is distinct from 'aprobada' then
      perform agente_act('cedro','hecho','Cerró: ' || quien || ' → orden de trabajo', 'guatambu', 'sesion', new.id::text);
    end if;
  elsif tg_table_name = 'cotizacion_diseno' then
    select tipo_trabajo, cliente_nombre into s from cotizacion_sesiones where id = new.sesion_id;
    perform agente_act('nogal','trabajando','Diseña ' || coalesce(s.tipo_trabajo, 'mueble') || coalesce(' de ' || nullif(s.cliente_nombre,''), '') || ' (' || coalesce(jsonb_array_length(new.modulos), 0) || ' módulos)', null, 'sesion', new.sesion_id::text);
  elsif tg_table_name = 'cotizacion_resumen' then
    if coalesce(new.precio_sugerido, 0) > 0 and (tg_op = 'INSERT' or new.precio_sugerido is distinct from old.precio_sugerido) then
      select tipo_trabajo, cliente_nombre into s from cotizacion_sesiones where id = new.sesion_id;
      perform agente_act('nogal','hecho','Cotizó ' || coalesce(s.tipo_trabajo, 'mueble') || coalesce(' de ' || nullif(s.cliente_nombre,''), '') || ': $' || to_char(new.precio_sugerido, 'FM999G999G999'), 'cedro', 'sesion', new.sesion_id::text);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists act_sesiones on public.cotizacion_sesiones;
create trigger act_sesiones after insert or update of estado on public.cotizacion_sesiones for each row execute function public.tg_act_cotizacion();
drop trigger if exists act_diseno on public.cotizacion_diseno;
create trigger act_diseno after insert or update of modulos on public.cotizacion_diseno for each row execute function public.tg_act_cotizacion();
drop trigger if exists act_resumen on public.cotizacion_resumen;
create trigger act_resumen after insert or update of precio_sugerido on public.cotizacion_resumen for each row execute function public.tg_act_cotizacion();

create or replace function public.tg_act_roble() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'prospectos' then
    perform agente_act('roble','trabajando','Nueva consulta: ' || trim(coalesce(new.nombre,'') || ' ' || coalesce(new.apellido,'')) || coalesce(' (' || new.canal_origen || ')', ''), case when new.tipo_trabajo is not null then 'nogal' end, 'prospecto', new.id::text);
  elsif new.direccion = 'entrante' then
    perform agente_act('roble','trabajando','Responde un mensaje por ' || coalesce(new.canal, 'chat'), null, 'prospecto', new.prospecto_id::text);
  end if;
  return null;
end $$;
drop trigger if exists act_prospectos on public.prospectos;
create trigger act_prospectos after insert on public.prospectos for each row execute function public.tg_act_roble();
drop trigger if exists act_conversaciones on public.prospecto_conversaciones;
create trigger act_conversaciones after insert on public.prospecto_conversaciones for each row execute function public.tg_act_roble();

-- Por lote (el prospector y el relevamiento insertan muchas filas de una vez)
create or replace function public.tg_act_lote() returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from nuevas;
  if n = 0 then return null; end if;
  if tg_table_name = 'prosp_empresas' then perform agente_act('algarrobo','trabajando','Encontró ' || n || ' empresas para prospectar');
  elsif tg_table_name = 'prosp_mensajes' then perform agente_act('algarrobo','trabajando','Escribió ' || n || ' mail(s) de presentación', 'zebrano');
  elsif tg_table_name = 'mercado_precios' then perform agente_act('quebracho','hecho','Relevó ' || n || ' precios de la competencia');
  end if;
  return null;
end $$;
drop trigger if exists act_prosp_empresas on public.prosp_empresas;
create trigger act_prosp_empresas after insert on public.prosp_empresas referencing new table as nuevas for each statement execute function public.tg_act_lote();
drop trigger if exists act_prosp_mensajes on public.prosp_mensajes;
create trigger act_prosp_mensajes after insert on public.prosp_mensajes referencing new table as nuevas for each statement execute function public.tg_act_lote();
drop trigger if exists act_mercado_precios on public.mercado_precios;
create trigger act_mercado_precios after insert on public.mercado_precios referencing new table as nuevas for each statement execute function public.tg_act_lote();

create or replace function public.tg_act_guatambu() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'facturas_compra' then
    if tg_op = 'INSERT' then perform agente_act('guatambu','trabajando','Lee una factura de proveedor', null, 'factura', new.id::text);
    elsif new.estado is distinct from old.estado and new.estado = 'confirmada' then perform agente_act('guatambu','hecho','Factura confirmada: precios y stock al día', 'nogal', 'factura', new.id::text);
    end if;
  elsif tg_table_name = 'ordenes_trabajo' then
    perform agente_act('guatambu','trabajando','Planifica una OT nueva: corte, compras y etapas', null, 'ot', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists act_facturas on public.facturas_compra;
create trigger act_facturas after insert or update of estado on public.facturas_compra for each row execute function public.tg_act_guatambu();
drop trigger if exists act_ots on public.ordenes_trabajo;
create trigger act_ots after insert on public.ordenes_trabajo for each row execute function public.tg_act_guatambu();

create or replace function public.tg_act_zebrano() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'ciclo' then perform agente_act('zebrano','hecho','Ciclo del día: ' || coalesce(new.detalle->>'propuestas','0') || ' propuesta(s) repartidas');
  elsif new.tipo = 'consulta' then perform agente_act('zebrano','hecho','Le respondió una consulta a Alfred');
  elsif new.tipo = 'encargo' then perform agente_act('zebrano','trabajando','Recibió un encargo de Alfred');
  end if;
  return null;
end $$;
drop trigger if exists act_agente_log on public.agente_log;
create trigger act_agente_log after insert on public.agente_log for each row execute function public.tg_act_zebrano();

revoke all on function public.tg_propuesta_oficina(), public.tg_propuesta_actividad(), public.tg_act_cotizacion(), public.tg_act_roble(), public.tg_act_lote(), public.tg_act_guatambu(), public.tg_act_zebrano() from public, anon, authenticated;

-- ── Estado de la oficina (una llamada para la página) ──────────────────────
create or replace function public.oficina_estado() returns jsonb language sql stable security invoker set search_path = public as $$
  with ult as (
    select distinct on (agente) agente, estado, tarea, hacia, created_at from agentes_actividad order by agente, created_at desc
  ), pend as (
    select agente, count(*) n from agente_propuestas where estado in ('nueva','enviada','error_envio') group by agente
  ), fact as (
    select count(*) n from facturas_compra where estado = 'pendiente'
  )
  select jsonb_build_object(
    'agentes', (select jsonb_agg(jsonb_build_object(
        'slug', a.slug, 'nombre', a.nombre, 'puesto', a.puesto, 'area', a.area, 'color', a.color, 'pagina', a.pagina, 'descripcion', a.descripcion, 'bloqueo', a.bloqueo,
        'pendientes', coalesce(p.n, 0) + case when a.slug = 'guatambu' then (select n from fact) else 0 end,
        'ultima', case when u.agente is null then null else jsonb_build_object('estado', u.estado, 'tarea', u.tarea, 'hacia', u.hacia, 'at', u.created_at) end,
        'estado', case
          when a.bloqueo is not null and coalesce(p.n,0) = 0 and (u.created_at is null or u.created_at < now() - interval '15 minutes') then 'trabado'
          when u.created_at > now() - interval '15 minutes' and u.estado = 'trabajando' then 'trabajando'
          when coalesce(p.n, 0) + case when a.slug = 'guatambu' then (select n from fact) else 0 end > 0 then 'esperando'
          when u.created_at > now() - interval '15 minutes' then 'trabajando'
          else 'libre' end
      ) order by a.orden) from agentes a left join ult u on u.agente = a.slug left join pend p on p.agente = a.slug where a.activo),
    'pases', coalesce((select jsonb_agg(jsonb_build_object('de', agente, 'a', hacia, 'tarea', tarea, 'at', created_at) order by created_at desc)
        from (select * from agentes_actividad where hacia is not null and created_at > now() - interval '2 hours' order by created_at desc limit 8) x), '[]'::jsonb),
    'tablero', jsonb_build_object(
      'consultas_7d', (select count(*) from prospectos where created_at > now() - interval '7 days'),
      'cotizaciones_7d', (select count(*) from cotizacion_resumen where precio_sugerido > 0 and updated_at > now() - interval '7 days'),
      'monto_7d', (select coalesce(sum(precio_sugerido), 0) from cotizacion_resumen where precio_sugerido > 0 and updated_at > now() - interval '7 days'),
      'aprobadas_30d', (select count(*) from cotizacion_sesiones where estado = 'aprobada' and updated_at > now() - interval '30 days'),
      'por_aprobar', (select count(*) from agente_propuestas where estado in ('nueva','enviada','error_envio')),
      'aprendizajes', (select count(*) from conocimiento_cotizaciones)
    )
  );
$$;
revoke all on function public.oficina_estado() from public, anon;
grant execute on function public.oficina_estado() to authenticated;

-- ── Base de conocimiento: cada cotización aprobada queda guardada ──────────
alter table public.conocimiento_cotizaciones add column if not exists sesion_id uuid unique;
alter table public.conocimiento_cotizaciones add column if not exists origen text;
alter table public.conocimiento_cotizaciones add column if not exists modulos jsonb;
alter table public.conocimiento_cotizaciones add column if not exists confirmado jsonb;
alter table public.conocimiento_cotizaciones add column if not exists render_url text;
alter table public.conocimiento_cotizaciones add column if not exists terminacion text;

create or replace function public.tg_conocimiento_al_aprobar() returns trigger language plpgsql security definer set search_path = public as $$
declare d record; r record;
begin
  if new.estado = 'aprobada' and old.estado is distinct from 'aprobada' then
    select * into d from cotizacion_diseno where sesion_id = new.id;
    select * into r from cotizacion_resumen where sesion_id = new.id;
    insert into conocimiento_cotizaciones (sesion_id, origen, titulo, tipo_trabajo, descripcion, modulos, confirmado, terminacion, render_url, imagenes_urls,
        materiales_json, piezas_json, herrajes_json, horas_reales, costo_real, precio_final, margen_real, procesado, notas)
    values (new.id, 'cotizador',
      coalesce(nullif(new.cliente_nombre,''), 'Cliente') || ' - ' || coalesce(new.tipo_trabajo, 'mueble'),
      new.tipo_trabajo,
      (select string_agg(coalesce(m->>'cantidad','1') || ' × ' || coalesce(m->>'nombre','módulo') || ' ' || coalesce(m->>'ancho_mm','?') || '×' || coalesce(m->>'alto_mm','?') || '×' || coalesce(m->>'prof_mm','?') || ' mm, ' || coalesce(m->>'puertas','0') || ' puertas, ' || coalesce(m->>'cajones','0') || ' cajones, ' || coalesce(m->>'estantes','0') || ' estantes' || case when (m->>'regrueso')::boolean then ', regrueso 36 mm' else '' end || case when coalesce((m->>'zocalo_mm')::numeric,0) > 0 then ', zócalo ' || (m->>'zocalo_mm') || ' mm' else '' end || coalesce(', ' || (m->>'material'), ''), '; ') from jsonb_array_elements(coalesce(d.modulos, '[]'::jsonb)) m),
      d.modulos, new.contexto_extra->'confirmado_datos', new.contexto_extra->>'terminacion', coalesce(d.render_fotorrealista_url, r.render_url),
      coalesce(new.imagenes_urls, '[]'::jsonb),
      (select jsonb_agg(jsonb_build_object('material', material, 'hojas', hojas_reales, 'subtotal', subtotal)) from cotizacion_hojas where sesion_id = new.id),
      (select jsonb_agg(jsonb_build_object('modulo', modulo_nombre, 'pieza', nombre_pieza, 'largo', largo_mm, 'ancho', ancho_mm, 'cantidad', cantidad)) from cotizacion_piezas where sesion_id = new.id),
      (select jsonb_agg(jsonb_build_object('nombre', nombre, 'cantidad', cantidad, 'subtotal', subtotal)) from cotizacion_herrajes where sesion_id = new.id),
      (select sum(horas_estimadas * operarios) from cotizacion_mano_obra where sesion_id = new.id),
      r.costo_total_interno, coalesce(new.precio_aprobado, r.precio_final, r.precio_sugerido), r.margen_pct, true,
      'Aprobada en el cotizador el ' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') || '. Horas estimadas (no reales) hasta cerrar la OT.')
    on conflict (sesion_id) do nothing;
    perform agente_act('nogal','hecho','Aprendió de la cotización aprobada de ' || coalesce(nullif(new.cliente_nombre,''), new.tipo_trabajo, 'un cliente'), null, 'sesion', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists conocimiento_al_aprobar on public.cotizacion_sesiones;
create trigger conocimiento_al_aprobar after update of estado on public.cotizacion_sesiones for each row execute function public.tg_conocimiento_al_aprobar();
revoke all on function public.tg_conocimiento_al_aprobar() from public, anon, authenticated;

-- ── Aprendizajes: lo que el taller corrige de la lectura del agente ────────
create table if not exists public.cotizador_aprendizajes (
  id bigserial primary key,
  sesion_id uuid,
  tipo_trabajo text,
  campo text not null,
  leido text,
  corregido text,
  created_at timestamptz not null default now()
);
create index if not exists cot_aprend_tipo_idx on public.cotizador_aprendizajes (tipo_trabajo, created_at desc);
alter table public.cotizador_aprendizajes enable row level security;
drop policy if exists cot_aprend_sel on public.cotizador_aprendizajes;
create policy cot_aprend_sel on public.cotizador_aprendizajes for select to authenticated using (es_empleado());
drop policy if exists cot_aprend_del on public.cotizador_aprendizajes;
create policy cot_aprend_del on public.cotizador_aprendizajes for delete to authenticated using (es_admin());

-- Tiempo real para la página (si la publicación existe)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.agentes_actividad; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.agente_propuestas; exception when duplicate_object then null; end;
  end if;
end $$;
