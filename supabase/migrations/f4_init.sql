-- F4: Supabase init — profiles / favoritos / alertas
-- Correr entera en SQL Editor del dashboard (Supabase → SQL editor → pegar → Run).
-- Idempotencia básica: crea si no existe; las policies se reemplazan.

-- ================= 1. PROFILES =================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

-- Trigger: cada usuario nuevo → fila en profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles: leer propio" on public.profiles;
create policy "profiles: leer propio"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles: editar propio" on public.profiles;
create policy "profiles: editar propio"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ================= 2. FAVORITOS =================
create table if not exists public.favoritos (
  user_id    uuid not null references auth.users (id) on delete cascade,
  ean        text not null check (ean ~ '^\d{13}$'),
  sucursal_pref text,                        -- id sucursal SEPA opcional (dim_sucursal)
  created_at timestamptz not null default now(),
  primary key (user_id, ean)
);

alter table public.favoritos enable row level security;

drop policy if exists "favoritos: CRUD propio" on public.favoritos;
create policy "favoritos: CRUD propio"
  on public.favoritos for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists favoritos_ean_idx on public.favoritos (ean);

-- ================= 3. ALERTAS =================
-- Patrón CamelCamelCamel: avisar cuando la mediana del EAN baja del precio_meta
-- (tipo 'meta') o cuando baja respecto del precio al crear la alerta (tipo 'baja').
create table if not exists public.alertas (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  ean             text not null check (ean ~ '^\d{13}$'),
  tipo            text not null default 'meta' check (tipo in ('meta', 'baja')),
  precio_meta     numeric(10, 2),             -- requerido si tipo = 'meta'
  precio_ref      numeric(10, 2),             -- snapshot del precio al crear (tipo 'baja')
  provincia       text,                       -- ISO SEPA ej. 'AR-T'; null = nacional
  sucursal_id     text,                       -- opcional: alerta de esa sucursal puntual
  activa          boolean not null default true,
  last_notified_at timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.alertas enable row level security;

drop policy if exists "alertas: CRUD propio" on public.alertas;
create policy "alertas: CRUD propio"
  on public.alertas for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists alertas_activas_idx on public.alertas (activa) where activa;
create index if not exists alertas_ean_idx on public.alertas (ean);

-- Validación: tipo 'meta' exige precio_meta, tipo 'baja' exige precio_ref
alter table public.alertas
  drop constraint if exists alertas_check_precio;
alter table public.alertas
  add constraint alertas_check_precio check (
    (tipo = 'meta' and precio_meta is not null)
    or (tipo = 'baja' and precio_ref is not null)
  );

-- ================= 4. VERIFICACIÓN =================
-- Debería devolver: profiles | favoritos | alertas
select tablename from pg_tables
where schemaname = 'public' and tablename in ('profiles', 'favoritos', 'alertas')
order by tablename;
