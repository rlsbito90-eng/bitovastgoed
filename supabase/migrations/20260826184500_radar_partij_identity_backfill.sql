-- Backfill stabiele Radar-partijen uit bestaande briefhistorie.
-- Alleen naam/bedrijfsnaam + volledig NL-postadres geldt als sterke identiteit.
-- Naam-only, gedeelde bestuurder/holding of gelijkende juridische naam wordt niet samengevoegd.

with sterke_geadresseerden as (
  select distinct on (b.geadresseerde_key)
    b.geadresseerde_key,
    nullif(trim(b.eigenaar_naam), '') as eigenaar_naam,
    nullif(trim(b.eigenaar_bedrijfsnaam), '') as eigenaar_bedrijfsnaam,
    nullif(trim(b.verzendadres), '') as verzendadres,
    upper((regexp_match(b.verzendadres, '(\d{4})\s*([A-Za-z]{2})'))[1] || ' ' ||
          (regexp_match(b.verzendadres, '(\d{4})\s*([A-Za-z]{2})'))[2]) as postcode
  from public.off_market_brieven b
  where b.archived_at is null
    and nullif(trim(b.geadresseerde_key), '') is not null
    and (nullif(trim(b.eigenaar_naam), '') is not null or nullif(trim(b.eigenaar_bedrijfsnaam), '') is not null)
    and nullif(trim(b.verzendadres), '') is not null
    and b.verzendadres ~* '\d{4}\s*[A-Za-z]{2}'
  order by b.geadresseerde_key, b.updated_at desc nulls last, b.created_at desc
)
insert into public.eigenaren (
  partij_type, naam, bedrijfsnaam, adres, postcode,
  bron, bron_betrouwbaarheid, dedupe_sleutel, bron_details
)
select
  case when sg.eigenaar_bedrijfsnaam is not null then 'rechtspersoon'
       when sg.eigenaar_naam is not null then 'natuurlijk_persoon'
       else 'onbekend' end,
  coalesce(sg.eigenaar_bedrijfsnaam, sg.eigenaar_naam, 'Onbekende partij'),
  sg.eigenaar_bedrijfsnaam,
  sg.verzendadres,
  sg.postcode,
  'radar_briefadres',
  90,
  'radar_geadresseerde:' || sg.geadresseerde_key,
  jsonb_build_object('identity_basis', 'naam_of_bedrijfsnaam_plus_volledig_postadres', 'backfill', true)
from sterke_geadresseerden sg
where not exists (
  select 1 from public.eigenaren e
  where e.dedupe_sleutel = 'radar_geadresseerde:' || sg.geadresseerde_key
    and e.archived_at is null
);

-- Koppel ieder historisch Radar-signaal aan de sterke partij-identiteit van de
-- geadresseerde. Meerdere rechthebbenden bij één signaal blijven meerdere partijen.
insert into public.eigenaar_koppelingen (
  eigenaar_id, signaal_id, rol, bron, betrouwbaarheid
)
select distinct
  e.id,
  b.signaal_id,
  'rechthebbende',
  'radar_briefadres',
  90
from public.off_market_brieven b
join public.eigenaren e
  on e.dedupe_sleutel = 'radar_geadresseerde:' || b.geadresseerde_key
 and e.archived_at is null
where b.archived_at is null
  and b.signaal_id is not null
  and nullif(trim(b.geadresseerde_key), '') is not null
  and not exists (
    select 1 from public.eigenaar_koppelingen ek
    where ek.eigenaar_id = e.id and ek.signaal_id = b.signaal_id
  );

