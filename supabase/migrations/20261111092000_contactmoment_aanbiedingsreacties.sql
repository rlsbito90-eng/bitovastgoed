-- Matching 3.0 — structured feedback on offers, on the EXISTING contact
-- timeline record. No parallel match/pipeline table is introduced.
-- Inherits contact_moments RLS (including internal user authorization).
alter table public.contact_moments
  add column if not exists aanbieding_reactie jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint
      where conrelid='public.contact_moments'::regclass
        and conname='contact_moments_aanbieding_reactie_shape_check') then
    alter table public.contact_moments
      add constraint contact_moments_aanbieding_reactie_shape_check
      check (
        aanbieding_reactie is null or (
          jsonb_typeof(aanbieding_reactie)='object'
          and aanbieding_reactie->>'versie'='1'
          and aanbieding_reactie->>'status' in (
            'interesse','informatie_gevraagd','afgewezen','geen_reactie'
          )
          and aanbieding_reactie->>'duiding' in ('koper','object','onbekend')
          and jsonb_typeof(aanbieding_reactie->'redenen')='array'
          and jsonb_array_length(aanbieding_reactie->'redenen') <= 5
          -- Alleen erkende codes, zodat dashboards één stabiele taxonomie gebruiken.
          and (aanbieding_reactie->'redenen') <@
            '["prijs","rendement","locatie","vastgoedtype","oppervlakte",
               "verhuur","onderhoud","financiering","vergunningen","risico",
               "timing","documentatie","voorwaarden","anders"]'::jsonb
          -- Een afwijzing moet altijd een categorie hebben voor latere analyse.
          and (aanbieding_reactie->>'status'<>'afgewezen'
            or jsonb_array_length(aanbieding_reactie->'redenen')>0)
          -- 'Anders' mag niet in een vrije, ongestructureerde categorie verdwijnen.
          -- Een toelichting is verplicht, maar telt nooit als automatisch
          -- nieuwe categorie in dashboards.
          and (not coalesce(aanbieding_reactie->'redenen' ? 'anders',false)
            or (
              jsonb_typeof(aanbieding_reactie->'andereReden')='string'
              and length(btrim(aanbieding_reactie->>'andereReden')) between 1 and 500
            ))
          and (aanbieding_reactie->>'status'<>'geen_reactie'
            or (
              jsonb_array_length(aanbieding_reactie->'redenen')=0
              and aanbieding_reactie->>'duiding'='onbekend'
            ))
          and (aanbieding_reactie->>'kanaal') in (
            'email','whatsapp','telefoon','linkedin','persoonlijk','anders'
          )
        )
      );
  end if;
end $$;

comment on column public.contact_moments.aanbieding_reactie is
  'Gestructureerde, handmatig vastgelegde koperfeedback op een aanbieding; versie 1. Geen automatisch profielwijzigingsbesluit.';
