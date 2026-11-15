-- BITO CRM — ONTWERP, NIET UITVOEREN OP PRODUCTIE.
-- Losse rapportage voor *intern uitgesloten kandidaten via bulkacties*.
-- Niet gelijkstellen aan echte buyer feedback of alle individuele afwijzingen.
-- Geeft canonieke UI-redenen ('locatie', 'prijs', ...) terug i.p.v. generieke
-- lost_reason_code='other' uit de bestaande globale classificatietrigger.
-- RLS van audit + kandidaten geldt ook voor de view (PostgreSQL 15+).
CREATE OR REPLACE VIEW public.crm_pipeline_bulk_actuele_interne_afwijzingen
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (a.object_id, a.kandidaat_id)
  a.object_id,
  a.kandidaat_id,
  a.reden_code AS categorie,
  a.reden_toelichting,
  a.created_at AS geregistreerd_op
FROM public.crm_pipeline_bulk_audit a
JOIN public.object_pipeline k
  ON k.id=a.kandidaat_id AND k.object_id=a.object_id
WHERE a.actie='afwijzen'
  AND a.bron='intern'
  AND a.reden_code IS NOT NULL
  AND k.soft_deleted_at IS NULL
  AND k.pipeline_fase='afgevallen'
  -- De actuele tekst moet nog corresponderen met de geregistreerde uitsluiting.
  AND k.reden_afgevallen IS NOT DISTINCT FROM (a.na->>'reden_afgevallen')
  AND NOT EXISTS (
    SELECT 1 FROM public.crm_pipeline_bulk_herstel_audit h
    WHERE h.bron_audit_id=a.id
  )
ORDER BY a.object_id,a.kandidaat_id,a.created_at DESC,a.id DESC;

REVOKE ALL ON public.crm_pipeline_bulk_actuele_interne_afwijzingen FROM PUBLIC,anon;
GRANT SELECT ON public.crm_pipeline_bulk_actuele_interne_afwijzingen TO authenticated;

CREATE OR REPLACE VIEW public.crm_pipeline_bulk_interne_afwijzingen_per_categorie
WITH (security_invoker = true)
AS
SELECT object_id,categorie,count(*)::integer AS aantal
FROM public.crm_pipeline_bulk_actuele_interne_afwijzingen
GROUP BY object_id,categorie;

REVOKE ALL ON public.crm_pipeline_bulk_interne_afwijzingen_per_categorie FROM PUBLIC,anon;
GRANT SELECT ON public.crm_pipeline_bulk_interne_afwijzingen_per_categorie TO authenticated;

COMMENT ON VIEW public.crm_pipeline_bulk_actuele_interne_afwijzingen IS
  'Actuele, niet herstelde interne bulk-uitsluitingen. Geen inkomende kopersfeedback en geen telling van individuele afwijzingen.';
COMMENT ON VIEW public.crm_pipeline_bulk_interne_afwijzingen_per_categorie IS
  'Telling per object en redencategorie, uitsluitend voor actuele interne bulk-uitsluitingen.';