-- Bouw daarna uitsluitend uit de nu expliciete Radar-koppelingen een historische
-- campagne. Verstuurde brieven blijven immutable; dit voegt alleen context toe.
with partij_historie as (
  select
    ek.eigenaar_id,
    max(b.verzonden_op) filter (where b.status = 'verstuurd') as laatste_koude_contact_op,
    bool_or(b.status in ('concept','definitief')) as heeft_open_brief,
    bool_or(coalesce(b.responsstatus,'') in ('interesse','wil_meer_informatie','gesprek_gepland','reactie_ontvangen')) as warm,
    bool_or(coalesce(b.responsstatus,'') = 'niet_geinteresseerd') as niet_geinteresseerd,
    max(case b.campagne_stap
      when 'brief_3' then 3 when 'brief_2' then 2 when 'brief_1' then 1 else 0 end) as hoogste_stap
  from public.eigenaar_koppelingen ek
  join public.off_market_brieven b on b.signaal_id = ek.signaal_id and b.archived_at is null
  where ek.signaal_id is not null
    and ek.bron = 'radar_briefadres'
    and coalesce(ek.betrouwbaarheid, 0) >= 90
  group by ek.eigenaar_id
)
insert into public.off_market_benadercampagnes (
  eigenaar_id, doelstelling, status, contact_status, huidige_stap,
  laatste_koude_contact_op, herbenaderen_vanaf, cooldown_maanden, routing_reden
)
select
  ph.eigenaar_id,
  'radar_acquisitie',
  case when ph.warm then 'warm'
       when ph.heeft_open_brief then 'actief'
       when ph.laatste_koude_contact_op is not null then 'afgerond_geen_reactie'
       else 'actief' end,
  case when ph.warm then 'warm'
       when ph.niet_geinteresseerd then 'not_interested'
       else 'cold' end,
  case ph.hoogste_stap when 3 then 'brief_3' when 2 then 'brief_2' when 1 then 'brief_1' else null end,
  ph.laatste_koude_contact_op,
  case when ph.laatste_koude_contact_op is not null
    then (ph.laatste_koude_contact_op::date + interval '6 months')::date
    else null end,
  6,
  'Veilige backfill uit bestaande Radar-briefhistorie met sterke geadresseerde-identiteit.'
from partij_historie ph
where not exists (
  select 1 from public.off_market_benadercampagnes c
  where c.eigenaar_id = ph.eigenaar_id and c.doelstelling = 'radar_acquisitie'
);

with kandidaat_objecten as (
  select
    c.id as campagne_id,
    ek.signaal_id,
    max(b.verzonden_op) as laatste_verzending,
    row_number() over (
      partition by c.id
      order by max(b.verzonden_op) desc nulls last, ek.signaal_id
    ) as rn
  from public.off_market_benadercampagnes c
  join public.eigenaar_koppelingen ek on ek.eigenaar_id = c.eigenaar_id and ek.signaal_id is not null
  left join public.off_market_brieven b on b.signaal_id = ek.signaal_id and b.archived_at is null
  where c.doelstelling = 'radar_acquisitie'
    and ek.bron = 'radar_briefadres'
  group by c.id, ek.signaal_id
)
insert into public.off_market_campagne_objecten (
  campagne_id, signaal_id, rol, signaal_ids, reden_toevoeging, noemen_in_volgend_contact
)
select
  ko.campagne_id,
  ko.signaal_id,
  case when ko.rn = 1 then 'primary' else 'context' end,
  array[ko.signaal_id],
  'Veilige backfill uit bestaande Radar-briefhistorie.',
  false
from kandidaat_objecten ko
where not exists (
  select 1 from public.off_market_campagne_objecten co
  where co.campagne_id = ko.campagne_id and co.signaal_id = ko.signaal_id
);

insert into public.off_market_campagne_events (
  campagne_id, eigenaar_id, event_type, reden, metadata
)
select
  c.id,
  c.eigenaar_id,
  'history_backfilled',
  'Bestaande Radar-briefhistorie gekoppeld aan canonieke partij/campagne zonder historische brieven te wijzigen.',
  jsonb_build_object('source', 'radar_briefadres')
from public.off_market_benadercampagnes c
where c.doelstelling = 'radar_acquisitie'
  and not exists (
    select 1 from public.off_market_campagne_events ev
    where ev.campagne_id = c.id and ev.event_type = 'history_backfilled'
  );
