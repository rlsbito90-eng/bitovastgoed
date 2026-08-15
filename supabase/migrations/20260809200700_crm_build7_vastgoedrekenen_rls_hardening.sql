drop policy if exists "vastgoedkansen_authenticated_all" on public.vastgoedkansen;
drop policy if exists "vastgoedkansen_intern_all" on public.vastgoedkansen;
create policy "vastgoedkansen_intern_all" on public.vastgoedkansen for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage acquisition components" on public.calculation_acquisition_components;
drop policy if exists "Intern users can manage acquisition components" on public.calculation_acquisition_components;
create policy "Intern users can manage acquisition components" on public.calculation_acquisition_components for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage acquisition unit links" on public.calculation_acquisition_unit_links;
drop policy if exists "Intern users can manage acquisition unit links" on public.calculation_acquisition_unit_links;
create policy "Intern users can manage acquisition unit links" on public.calculation_acquisition_unit_links for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "authenticated comparative valuations" on public.comparative_valuations;
drop policy if exists "intern comparative valuations" on public.comparative_valuations;
create policy "intern comparative valuations" on public.comparative_valuations for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "authenticated comparative valuation references" on public.comparative_valuation_references;
drop policy if exists "intern comparative valuation references" on public.comparative_valuation_references;
create policy "intern comparative valuation references" on public.comparative_valuation_references for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage vastgoedrekenen kengetallen" on public.vastgoedrekenen_kengetallen;
drop policy if exists "Authenticated users can read vastgoedrekenen kengetallen" on public.vastgoedrekenen_kengetallen;
drop policy if exists "Intern users can manage vastgoedrekenen kengetallen" on public.vastgoedrekenen_kengetallen;
create policy "Intern users can manage vastgoedrekenen kengetallen" on public.vastgoedrekenen_kengetallen for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage scenario kengetal snapshots" on public.scenario_kengetal_snapshots;
drop policy if exists "Authenticated users can read scenario kengetal snapshots" on public.scenario_kengetal_snapshots;
drop policy if exists "Intern users can manage scenario kengetal snapshots" on public.scenario_kengetal_snapshots;
create policy "Intern users can manage scenario kengetal snapshots" on public.scenario_kengetal_snapshots for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage scenario kengetal contexts" on public.scenario_kengetal_contexts;
drop policy if exists "Authenticated users can read scenario kengetal contexts" on public.scenario_kengetal_contexts;
drop policy if exists "Intern users can manage scenario kengetal contexts" on public.scenario_kengetal_contexts;
create policy "Intern users can manage scenario kengetal contexts" on public.scenario_kengetal_contexts for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage scenario profile applications" on public.scenario_kengetal_profile_applications;
drop policy if exists "Authenticated users can read scenario profile applications" on public.scenario_kengetal_profile_applications;
drop policy if exists "Intern users can manage scenario profile applications" on public.scenario_kengetal_profile_applications;
create policy "Intern users can manage scenario profile applications" on public.scenario_kengetal_profile_applications for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage vastgoedrekenen bronpakketten" on public.vastgoedrekenen_bronpakketten;
drop policy if exists "Authenticated users can read vastgoedrekenen bronpakketten" on public.vastgoedrekenen_bronpakketten;
drop policy if exists "Intern users can manage vastgoedrekenen bronpakketten" on public.vastgoedrekenen_bronpakketten;
create policy "Intern users can manage vastgoedrekenen bronpakketten" on public.vastgoedrekenen_bronpakketten for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can read vastgoedrekenen bronimports" on public.vastgoedrekenen_bronimport_runs;
drop policy if exists "Intern users can read vastgoedrekenen bronimports" on public.vastgoedrekenen_bronimport_runs;
create policy "Intern users can read vastgoedrekenen bronimports" on public.vastgoedrekenen_bronimport_runs for select to authenticated using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage vastgoedrekenen taxonomy" on public.vastgoedrekenen_taxonomie_opties;
drop policy if exists "Authenticated users can read vastgoedrekenen taxonomy" on public.vastgoedrekenen_taxonomie_opties;
drop policy if exists "Intern users can manage vastgoedrekenen taxonomy" on public.vastgoedrekenen_taxonomie_opties;
create policy "Intern users can manage vastgoedrekenen taxonomy" on public.vastgoedrekenen_taxonomie_opties for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Authenticated users can manage area preferences" on public.acquisitie_gebiedsvoorkeuren;
drop policy if exists "Authenticated users can read area preferences" on public.acquisitie_gebiedsvoorkeuren;
drop policy if exists "Intern users can manage area preferences" on public.acquisitie_gebiedsvoorkeuren;
create policy "Intern users can manage area preferences" on public.acquisitie_gebiedsvoorkeuren for all to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

drop policy if exists "Intern leest scenario_financing_facilities" on public.scenario_financing_facilities;
drop policy if exists "Intern verwijdert scenario_financing_facilities" on public.scenario_financing_facilities;
drop policy if exists "Intern voegt scenario_financing_facilities toe" on public.scenario_financing_facilities;
drop policy if exists "Intern wijzigt scenario_financing_facilities" on public.scenario_financing_facilities;
create policy "Intern leest scenario_financing_facilities" on public.scenario_financing_facilities for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
create policy "Intern voegt scenario_financing_facilities toe" on public.scenario_financing_facilities for insert to authenticated with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern wijzigt scenario_financing_facilities" on public.scenario_financing_facilities for update to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern verwijdert scenario_financing_facilities" on public.scenario_financing_facilities for delete to authenticated using (public.is_intern_gebruiker(auth.uid()));