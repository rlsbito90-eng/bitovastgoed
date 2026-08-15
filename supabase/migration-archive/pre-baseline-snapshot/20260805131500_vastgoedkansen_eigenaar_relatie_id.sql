-- BUILD Bundel 1 / stap 2
-- Persistente, expliciete koppeling tussen een Vastgoedkans en een bestaande CRM-relatie.
-- Deze migratie wordt uitsluitend via het gecontroleerde deploymentpad uitgevoerd.

alter table public.vastgoedkansen
  add column if not exists eigenaar_relatie_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vastgoedkansen_eigenaar_relatie_id_fkey'
      and conrelid = 'public.vastgoedkansen'::regclass
  ) then
    alter table public.vastgoedkansen
      add constraint vastgoedkansen_eigenaar_relatie_id_fkey
      foreign key (eigenaar_relatie_id)
      references public.relaties(id)
      on update restrict
      on delete set null;
  end if;
end
$$;

create index if not exists vastgoedkansen_eigenaar_relatie_id_idx
  on public.vastgoedkansen (eigenaar_relatie_id)
  where eigenaar_relatie_id is not null;

comment on column public.vastgoedkansen.eigenaar_relatie_id is
  'Door een gebruiker expliciet bevestigde koppeling naar een bestaande CRM-relatie. Naamovereenkomsten mogen dit veld nooit automatisch vullen.';
