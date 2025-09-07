# Base de Datos para Sistema de Reservas de Restaurante - LEGACY

**⚠️ ARCHIVO LEGACY - USAR NUEVOS ARCHIVOS SQL**

Este archivo ha sido reemplazado por una nueva estructura SQL más completa y organizada.

## 📁 Nuevos Archivos Recomendados

### Para crear la base de datos completa:
- **`docs/sql/bootstrap_full.sql`** - Esquema completo de la base de datos
- **`docs/sql/seed_full.sql`** - Datos de ejemplo y prueba

### Ventajas de los nuevos archivos:
- ✅ Estructura más organizada y comentada
- ✅ Incluye todas las funciones RPC actualizadas
- ✅ Políticas RLS completas y seguras
- ✅ Datos de ejemplo más realistas
- ✅ Indexes para mejor rendimiento
- ✅ Triggers opcionales para `updated_at`

## 🚀 Cómo usar los nuevos archivos

```sql
-- 1. Ejecutar primero el bootstrap (esquema)
\i docs/sql/bootstrap_full.sql

-- 2. Ejecutar después el seed (datos)
\i docs/sql/seed_full.sql
```

---

## 📋 Contenido Legacy Original

-- =========================================================
-- Bootstrap Tu Mesa Ideal (tablas + políticas + RPC + seed)
-- Seguro de re-ejecutar (idempotente)
-- =========================================================

-- ---------- Extensiones ----------
create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------- Tipos ----------
do $$ begin
  create type reservation_status as enum ('pending','confirmed','cancelled','no_show','seated','completed');
exception when duplicate_object then null; end $$;

-- ---------- Limpiar funciones antiguas (si existían) ----------
drop function if exists public.get_available_time_slots(date,int,int);
drop function if exists public.create_reservation_with_assignment(bigint,date,time,int,text,int);

