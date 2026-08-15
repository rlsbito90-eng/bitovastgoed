create or replace function public.vastgoedrekenen_bronpakket_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;

drop trigger if exists vastgoedrekenen_bronpakket_touch_updated_at on public.vastgoedrekenen_bronpakketten;
create trigger vastgoedrekenen_bronpakket_touch_updated_at before update on public.vastgoedrekenen_bronpakketten for each row execute function public.vastgoedrekenen_bronpakket_touch_updated_at();

create or replace function public.vastgoedrekenen_lock_bronpakket_metadata()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.system_managed or old.status <> 'concept' then raise exception 'Alleen een niet-systeembeheerd conceptbronpakket kan worden verwijderd.'; end if;
    return old;
  end if;
  if old.system_managed then
    if old.status = 'concept' and new.status = 'goedgekeurd' and (to_jsonb(new) - array['status','goedgekeurd_door','goedgekeurd_op','updated_at']) = (to_jsonb(old) - array['status','goedgekeurd_door','goedgekeurd_op','updated_at']) then return new; end if;
    raise exception 'Een systeembeheerd bronpakket kan niet handmatig worden gewijzigd of gearchiveerd.';
  end if;
  if old.status = 'goedgekeurd' then
    if new.status = 'gearchiveerd' and (to_jsonb(new) - array['status','updated_at']) = (to_jsonb(old) - array['status','updated_at']) then return new; end if;
    raise exception 'Een goedgekeurd bronpakket is onveranderlijk. Alleen archiveren zonder overige wijzigingen is toegestaan.';
  end if;
  if old.status = 'gearchiveerd' then raise exception 'Een gearchiveerd bronpakket blijft als historische bronversie onveranderlijk.'; end if;
  return new;
end; $$;

drop trigger if exists vastgoedrekenen_lock_bronpakket_metadata on public.vastgoedrekenen_bronpakketten;
create trigger vastgoedrekenen_lock_bronpakket_metadata before update or delete on public.vastgoedrekenen_bronpakketten for each row execute function public.vastgoedrekenen_lock_bronpakket_metadata();

create or replace function public.vastgoedrekenen_validate_bronpakket_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare linked_count integer; invalid_count integer;
begin
  if new.status <> 'goedgekeurd' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'goedgekeurd' then return new; end if;
  if nullif(btrim(new.code),'') is null or nullif(btrim(new.naam),'') is null or nullif(btrim(new.bron_type),'') is null or nullif(btrim(new.bron_naam),'') is null or nullif(btrim(coalesce(new.bron_referentie,'')),'') is null or new.prijspeildatum is null or new.geldig_vanaf is null or new.vervaldatum is null or nullif(btrim(coalesce(new.geografische_scope,'')),'') is null or nullif(btrim(coalesce(new.meetgrondslag,'')),'') is null or nullif(btrim(coalesce(new.scope_inclusief,'')),'') is null or nullif(btrim(coalesce(new.scope_exclusief,'')),'') is null or nullif(btrim(coalesce(new.indexeringsmethode,'')),'') is null then raise exception 'Bronpakket kan niet worden goedgekeurd: verplichte bron-, prijspeil- of scopevelden ontbreken.'; end if;
  if new.geldig_vanaf > new.vervaldatum or new.prijspeildatum > new.vervaldatum then raise exception 'Bronpakket kan niet worden goedgekeurd: datumvolgorde is ongeldig.'; end if;
  if not new.system_managed and new.goedgekeurd_door is null then raise exception 'Bronpakket kan niet worden goedgekeurd zonder beoordelaar.'; end if;
  select count(*) into linked_count from public.vastgoedrekenen_kengetallen k where k.bronpakket_id = new.id;
  if linked_count = 0 then raise exception 'Bronpakket kan niet worden goedgekeurd zonder gekoppelde kengetallen.'; end if;
  select count(*) into invalid_count from public.vastgoedrekenen_kengetallen k where k.bronpakket_id = new.id and (not k.actief or k.vervaldatum < current_date or k.unit_code is null or ((k.unit_code='eur' or left(k.unit_code,4)='eur_') and k.vat_treatment_code is null) or k.bron_type <> new.bron_type or btrim(k.bron_naam) <> btrim(new.bron_naam) or k.bron_peildatum <> new.prijspeildatum or k.geldig_vanaf is distinct from new.geldig_vanaf or k.vervaldatum <> new.vervaldatum);
  if invalid_count > 0 then raise exception 'Bronpakket kan niet worden goedgekeurd: % gekoppelde kengetallen zijn inactief, verlopen of inhoudelijk inconsistent.', invalid_count; end if;
  new.goedgekeurd_op := coalesce(new.goedgekeurd_op, now()); return new;
