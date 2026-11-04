-- Cola de fabricación (04/11/2026)
-- OT 'pendiente' = en cola (orden por prioridad, después por antigüedad).
-- 'Iniciar fabricación' (ot_iniciar) pasa la OT a 'en_proceso', fija iniciada_at y el proyecto a 'en_fabricacion'.
-- Solo admin y gestión iniciar, reordenar, cargar avance y entregar.

alter table public.ordenes_trabajo
  add column if not exists prioridad integer,
  add column if not exists iniciada_at timestamptz;

-- Datos existentes: las OT en cola no empezaron; las iniciadas toman su fecha_inicio.
update public.ordenes_trabajo set estado = 'en_proceso' where estado = 'en_progreso';
update public.ordenes_trabajo
   set iniciada_at = (fecha_inicio + time '09:00') at time zone 'America/Argentina/Buenos_Aires'
 where estado in ('en_proceso','terminada') and iniciada_at is null and fecha_inicio is not null;
update public.ordenes_trabajo set fecha_inicio = null where estado = 'pendiente';
update public.proyectos p set fecha_inicio_fabricacion = o.fecha_inicio
  from public.ordenes_trabajo o
 where o.proyecto_id = p.id and o.estado = 'en_proceso' and p.estado = 'en_fabricacion' and p.fecha_inicio_fabricacion is null;

create or replace function public.puede_gestionar_produccion() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empleados where auth_user_id = auth.uid() and coalesce(activo, true) and rol in ('admin','gestion'));
$$;

create or replace function public.ot_iniciar(p_ot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_proy uuid; v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not puede_gestionar_produccion() then raise exception 'Solo admin o gestión' using errcode = '42501'; end if;
  update ordenes_trabajo
     set estado = 'en_proceso', iniciada_at = coalesce(iniciada_at, now()), fecha_inicio = coalesce(fecha_inicio, v_hoy),
         prioridad = null, updated_at = now()
   where id = p_ot and estado in ('pendiente','en_proceso')
   returning proyecto_id into v_proy;
  if not found then raise exception 'La OT no está en cola'; end if;
  update proyectos set estado = 'en_fabricacion', fecha_inicio_fabricacion = coalesce(fecha_inicio_fabricacion, v_hoy), updated_at = now()
   where id = v_proy and estado not in ('entregado','cancelado');
end $$;

-- p_ids: las OT en cola en el orden deseado (la primera es la próxima).
create or replace function public.ot_reordenar(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede_gestionar_produccion() then raise exception 'Solo admin o gestión' using errcode = '42501'; end if;
  update ordenes_trabajo o set prioridad = x.ord, updated_at = now()
    from unnest(p_ids) with ordinality x(id, ord)
   where o.id = x.id and o.estado = 'pendiente';
end $$;

create or replace function public.ot_avance(p_ot uuid, p_pct integer, p_horas numeric default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede_gestionar_produccion() then raise exception 'Solo admin o gestión' using errcode = '42501'; end if;
  update ordenes_trabajo set avance_pct = greatest(0, least(100, p_pct)), horas_reales = coalesce(p_horas, horas_reales), updated_at = now()
   where id = p_ot and estado = 'en_proceso';
  if not found then raise exception 'La OT no está en fabricación'; end if;
end $$;

create or replace function public.ot_entregar(p_ot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_proy uuid; v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not puede_gestionar_produccion() then raise exception 'Solo admin o gestión' using errcode = '42501'; end if;
  update ordenes_trabajo set estado = 'terminada', avance_pct = 100, fecha_entrega_real = v_hoy, updated_at = now()
   where id = p_ot and estado = 'en_proceso' returning proyecto_id into v_proy;
  if not found then raise exception 'La OT no está en fabricación'; end if;
  update proyectos set estado = 'entregado', fecha_entrega_real = v_hoy, updated_at = now() where id = v_proy;
end $$;

revoke all on function public.puede_gestionar_produccion(), public.ot_iniciar(uuid), public.ot_reordenar(uuid[]),
  public.ot_avance(uuid, integer, numeric), public.ot_entregar(uuid) from public, anon;
grant execute on function public.puede_gestionar_produccion(), public.ot_iniciar(uuid), public.ot_reordenar(uuid[]),
  public.ot_avance(uuid, integer, numeric), public.ot_entregar(uuid) to authenticated;

-- Gestión no veía las OT (solo admin, ventas y taller).
drop policy if exists ordenes_trabajo_select on public.ordenes_trabajo;
create policy ordenes_trabajo_select on public.ordenes_trabajo for select using (
  (select es_admin()) or (select es_ventas()) or (select es_taller()) or (select get_mi_rol()) = 'gestion'
  or (select auth.role()) = 'service_role');

-- La OT en cola nunca nace con fecha de inicio (el cotizador v63 la mandaba con el día de aprobación).
create or replace function public.ot_en_cola_sin_fecha() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado = 'pendiente' then new.fecha_inicio := null; new.iniciada_at := null; end if;
  return new;
end $$;
revoke all on function public.ot_en_cola_sin_fecha() from public, anon;
drop trigger if exists ot_en_cola_sin_fecha on public.ordenes_trabajo;
create trigger ot_en_cola_sin_fecha before insert on public.ordenes_trabajo
  for each row execute function public.ot_en_cola_sin_fecha();
