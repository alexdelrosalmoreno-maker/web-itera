create extension if not exists pgcrypto;

-- Safe migration: works whether the tables are new or already existed.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid()
);

alter table public.leads add column if not exists session_id text;
alter table public.leads add column if not exists nombre text;
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists telefono text;
alter table public.leads add column if not exists empresa text;
alter table public.leads add column if not exists cargo text;
alter table public.leads add column if not exists necesidad text;
alter table public.leads add column if not exists servicio_interes text;
alter table public.leads add column if not exists presupuesto text;
alter table public.leads add column if not exists urgencia text;
alter table public.leads add column if not exists tamano_empresa text;
alter table public.leads add column if not exists estado_lead text default 'nuevo';
alter table public.leads add column if not exists lead_score integer default 0;
alter table public.leads add column if not exists resumen text;
alter table public.leads add column if not exists source text;
alter table public.leads add column if not exists page text;
alter table public.leads add column if not exists url text;
alter table public.leads add column if not exists referrer text;
alter table public.leads add column if not exists utm jsonb default '{}'::jsonb;
alter table public.leads add column if not exists calculator jsonb default '{}'::jsonb;
alter table public.leads add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.leads add column if not exists created_at timestamptz not null default now();
alter table public.leads add column if not exists updated_at timestamptz not null default now();

create table if not exists public.conversaciones (
  id uuid primary key default gen_random_uuid()
);

alter table public.conversaciones add column if not exists session_id text;
alter table public.conversaciones add column if not exists lead_id uuid;
alter table public.conversaciones add column if not exists role text;
alter table public.conversaciones add column if not exists mensaje text;
alter table public.conversaciones add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.conversaciones add column if not exists created_at timestamptz not null default now();

update public.conversaciones set session_id = 'legacy_' || id::text where session_id is null;
update public.conversaciones set role = 'user' where role is null;
update public.conversaciones set mensaje = '' where mensaje is null;

alter table public.conversaciones
  alter column session_id set not null,
  alter column role set not null,
  alter column mensaje set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversaciones_role_check'
      and conrelid = 'public.conversaciones'::regclass
  ) then
    alter table public.conversaciones
      add constraint conversaciones_role_check
      check (role in ('user', 'assistant', 'system'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversaciones_lead_id_fkey'
      and conrelid = 'public.conversaciones'::regclass
  ) then
    alter table public.conversaciones
      add constraint conversaciones_lead_id_fkey
      foreign key (lead_id)
      references public.leads(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists leads_session_id_idx on public.leads(session_id);
create index if not exists leads_email_idx on public.leads(email);
create index if not exists leads_estado_idx on public.leads(estado_lead);
create index if not exists conversaciones_session_id_idx on public.conversaciones(session_id);
create index if not exists conversaciones_created_at_idx on public.conversaciones(created_at);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.conversaciones enable row level security;

-- n8n should use the Supabase service role credential. Keep public browser access disabled.