-- ---------- Tablas ----------
create table if not exists public.restaurant_config (
  id bigserial primary key,
  is_active boolean not null default true,
  restaurant_name text,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  logo_url text,
  contact_phone text,
  contact_email text,
  contact_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_active_config
  on public.restaurant_config (is_active) where is_active;

create table if not exists public.restaurant_schedules (
  id bigserial primary key,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=domingo
  opening_time time not null,
  closing_time time not null,
  is_active boolean not null default true,
  constraint chk_time_range check (closing_time > opening_time)
);

create table if not exists public.tables (
  id bigserial primary key,
  name text not null,
  capacity int not null check (capacity > 0),
  is_active boolean not null default true,
  constraint tables_name_unique unique(name)
);

create table if not exists public.customers (
  id bigserial primary key,
  name text,
  email citext unique,
  phone text,
  created_at timestamptz not null default now()
);
create unique index if not exists customers_email_lower on public.customers (lower(email));

create table if not exists public.reservations (
  id bigserial primary key,
  customer_id bigint not null references public.customers(id) on delete cascade,
  date date not null,
  time time not null,
  guests int not null check (guests > 0),
  status reservation_status not null default 'pending',
  duration_minutes int not null default 90,
  special_requests text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reservations_date_idx on public.reservations(date);
create index if not exists reservations_status_idx on public.reservations(status);

create table if not exists public.reservation_tables (
  reservation_id bigint not null references public.reservations(id) on delete cascade,
  table_id bigint not null references public.tables(id),
  primary key (reservation_id, table_id)
);
create index if not exists reservation_tables_table_idx on public.reservation_tables(table_id);

-- Vinculado a auth.users (Supabase)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff','customer')) default 'customer',
  created_at timestamptz not null default now()
);

-- ---------- Trigger updated_at ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now(); return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_touch_reservations') then
    create trigger trg_touch_reservations
      before update on public.reservations
      for each row execute function public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_touch_config') then
    create trigger trg_touch_config
      before update on public.restaurant_config
      for each row execute function public.touch_updated_at();
  end if;
end $$;

-- ---------- RLS ----------
alter table public.restaurant_config enable row level security;
alter table public.restaurant_schedules enable row level security;
alter table public.tables enable row level security;
alter table public.customers enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_tables enable row level security;
alter table public.profiles enable row level security;

-- Lectura pública
drop policy if exists pub_read_config on public.restaurant_config;
create policy pub_read_config on public.restaurant_config for select using (true);

drop policy if exists pub_read_schedules on public.restaurant_schedules;
create policy pub_read_schedules on public.restaurant_schedules for select using (true);

drop policy if exists pub_read_tables on public.tables;
create policy pub_read_tables on public.tables for select using (true);

-- Customers: insert/select público
drop policy if exists pub_customers_insert on public.customers;
create policy pub_customers_insert on public.customers for insert with check (true);

drop policy if exists pub_customers_select on public.customers;
create policy pub_customers_select on public.customers for select using (true);

-- Reservations: insert/select público (la asignación la hace una RPC con definer)
drop policy if exists pub_reservations_insert on public.reservations;
create policy pub_reservations_insert on public.reservations for insert with check (true);

drop policy if exists pub_reservations_select on public.reservations;
create policy pub_reservations_select on public.reservations for select using (true);

-- reservation_tables: select/insert público (lo usa la RPC)
drop policy if exists pub_res_tables_select on public.reservation_tables;
create policy pub_res_tables_select on public.reservation_tables for select using (true);

drop policy if exists pub_res_tables_insert on public.reservation_tables;
create policy pub_res_tables_insert on public.reservation_tables for insert with check (true);

-- Profiles: solo el dueño
drop policy if exists me_select_profile on public.profiles;
create policy me_select_profile on public.profiles
  for select using (auth.uid() = id);

-- ---------- RPC: slots disponibles ----------
create or replace function public.get_available_time_slots(
  p_date date,
  p_guests int,
  p_duration_minutes int default 90
)
returns table (id int, slot_time time, capacity int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot   interval := '30 minutes';
  v_open   time;
  v_close  time;
  v_idx    int := 0;
  v_cap    int;
  rec      record;
begin
  select coalesce(max(capacity), 0)
    into v_cap
  from public.tables
  where is_active;

  for rec in
    select opening_time, closing_time
      from public.restaurant_schedules
     where is_active
       and day_of_week = extract(dow from p_date)::int
  loop
    v_open  := rec.opening_time;
    v_close := rec.closing_time;

    while v_open + make_interval(mins => p_duration_minutes) <= v_close loop
      if exists (
        select 1
          from public.tables t
         where t.is_active
           and t.capacity >= p_guests
           and not exists (
             select 1
               from public.reservation_tables rt
               join public.reservations r on r.id = rt.reservation_id
              where rt.table_id = t.id
                and r.date = p_date
                and r.status in ('pending','confirmed')
                and tstzrange(
                      (p_date::timestamptz + v_open),
                      (p_date::timestamptz + v_open + (p_duration_minutes || ' minutes')::interval),
                      '[)'
                    )
                    && tstzrange(
                      (r.date::timestamptz + r.time),
                      (r.date::timestamptz + r.time + (r.duration_minutes || ' minutes')::interval),
                      '[)'
                    )
           )
      ) then
        v_idx := v_idx + 1;
        -- Asignar columnas OUT y devolver la fila
        id        := v_idx;
        slot_time := v_open;
        capacity  := v_cap;
        return next;
      end if;

      v_open := v_open + v_slot;
    end loop;
  end loop;
end $$;

grant execute on function public.get_available_time_slots(date,int,int) to anon, authenticated;

-- ---------- RPC: crear reserva y asignar mesa ----------
create or replace function public.create_reservation_with_assignment(
  p_customer_id bigint,
  p_date date,
  p_time time,
  p_guests int,
  p_special_requests text default null,
  p_duration_minutes int default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id bigint;
  v_res_id   bigint;
begin
  select t.id
    into v_table_id
    from public.tables t
   where t.is_active
     and t.capacity >= p_guests
     and not exists (
       select 1
         from public.reservation_tables rt
         join public.reservations r on r.id = rt.reservation_id
        where rt.table_id = t.id
          and r.date = p_date
          and r.status in ('pending','confirmed')
          and tstzrange(
                (p_date::timestamptz + p_time),
                (p_date::timestamptz + p_time + (p_duration_minutes || ' minutes')::interval),
                '[)'
              )
              && tstzrange(
                (r.date::timestamptz + r.time),
                (r.date::timestamptz + r.time + (r.duration_minutes || ' minutes')::interval),
                '[)'
              )
     )
   order by t.capacity asc
   limit 1;

  if v_table_id is null then
    return jsonb_build_object('success', false, 'error', 'No hay mesas disponibles para esa franja');
  end if;

  insert into public.reservations(customer_id, date, time, guests, status, duration_minutes, special_requests)
  values (p_customer_id, p_date, p_time, p_guests, 'confirmed', p_duration_minutes, p_special_requests)
  returning id into v_res_id;

  insert into public.reservation_tables(reservation_id, table_id)
  values (v_res_id, v_table_id);

  return jsonb_build_object('success', true, 'reservation_id', v_res_id);
end $$;

grant execute on function public.create_reservation_with_assignment(bigint,date,time,int,text,int) to anon, authenticated;

-- ---------- Seed mínimo ----------
-- Config (una sola fila activa)
insert into public.restaurant_config (is_active, restaurant_name, hero_title, hero_subtitle, hero_image_url, contact_phone, contact_email, contact_address)
select true, 'Restaurante Élite', 'RESERVA TU MESA AQUÍ', 'Gridded Agency Project', null,
       '+34 600 000 000', 'info@restaurante.com', 'Calle Principal 123, Madrid'
where not exists (select 1 from public.restaurant_config where is_active);

-- Horarios: dos turnos todos los días (13-16 y 19-23)
do $$
declare d int;
begin
  for d in 0..6 loop
    insert into public.restaurant_schedules(day_of_week, opening_time, closing_time, is_active)
    select d, '13:00'::time, '16:00'::time, true
    where not exists (
      select 1 from public.restaurant_schedules
      where day_of_week=d and opening_time='13:00' and closing_time='16:00'
    );

    insert into public.restaurant_schedules(day_of_week, opening_time, closing_time, is_active)
    select d, '19:00'::time, '23:00'::time, true
    where not exists (
      select 1 from public.restaurant_schedules
      where day_of_week=d and opening_time='19:00' and closing_time='23:00'
    );
  end loop;
end $$;

-- Mesas: 2x2pax, 2x4pax, 1x6pax
insert into public.tables(name, capacity, is_active)
values ('Mesa 1',2,true),('Mesa 2',2,true),('Mesa 3',4,true),('Mesa 4',4,true),('Mesa 5',6,true)
on conflict (name) do nothing;
