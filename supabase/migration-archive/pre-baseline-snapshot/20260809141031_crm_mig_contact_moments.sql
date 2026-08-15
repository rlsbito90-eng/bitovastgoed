do $$ begin
  create type public.contact_moment_type as enum ('telefoon','email','whatsapp','linkedin','afspraak','bezichtiging','notitie','document_gedeeld','teaser_verstuurd','nda_verstuurd','nda_ontvangen','informatie_gedeeld','bod_ontvangen','bod_uitgebracht','status_gewijzigd','taak_aangemaakt','taak_afgerond','kandidaat_toegevoegd','archief','algemeen');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contact_moment_direction as enum ('inkomend','uitgaand','intern','n_v_t');
exception when duplicate_object then null; end $$;
create table if not exists public.contact_moments (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  moment_date date not null default current_date, moment_time time without time zone,
  type public.contact_moment_type not null default 'algemeen', direction public.contact_moment_direction not null default 'n_v_t',
  title text not null, description text, outcome text, follow_up_required boolean not null default false, follow_up_date date,
  relatie_id uuid, object_id uuid, deal_id uuid, acquisitie_target_id uuid, taak_id uuid,
  is_system boolean not null default false, system_key text, aangemaakt_door uuid
);
create index if not exists idx_contact_moments_relatie on public.contact_moments(relatie_id) where relatie_id is not null;
create index if not exists idx_contact_moments_object on public.contact_moments(object_id) where object_id is not null;
create index if not exists idx_contact_moments_deal on public.contact_moments(deal_id) where deal_id is not null;
create index if not exists idx_contact_moments_acq on public.contact_moments(acquisitie_target_id) where acquisitie_target_id is not null;
create index if not exists idx_contact_moments_taak on public.contact_moments(taak_id) where taak_id is not null;
create index if not exists idx_contact_moments_date_desc on public.contact_moments(moment_date desc, created_at desc);
create unique index if not exists uq_contact_moments_system_key on public.contact_moments(system_key) where system_key is not null;
alter table public.contact_moments enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='contact_moments' and policyname='Intern leest contact_moments') then create policy "Intern leest contact_moments" on public.contact_moments for select to authenticated using (public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='contact_moments' and policyname='Intern voegt contact_moments toe') then create policy "Intern voegt contact_moments toe" on public.contact_moments for insert to authenticated with check (public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='contact_moments' and policyname='Intern wijzigt contact_moments') then create policy "Intern wijzigt contact_moments" on public.contact_moments for update to authenticated using (public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='contact_moments' and policyname='Intern verwijdert contact_moments') then create policy "Intern verwijdert contact_moments" on public.contact_moments for delete to authenticated using (public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_trigger where tgname='trg_contact_moments_updated_at' and not tgisinternal) then create trigger trg_contact_moments_updated_at before update on public.contact_moments for each row execute function public.update_updated_at_column(); end if;
end $$;