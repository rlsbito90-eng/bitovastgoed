create table if not exists public.acquisitie_copy_varianten (
  id uuid primary key default gen_random_uuid(),
  profiel text not null,
  kanaal text not null check (kanaal in ('post', 'email')),
  campagne_stap text not null,
  variant_code text not null,
  naam text not null,
  hypothese text not null,
  template_key text not null default 'current_default',
  actief boolean not null default true,
  is_control boolean not null default false,
  gewicht integer not null default 100 check (gewicht > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profiel, kanaal, campagne_stap, variant_code)
);

alter table public.acquisitie_copy_varianten enable row level security;

drop policy if exists "authenticated_read_acquisitie_copy_varianten" on public.acquisitie_copy_varianten;
create policy "authenticated_read_acquisitie_copy_varianten"
  on public.acquisitie_copy_varianten
  for select
  to authenticated
  using (true);

alter table public.off_market_brieven
  add column if not exists copy_variant_id uuid references public.acquisitie_copy_varianten(id),
  add column if not exists copy_profiel text,
  add column if not exists copy_variant_key text,
  add column if not exists copy_variant_code text,
  add column if not exists copy_hypothese text;

comment on table public.acquisitie_copy_varianten is
  'Versiebeheer voor acquisitie-copy-experimenten. Varianten zijn per profiel, kanaal en touchpoint definieerbaar.';
comment on column public.off_market_brieven.copy_variant_id is
  'Toegewezen copyvariant. Wordt bij nieuw concept eenmalig en deterministisch vastgelegd.';
comment on column public.off_market_brieven.copy_profiel is
  'Genormaliseerd acquisitie-copyprofiel waarop de communicatie is gebaseerd.';
comment on column public.off_market_brieven.copy_variant_key is
  'Immutable meetidentiteit, bv woonvorming:post:brief_1:A.';
comment on column public.off_market_brieven.copy_variant_code is
  'Korte variantcode binnen een experiment, bv A/B/C/D.';
comment on column public.off_market_brieven.copy_hypothese is
  'Hypothese-snapshot van de variant op het moment van toewijzing.';

create index if not exists acquisitie_copy_varianten_lookup_idx
  on public.acquisitie_copy_varianten(profiel, kanaal, campagne_stap, actief);
create index if not exists off_market_brieven_copy_variant_key_idx
  on public.off_market_brieven(copy_variant_key)
  where copy_variant_key is not null;
create index if not exists off_market_brieven_copy_profiel_idx
  on public.off_market_brieven(copy_profiel)
  where copy_profiel is not null;

-- Startpositie: de huidige tekst blijft controlevariant A. Er wordt nog geen
-- inhoudelijke B-variant verzonnen. Claude-varianten worden later expliciet
-- als extra rij toegevoegd, met eigen hypothese en template_key.
with profielen(profiel) as (
  values
    ('splitsingspotentie'),
    ('kamerverhuur_verhuur_exploitatieoptimalisatie'),
    ('woonvorming'),
    ('transformatie_herontwikkeling'),
    ('ontwikkellocatie'),
    ('woon_winkelpand'),
    ('commercieel_vastgoed'),
    ('portefeuille'),
    ('algemene_acquisitie')
), stappen(kanaal, campagne_stap) as (
  values
    ('post', 'brief_1'), ('post', 'brief_2'), ('post', 'brief_3'),
    ('email', 'email_1'), ('email', 'email_2'), ('email', 'email_3')
)
insert into public.acquisitie_copy_varianten (
  profiel, kanaal, campagne_stap, variant_code, naam, hypothese,
  template_key, actief, is_control, gewicht
)
select
  p.profiel, s.kanaal, s.campagne_stap, 'A', 'Controle',
  'Huidige standaardtekst als controlevariant.',
  'current_default', true, true, 100
from profielen p cross join stappen s
on conflict (profiel, kanaal, campagne_stap, variant_code) do nothing;

