-- vastgoedkansen
DROP POLICY IF EXISTS "vastgoedkansen_authenticated_all" ON public.vastgoedkansen;
CREATE POLICY "vastgoedkansen_intern_all" ON public.vastgoedkansen FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- calculation_acquisition_components
DROP POLICY IF EXISTS "Authenticated users can manage acquisition components" ON public.calculation_acquisition_components;
CREATE POLICY "Intern users can manage acquisition components" ON public.calculation_acquisition_components FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- calculation_acquisition_unit_links
DROP POLICY IF EXISTS "Authenticated users can manage acquisition unit links" ON public.calculation_acquisition_unit_links;
CREATE POLICY "Intern users can manage acquisition unit links" ON public.calculation_acquisition_unit_links FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- comparative_valuations
DROP POLICY IF EXISTS "authenticated comparative valuations" ON public.comparative_valuations;
CREATE POLICY "intern comparative valuations" ON public.comparative_valuations FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- comparative_valuation_references
DROP POLICY IF EXISTS "authenticated comparative valuation references" ON public.comparative_valuation_references;
CREATE POLICY "intern comparative valuation references" ON public.comparative_valuation_references FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- vastgoedrekenen_kengetallen
DROP POLICY IF EXISTS "Authenticated users can manage vastgoedrekenen kengetallen" ON public.vastgoedrekenen_kengetallen;
DROP POLICY IF EXISTS "Authenticated users can read vastgoedrekenen kengetallen" ON public.vastgoedrekenen_kengetallen;
CREATE POLICY "Intern users can manage vastgoedrekenen kengetallen" ON public.vastgoedrekenen_kengetallen FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- scenario_kengetal_snapshots
DROP POLICY IF EXISTS "Authenticated users can manage scenario kengetal snapshots" ON public.scenario_kengetal_snapshots;
DROP POLICY IF EXISTS "Authenticated users can read scenario kengetal snapshots" ON public.scenario_kengetal_snapshots;
CREATE POLICY "Intern users can manage scenario kengetal snapshots" ON public.scenario_kengetal_snapshots FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- scenario_kengetal_contexts
DROP POLICY IF EXISTS "Authenticated users can manage scenario kengetal contexts" ON public.scenario_kengetal_contexts;
DROP POLICY IF EXISTS "Authenticated users can read scenario kengetal contexts" ON public.scenario_kengetal_contexts;
CREATE POLICY "Intern users can manage scenario kengetal contexts" ON public.scenario_kengetal_contexts FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- scenario_kengetal_profile_applications
DROP POLICY IF EXISTS "Authenticated users can manage scenario profile applications" ON public.scenario_kengetal_profile_applications;
DROP POLICY IF EXISTS "Authenticated users can read scenario profile applications" ON public.scenario_kengetal_profile_applications;
CREATE POLICY "Intern users can manage scenario profile applications" ON public.scenario_kengetal_profile_applications FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- vastgoedrekenen_bronpakketten
DROP POLICY IF EXISTS "Authenticated users can manage vastgoedrekenen bronpakketten" ON public.vastgoedrekenen_bronpakketten;
DROP POLICY IF EXISTS "Authenticated users can read vastgoedrekenen bronpakketten" ON public.vastgoedrekenen_bronpakketten;
CREATE POLICY "Intern users can manage vastgoedrekenen bronpakketten" ON public.vastgoedrekenen_bronpakketten FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- vastgoedrekenen_bronimport_runs
DROP POLICY IF EXISTS "Authenticated users can read vastgoedrekenen bronimports" ON public.vastgoedrekenen_bronimport_runs;
CREATE POLICY "Intern users can read vastgoedrekenen bronimports" ON public.vastgoedrekenen_bronimport_runs FOR SELECT TO authenticated
USING (public.is_intern_gebruiker(auth.uid()));

-- vastgoedrekenen_taxonomie_opties
DROP POLICY IF EXISTS "Authenticated users can manage vastgoedrekenen taxonomy" ON public.vastgoedrekenen_taxonomie_opties;
DROP POLICY IF EXISTS "Authenticated users can read vastgoedrekenen taxonomy" ON public.vastgoedrekenen_taxonomie_opties;
CREATE POLICY "Intern users can manage vastgoedrekenen taxonomy" ON public.vastgoedrekenen_taxonomie_opties FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));

-- acquisitie_gebiedsvoorkeuren
DROP POLICY IF EXISTS "Authenticated users can manage area preferences" ON public.acquisitie_gebiedsvoorkeuren;
DROP POLICY IF EXISTS "Authenticated users can read area preferences" ON public.acquisitie_gebiedsvoorkeuren;
CREATE POLICY "Intern users can manage area preferences" ON public.acquisitie_gebiedsvoorkeuren FOR ALL TO authenticated
USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));