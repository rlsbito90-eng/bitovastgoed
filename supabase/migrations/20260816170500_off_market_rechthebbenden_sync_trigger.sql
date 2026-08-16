-- Persist the canonical acquisition addressees from the latest stored
-- Kadaster rights blocks whenever the owner extraction updates a signal.
--
-- This is intentionally derived from already stored Kadaster data only:
-- no external/Kadaster call is made here.

create or replace function public.sync_off_market_eigenaar_rechthebbenden_from_kadaster()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rechthebbenden jsonb;
begin
  if new.eigenaarbron is distinct from 'kadaster' then
    return new;
  end if;

  with latest_record as (
    select k.raw_limited
    from public.kadaster_data_records k
    where k.signaal_id = new.id
      and k.product_code = 'rechten'
      and k.status in ('geleverd', 'gedeeltelijk')
    order by k.fetched_at desc nulls last
    limit 1
  ), rechtenblokken as (
    select
      b.blok,
      b.ord,
      case
        when lower(coalesce(b.blok->>'omschrijving', '')) like '%erfpacht%' then 50
        when lower(coalesce(b.blok->>'omschrijving', '')) like '%opstal%' then 45
        when lower(coalesce(b.blok->>'omschrijving', '')) like '%appartementsrecht%' then 40
        when lower(coalesce(b.blok->>'omschrijving', '')) like '%eigendom%' then 30
        when lower(coalesce(b.blok->>'omschrijving', '')) like '%vruchtgebruik%' then 20
        else 1
      end as rang,
      coalesce(b.blok->'entities'->0, b.blok->'persons'->0) as partij,
      case
        when jsonb_typeof(b.blok->'entities') = 'array'
          and jsonb_array_length(b.blok->'entities') > 0
        then true else false
      end as is_rechtspersoon
    from latest_record r
    cross join lateral jsonb_array_elements(
      coalesce(r.raw_limited #> '{rechten,blokken}', '[]'::jsonb)
    ) with ordinality as b(blok, ord)
  ), primair as (
    select rb.*
    from rechtenblokken rb
    where rb.partij is not null
      and nullif(trim(rb.partij->>'naam'), '') is not null
      and rb.rang = (select max(rang) from rechtenblokken)
  ), genormaliseerd as (
    select
      p.*,
      coalesce(
        nullif(trim(p.partij->>'kvk'), ''),
        lower(regexp_replace(coalesce(p.partij->>'naam', ''), '[^[:alnum:]]+', '', 'g'))
      ) as partij_sleutel
    from primair p
  ), uniek as (
    select distinct on (partij_sleutel) *
    from genormaliseerd
    where nullif(partij_sleutel, '') is not null
    order by partij_sleutel, ord
  ), canoniek as (
    select
      u.ord,
      jsonb_build_object(
        'naam', case when u.is_rechtspersoon then null else nullif(trim(u.partij->>'naam'), '') end,
        'bedrijfsnaam', case when u.is_rechtspersoon then nullif(trim(u.partij->>'naam'), '') else null end,
        'kvk', nullif(trim(u.partij->>'kvk'), ''),
        'aandeel', nullif(trim(u.blok->>'aandeelInRecht'), ''),
        'rechtstype', nullif(trim(u.blok->>'omschrijving'), ''),
        'rechtssituatie', case
          when lower(coalesce(u.blok->>'omschrijving', '')) like '%erfpacht%' then 'erfpacht'
          when lower(coalesce(u.blok->>'omschrijving', '')) like '%opstal%' then 'opstal'
          when lower(coalesce(u.blok->>'omschrijving', '')) like '%appartementsrecht%' then 'appartementsrecht'
          when lower(coalesce(u.blok->>'omschrijving', '')) like '%eigendom%' then 'volle_eigendom'
          when lower(coalesce(u.blok->>'omschrijving', '')) like '%vruchtgebruik%' then 'vruchtgebruik'
          else 'overig'
        end,
        'straat_huisnummer', nullif(trim(concat_ws(' ',
          nullif(trim(u.partij #>> '{adres,straat}'), ''),
          nullif(trim(u.partij #>> '{adres,huisnummer}'), '')
        )), ''),
        'postcode', nullif(trim(u.partij #>> '{adres,postcode}'), ''),
        'plaats', nullif(trim(u.partij #>> '{adres,plaats}'), ''),
        'verzendadres', case
          when nullif(trim(concat_ws(' ',
                 nullif(trim(u.partij #>> '{adres,straat}'), ''),
                 nullif(trim(u.partij #>> '{adres,huisnummer}'), '')
               )), '') is not null
           and nullif(trim(u.partij #>> '{adres,postcode}'), '') is not null
           and nullif(trim(u.partij #>> '{adres,plaats}'), '') is not null
          then trim(concat_ws(' ',
                 nullif(trim(u.partij #>> '{adres,straat}'), ''),
                 nullif(trim(u.partij #>> '{adres,huisnummer}'), '')
               )) || chr(10) || trim(u.partij #>> '{adres,postcode}') || ' ' || trim(u.partij #>> '{adres,plaats}')
          else null
        end,
        'bron', 'kadaster'
      ) as rechthebbende
    from uniek u
  )
  select coalesce(jsonb_agg(c.rechthebbende order by c.ord), '[]'::jsonb)
  into v_rechthebbenden
  from canoniek c;

  -- Only replace the array when usable primary right holders were derived.
  -- If parsing produced no primary parties, keep the current value untouched.
  if jsonb_array_length(coalesce(v_rechthebbenden, '[]'::jsonb)) > 0 then
    new.eigenaar_rechthebbenden := v_rechthebbenden;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_off_market_eigenaar_rechthebbenden_from_kadaster
  on public.off_market_signalen;

create trigger trg_sync_off_market_eigenaar_rechthebbenden_from_kadaster
before update of
  eigenaarstatus,
  eigenaar_bekend,
  eigenaarbron,
  eigenaar_rechtstype,
  eigenaar_rechtssituatie,
  eigenaar_controle_nodig
on public.off_market_signalen
for each row
execute function public.sync_off_market_eigenaar_rechthebbenden_from_kadaster();