create or replace function public.acquisitie_copy_profiel_v1(p_signaal_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when s.vergunningtype::text = 'splitsing'
      or lower(coalesce(s.potentiele_strategie::text, '')) like '%splits%'
      then 'splitsingspotentie'
    when s.vergunningtype::text = 'woonvorming'
      then 'woonvorming'
    when s.vergunningtype::text = 'omzetting'
      then 'kamerverhuur_verhuur_exploitatieoptimalisatie'
    when s.vergunningtype::text in ('transformatie', 'functiewijziging')
      or lower(coalesce(s.potentiele_strategie::text, '')) like '%transform%'
      or lower(coalesce(s.potentiele_strategie::text, '')) like '%herontwikk%'
      then 'transformatie_herontwikkeling'
    when s.vergunningtype::text = 'ontwikkeling'
      or s.assettype::text = 'ontwikkellocatie'
      then 'ontwikkellocatie'
    when s.assettype::text in ('woon_winkelpand', 'gemengd_vastgoed')
      then 'woon_winkelpand'
    when s.assettype::text = 'vastgoedportefeuille'
      or lower(coalesce(s.potentiele_strategie::text, '')) like '%portefeuille%'
      then 'portefeuille'
    when s.assettype::text in ('kantoor', 'winkelpand', 'bedrijfscomplex', 'light_industrial', 'logistiek')
      then 'commercieel_vastgoed'
    else 'algemene_acquisitie'
  end
  from public.off_market_signalen s
  where s.id = p_signaal_id;
$$;

create or replace function public.off_market_assign_copy_variant_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profiel text;
  v_kanaal text;
  v_stap text;
  v_totaal_gewicht bigint;
  v_pick bigint;
  v_seed text;
  v_variant public.acquisitie_copy_varianten%rowtype;
begin
  v_kanaal := coalesce(nullif(new.kanaal::text, ''), 'post');
  v_stap := coalesce(
    nullif(new.campagne_stap::text, ''),
    case when v_kanaal = 'email' then 'email_1' else 'brief_1' end
  );
  v_profiel := coalesce(nullif(new.copy_profiel, ''), public.acquisitie_copy_profiel_v1(new.signaal_id), 'algemene_acquisitie');

  -- Als de voorbereidingsflow al een variantcode heeft vastgelegd, koppel
  -- uitsluitend de canonieke variant-id; rol nooit opnieuw.
  if new.copy_variant_key is not null and new.copy_variant_code is not null then
    select v.* into v_variant
    from public.acquisitie_copy_varianten v
    where v.profiel = v_profiel
      and v.kanaal = v_kanaal
      and v.campagne_stap = v_stap
      and v.variant_code = new.copy_variant_code
    limit 1;

    if v_variant.id is not null then
      new.copy_variant_id := v_variant.id;
      new.copy_profiel := v_profiel;
      new.copy_hypothese := coalesce(new.copy_hypothese, v_variant.hypothese);
    end if;
    return new;
  end if;

  select coalesce(sum(v.gewicht), 0)
    into v_totaal_gewicht
  from public.acquisitie_copy_varianten v
  where v.profiel = v_profiel
    and v.kanaal = v_kanaal
    and v.campagne_stap = v_stap
    and v.actief = true;

  if v_totaal_gewicht <= 0 then
    return new;
  end if;

  v_seed := concat_ws('|', new.signaal_id::text, coalesce(new.geadresseerde_key, ''), v_kanaal, v_stap, v_profiel);
  v_pick := mod(abs(hashtext(v_seed)::bigint), v_totaal_gewicht);

  select
    q.id, q.profiel, q.kanaal, q.campagne_stap, q.variant_code,
    q.naam, q.hypothese, q.template_key, q.actief, q.is_control,
    q.gewicht, q.created_at, q.updated_at
  into v_variant
  from (
    select
      v.*,
      sum(v.gewicht) over (order by v.variant_code, v.id) as cumulatief
    from public.acquisitie_copy_varianten v
    where v.profiel = v_profiel
      and v.kanaal = v_kanaal
      and v.campagne_stap = v_stap
      and v.actief = true
  ) q
  where q.cumulatief > v_pick
  order by q.cumulatief
  limit 1;

  if v_variant.id is null then
    return new;
  end if;

  new.copy_variant_id := v_variant.id;
  new.copy_profiel := v_profiel;
  new.copy_variant_code := v_variant.variant_code;
  new.copy_variant_key := concat(v_profiel, ':', v_kanaal, ':', v_stap, ':', v_variant.variant_code);
  new.copy_hypothese := v_variant.hypothese;
  return new;
end;
$$;

drop trigger if exists trg_off_market_assign_copy_variant_v1 on public.off_market_brieven;
create trigger trg_off_market_assign_copy_variant_v1
before insert on public.off_market_brieven
for each row
execute function public.off_market_assign_copy_variant_v1();
