-- BUILD 2.0B — eigenaaropvolging zonder verplichte CRM-relatie
-- Hergebruik de bestaande centrale contact_moments- en taken-tabellen.

alter table public.contact_moments
  add column if not exists eigenaar_id uuid references public.eigenaren(id) on delete set null,
  add column if not exists vastgoedkans_id uuid references public.vastgoedkansen(id) on delete set null;

alter table public.taken
  add column if not exists eigenaar_id uuid references public.eigenaren(id) on delete set null,
  add column if not exists vastgoedkans_id uuid references public.vastgoedkansen(id) on delete set null;

comment on column public.contact_moments.eigenaar_id is
  'Optionele koppeling naar een acquisitie-eigenaar; vereist geen CRM-relatie.';
comment on column public.contact_moments.vastgoedkans_id is
  'Optionele dossierkoppeling naar Vastgoedkansen.';
comment on column public.taken.eigenaar_id is
  'Optionele koppeling naar een acquisitie-eigenaar; vereist geen CRM-relatie.';
comment on column public.taken.vastgoedkans_id is
  'Optionele dossierkoppeling naar Vastgoedkansen.';

create index if not exists contact_moments_eigenaar_idx
  on public.contact_moments (eigenaar_id, moment_date desc)
  where eigenaar_id is not null;
create index if not exists contact_moments_vastgoedkans_idx
  on public.contact_moments (vastgoedkans_id, moment_date desc)
  where vastgoedkans_id is not null;
create index if not exists taken_eigenaar_idx
  on public.taken (eigenaar_id, deadline)
  where eigenaar_id is not null and soft_deleted_at is null;
create index if not exists taken_vastgoedkans_idx
  on public.taken (vastgoedkans_id, deadline)
  where vastgoedkans_id is not null and soft_deleted_at is null;