end; $$;

drop trigger if exists vastgoedrekenen_validate_bronpakket_approval on public.vastgoedrekenen_bronpakketten;
create trigger vastgoedrekenen_validate_bronpakket_approval before insert or update on public.vastgoedrekenen_bronpakketten for each row execute function public.vastgoedrekenen_validate_bronpakket_approval();

create or replace function public.vastgoedrekenen_lock_approved_package_entries()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_status text; new_status text;
begin
  if tg_op='DELETE' then if old.bronpakket_id is not null then select status into old_status from public.vastgoedrekenen_bronpakketten where id=old.bronpakket_id; if old_status='goedgekeurd' then raise exception 'Kengetal behoort tot een goedgekeurd bronpakket. Archiveer het pakket voordat de regel wordt verwijderd.'; end if; end if; return old; end if;
  if tg_op='INSERT' then if new.bronpakket_id is not null then select status into new_status from public.vastgoedrekenen_bronpakketten where id=new.bronpakket_id; if new_status='goedgekeurd' then raise exception 'Nieuwe regels kunnen niet aan een reeds goedgekeurd bronpakket worden gekoppeld.'; end if; end if; return new; end if;
  if old.bronpakket_id is not null then select status into old_status from public.vastgoedrekenen_bronpakketten where id=old.bronpakket_id; if old_status='goedgekeurd' then raise exception 'Kengetal behoort tot een goedgekeurd bronpakket. Archiveer het pakket voordat de regel wordt gewijzigd.'; end if; end if;
  if new.bronpakket_id is not null and new.bronpakket_id is distinct from old.bronpakket_id then select status into new_status from public.vastgoedrekenen_bronpakketten where id=new.bronpakket_id; if new_status='goedgekeurd' then raise exception 'Nieuwe regels kunnen niet aan een reeds goedgekeurd bronpakket worden gekoppeld.'; end if; end if;
  return new;
end; $$;

drop trigger if exists vastgoedrekenen_lock_approved_package_entries on public.vastgoedrekenen_kengetallen;
create trigger vastgoedrekenen_lock_approved_package_entries before insert or update or delete on public.vastgoedrekenen_kengetallen for each row execute function public.vastgoedrekenen_lock_approved_package_entries();

create or replace function public.vastgoedrekenen_snapshot_bronpakket()
returns trigger language plpgsql security definer set search_path = public as $$
declare linked_package_id uuid; package_payload jsonb;
begin
  if new.kengetal_id is null then return new; end if;
  if tg_op='INSERT' and new.bronpakket_snapshot is not null then return new; end if;
  select k.bronpakket_id, case when p.id is null then null else jsonb_build_object('id',p.id,'code',p.code,'versie',p.versie,'naam',p.naam,'bron_type',p.bron_type,'bron_naam',p.bron_naam,'bron_referentie',p.bron_referentie,'bron_versie',p.bron_versie,'prijspeildatum',p.prijspeildatum,'geldig_vanaf',p.geldig_vanaf,'vervaldatum',p.vervaldatum,'valuta_code',p.valuta_code,'geografische_scope',p.geografische_scope,'location_keys',p.location_keys,'meetgrondslag',p.meetgrondslag,'scope_inclusief',p.scope_inclusief,'scope_exclusief',p.scope_exclusief,'indexeringsmethode',p.indexeringsmethode,'betrouwbaarheid',p.betrouwbaarheid,'goedgekeurd_op',p.goedgekeurd_op) end into linked_package_id, package_payload from public.vastgoedrekenen_kengetallen k left join public.vastgoedrekenen_bronpakketten p on p.id=k.bronpakket_id where k.id=new.kengetal_id;
  new.bronpakket_id := linked_package_id; new.bronpakket_snapshot := package_payload; return new;
end; $$;

drop trigger if exists scenario_kengetal_snapshot_bronpakket on public.scenario_kengetal_snapshots;
create trigger scenario_kengetal_snapshot_bronpakket before insert or update of kengetal_id on public.scenario_kengetal_snapshots for each row execute function public.vastgoedrekenen_snapshot_bronpakket();