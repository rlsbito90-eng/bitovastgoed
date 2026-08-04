-- Performance-hardening voor de centrale object- en Kadasterkostenlaag.
-- Geen datawijziging, geen Kadaster-aanvraag en geen productactivatie.

create index if not exists crm_objectregistraties_samengevoegd_in_idx
  on public.crm_objectregistraties (samengevoegd_in_id)
  where samengevoegd_in_id is not null;

create index if not exists kadaster_producten_updated_by_idx
  on public.kadaster_producten (updated_by)
  where updated_by is not null;

create index if not exists kadaster_budgetten_updated_by_idx
  on public.kadaster_budgetten (updated_by)
  where updated_by is not null;

create index if not exists kadaster_kosten_events_hergebruik_idx
  on public.kadaster_kosten_events (hergebruikt_van_event_id)
  where hergebruikt_van_event_id is not null;

drop policy if exists "crm_objectregistraties_toevoegen" on public.crm_objectregistraties;
create policy "crm_objectregistraties_toevoegen"
  on public.crm_objectregistraties for insert to authenticated
  with check (
    created_by = (select auth.uid())
    or (select public.is_app_admin())
  );

drop policy if exists "crm_objectregistraties_bijwerken" on public.crm_objectregistraties;
create policy "crm_objectregistraties_bijwerken"
  on public.crm_objectregistraties for update to authenticated
  using (
    created_by = (select auth.uid())
    or (select public.is_app_admin())
  )
  with check (
    created_by = (select auth.uid())
    or (select public.is_app_admin())
  );

drop policy if exists "crm_objectregistraties_beheerder_verwijderen" on public.crm_objectregistraties;
create policy "crm_objectregistraties_beheerder_verwijderen"
  on public.crm_objectregistraties for delete to authenticated
  using ((select public.is_app_admin()));

drop policy if exists "crm_objectbronkoppelingen_toevoegen" on public.crm_objectbronkoppelingen;
create policy "crm_objectbronkoppelingen_toevoegen"
  on public.crm_objectbronkoppelingen for insert to authenticated
  with check (
    created_by = (select auth.uid())
    or (select public.is_app_admin())
  );

drop policy if exists "crm_objectbronkoppelingen_bijwerken" on public.crm_objectbronkoppelingen;
create policy "crm_objectbronkoppelingen_bijwerken"
  on public.crm_objectbronkoppelingen for update to authenticated
  using (
    created_by = (select auth.uid())
    or (select public.is_app_admin())
  )
  with check (
    created_by = (select auth.uid())
    or (select public.is_app_admin())
  );

drop policy if exists "crm_objectbronkoppelingen_beheerder_verwijderen" on public.crm_objectbronkoppelingen;
create policy "crm_objectbronkoppelingen_beheerder_verwijderen"
  on public.crm_objectbronkoppelingen for delete to authenticated
  using ((select public.is_app_admin()));

-- Splits beheerpolicies op zodat SELECT niet dubbel permissief wordt geëvalueerd.
drop policy if exists "admin beheert kadasterproducten" on public.kadaster_producten;
create policy "admin voegt kadasterproducten toe" on public.kadaster_producten
  for insert to authenticated
  with check ((select public.is_app_admin()));
create policy "admin wijzigt kadasterproducten" on public.kadaster_producten
  for update to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));
create policy "admin verwijdert kadasterproducten" on public.kadaster_producten
  for delete to authenticated
  using ((select public.is_app_admin()));

drop policy if exists "admin beheert kadasterbudgetten" on public.kadaster_budgetten;
create policy "admin voegt kadasterbudgetten toe" on public.kadaster_budgetten
  for insert to authenticated
  with check ((select public.is_app_admin()));
create policy "admin wijzigt kadasterbudgetten" on public.kadaster_budgetten
  for update to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));
create policy "admin verwijdert kadasterbudgetten" on public.kadaster_budgetten
  for delete to authenticated
  using ((select public.is_app_admin()));
