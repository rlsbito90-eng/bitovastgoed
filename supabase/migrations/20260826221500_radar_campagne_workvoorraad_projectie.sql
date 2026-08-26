-- Projecteer de canonieke campagneobjectrol naar de dagelijkse Radar-werkvoorraad.
-- Doel:
--   * primary blijft zichtbaar als actieve werkeenheid;
--   * context verdwijnt uit de standaard Actief-lijst en blijft zichtbaar via Apart/Alles;
--   * expliciete zwaardere statussen (eerder_benaderd, benadering_bepalen, niet_benaderen) worden nooit overschreven.
--
-- Dit is een projectie, geen bronwaarheid: off_market_campagne_objecten.rol blijft leidend.

create or replace function public.projecteer_radar_campagneobject_naar_werkvoorraad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nieuwe_status text;
  v_reden text;
begin
  if new.signaal_id is null then
    return new;
  end if;

  if new.rol = 'context' then
    v_nieuwe_status := 'gebundeld_bij_partij';
    v_reden := 'Automatisch gebundeld: contextobject binnen dezelfde partijcampagne.';

    update public.off_market_acquisitie_selectie
       set werkvoorraad_status = v_nieuwe_status,
           werkvoorraad_reden = v_reden,
           werkvoorraad_volgende_actie_op = null,
           werkvoorraad_bijgewerkt_op = now(),
           werkvoorraad_bijgewerkt_door = auth.uid()
     where signaal_id = new.signaal_id
       and archived_at is null
       and coalesce(werkvoorraad_status, 'actief') = 'actief';

  elsif new.rol = 'primary' then
    -- Alleen een door de campagneprojectie gebundeld dossier terug naar Actief zetten.
    -- Andere expliciete statussen blijven onaangetast.
    v_nieuwe_status := 'actief';
    v_reden := null;

    update public.off_market_acquisitie_selectie
       set werkvoorraad_status = v_nieuwe_status,
           werkvoorraad_reden = v_reden,
           werkvoorraad_volgende_actie_op = null,
           werkvoorraad_bijgewerkt_op = now(),
           werkvoorraad_bijgewerkt_door = auth.uid()
     where signaal_id = new.signaal_id
       and archived_at is null
       and werkvoorraad_status = 'gebundeld_bij_partij'
       and coalesce(werkvoorraad_reden, '') in (
         'Automatisch gebundeld: contextobject binnen dezelfde partijcampagne.',
         'Gebundeld bij dezelfde partijcampagne; hoofdobject blijft actief.'
       );
  end if;

  return new;
end;
$$;

revoke all on function public.projecteer_radar_campagneobject_naar_werkvoorraad() from public;
revoke all on function public.projecteer_radar_campagneobject_naar_werkvoorraad() from anon;
revoke all on function public.projecteer_radar_campagneobject_naar_werkvoorraad() from authenticated;

-- Backfill: uitsluitend contextobjecten die nu nog Actief zijn.
-- Handmatig apart gezette dossiers en blokkades blijven onaangetast.
update public.off_market_acquisitie_selectie asi
   set werkvoorraad_status = 'gebundeld_bij_partij',
       werkvoorraad_reden = 'Automatisch gebundeld: contextobject binnen dezelfde partijcampagne.',
       werkvoorraad_volgende_actie_op = null,
       werkvoorraad_bijgewerkt_op = now(),
       werkvoorraad_bijgewerkt_door = auth.uid()
  from public.off_market_campagne_objecten co
 where co.signaal_id = asi.signaal_id
   and co.rol = 'context'
   and asi.archived_at is null
   and coalesce(asi.werkvoorraad_status, 'actief') = 'actief';

drop trigger if exists trg_projecteer_radar_campagneobject_werkvoorraad
  on public.off_market_campagne_objecten;

create trigger trg_projecteer_radar_campagneobject_werkvoorraad
after insert or update of rol, signaal_id
on public.off_market_campagne_objecten
for each row
execute function public.projecteer_radar_campagneobject_naar_werkvoorraad();
