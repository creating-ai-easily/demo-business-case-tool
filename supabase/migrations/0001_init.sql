-- Business Case Builder — initial schema
-- Matches Production Spec §4. Run once against the "Business Use Case Tool"
-- Supabase project (EU / Frankfurt region), e.g. via the SQL editor or
-- `supabase db push`.

create extension if not exists "uuid-ossp";

create type prospect_status as enum ('open', 'won', 'lost');

-- ── Templates ──────────────────────────────────────────────
-- Global (not owner-scoped): there is only one user today. Used only to
-- seed a new prospect — editing a prospect never touches its template.
create table use_case_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  industry text,
  use_case_title text not null,
  use_case_description text,
  default_hourly_rate numeric(10,2) default 0,
  default_investment_one_time numeric(10,2) default 0,
  default_investment_recurring numeric(10,2) default 0,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table template_steps (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references use_case_templates(id) on delete cascade,
  name text not null,
  hours_without numeric(6,2) default 0,
  hours_with numeric(6,2) default 0,
  sort_order int default 0
);

create table template_risks (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references use_case_templates(id) on delete cascade,
  name text not null,
  mitigation text,
  sort_order int default 0
);

create table template_roadmap (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references use_case_templates(id) on delete cascade,
  phase_label text,
  title text,
  duration text,
  description text,
  sort_order int default 0
);

-- ── Prospects (live business cases) ───────────────────────
create table prospects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) default auth.uid(),
  template_id uuid references use_case_templates(id),
  company_name text,
  industry text,
  contact_name text,
  contact_email text,
  conversation_date date default current_date,
  use_case_title text,
  use_case_description text,
  hourly_rate numeric(10,2) default 0,
  investment_one_time numeric(10,2) default 0,
  investment_recurring numeric(10,2) default 0,
  next_step text,
  status prospect_status default 'open',
  notion_page_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table process_steps (
  id uuid primary key default uuid_generate_v4(),
  prospect_id uuid references prospects(id) on delete cascade,
  name text not null,
  hours_without numeric(6,2) default 0,
  hours_with numeric(6,2) default 0,
  sort_order int default 0
);

create table risks (
  id uuid primary key default uuid_generate_v4(),
  prospect_id uuid references prospects(id) on delete cascade,
  name text not null,
  mitigation text,
  discussed boolean default false,
  sort_order int default 0
);

create table roadmap_phases (
  id uuid primary key default uuid_generate_v4(),
  prospect_id uuid references prospects(id) on delete cascade,
  phase_label text,
  title text,
  duration text,
  description text,
  sort_order int default 0
);

-- ── updated_at maintenance ─────────────────────────────────
-- Dashboard sort ("most recently updated") and autosave status both rely
-- on prospects.updated_at advancing on every write, including writes to
-- child rows (a step/risk/roadmap edit counts as updating the prospect).
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger prospects_set_updated_at
  before update on prospects
  for each row execute function set_updated_at();

create trigger templates_set_updated_at
  before update on use_case_templates
  for each row execute function set_updated_at();

create or replace function touch_prospect_updated_at()
returns trigger as $$
begin
  update prospects
    set updated_at = now()
    where id = coalesce(new.prospect_id, old.prospect_id);
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger process_steps_touch_prospect
  after insert or update or delete on process_steps
  for each row execute function touch_prospect_updated_at();

create trigger risks_touch_prospect
  after insert or update or delete on risks
  for each row execute function touch_prospect_updated_at();

create trigger roadmap_phases_touch_prospect
  after insert or update or delete on roadmap_phases
  for each row execute function touch_prospect_updated_at();

-- ── Row Level Security ─────────────────────────────────────
alter table prospects enable row level security;
alter table process_steps enable row level security;
alter table risks enable row level security;
alter table roadmap_phases enable row level security;
alter table use_case_templates enable row level security;
alter table template_steps enable row level security;
alter table template_risks enable row level security;
alter table template_roadmap enable row level security;

create policy "owner can access own prospects"
on prospects for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owner can access own steps"
on process_steps for all
using (exists (
  select 1 from prospects
  where prospects.id = process_steps.prospect_id
  and prospects.owner_id = auth.uid()
))
with check (exists (
  select 1 from prospects
  where prospects.id = process_steps.prospect_id
  and prospects.owner_id = auth.uid()
));

create policy "owner can access own risks"
on risks for all
using (exists (
  select 1 from prospects
  where prospects.id = risks.prospect_id
  and prospects.owner_id = auth.uid()
))
with check (exists (
  select 1 from prospects
  where prospects.id = risks.prospect_id
  and prospects.owner_id = auth.uid()
));

create policy "owner can access own roadmap phases"
on roadmap_phases for all
using (exists (
  select 1 from prospects
  where prospects.id = roadmap_phases.prospect_id
  and prospects.owner_id = auth.uid()
))
with check (exists (
  select 1 from prospects
  where prospects.id = roadmap_phases.prospect_id
  and prospects.owner_id = auth.uid()
));

-- Templates are global — any authenticated user (there is exactly one)
-- may read and manage them. No public/anon access.
create policy "authenticated users can access templates"
on use_case_templates for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated users can access template steps"
on template_steps for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated users can access template risks"
on template_risks for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated users can access template roadmap"
on template_roadmap for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- ── Indexes for the access patterns in spec §4 ─────────────
create index prospects_owner_updated_idx on prospects (owner_id, updated_at desc);
create index prospects_status_idx on prospects (status);
create index process_steps_prospect_idx on process_steps (prospect_id, sort_order);
create index risks_prospect_idx on risks (prospect_id, sort_order);
create index roadmap_phases_prospect_idx on roadmap_phases (prospect_id, sort_order);
create index template_steps_template_idx on template_steps (template_id, sort_order);
create index template_risks_template_idx on template_risks (template_id, sort_order);
create index template_roadmap_template_idx on template_roadmap (template_id, sort_order);
