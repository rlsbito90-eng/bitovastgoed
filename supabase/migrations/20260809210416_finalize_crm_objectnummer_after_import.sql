alter table public.objecten alter column crm_objectnummer set default public.next_crm_objectnummer();
alter sequence public.crm_objectnummer_seq owned by public.objecten.crm_objectnummer;
select setval('public.crm_objectnummer_seq',33,true);

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.objecten'::regclass and conname='objecten_crm_objectnummer_format_check') then
    alter table public.objecten add constraint objecten_crm_objectnummer_format_check check (crm_objectnummer ~ '^OBJ-[0-9]{6,}$');
  end if;
end $$;
create unique index if not exists objecten_crm_objectnummer_key on public.objecten(crm_objectnummer);
alter table public.objecten alter column crm_objectnummer set not null;

drop trigger if exists objecten_crm_objectnummer_immutable on public.objecten;
create trigger objecten_crm_objectnummer_immutable before update of crm_objectnummer on public.objecten for each row execute function public.prevent_crm_objectnummer_update();
comment on column public.objecten.crm_objectnummer is 'Blijvend, app-breed leesbaar CRM-objectnummer; onafhankelijk van adres, assettype en externe bronidentifiers.';