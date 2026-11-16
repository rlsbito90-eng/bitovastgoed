-- Append-only audit history for CRM offers.
-- Existing offers are not backfilled and deleting an offer never deletes its audit events.
CREATE TABLE IF NOT EXISTS public.bieding_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bieding_id uuid NOT NULL,
  object_id uuid NOT NULL,
  relatie_id uuid NOT NULL,
  deal_id uuid NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_fields text[] NOT NULL DEFAULT '{}'::text[],
  old_snapshot jsonb NULL,
  new_snapshot jsonb NULL,
  actor_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS bieding_audit_events_object_time_idx ON public.bieding_audit_events (object_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bieding_audit_events_relatie_time_idx ON public.bieding_audit_events (relatie_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bieding_audit_events_bieding_time_idx ON public.bieding_audit_events (bieding_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bieding_audit_events_deal_time_idx ON public.bieding_audit_events (deal_id, created_at DESC) WHERE deal_id IS NOT NULL;

ALTER TABLE public.bieding_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bieding_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.bieding_audit_events TO authenticated;

CREATE POLICY "Intern leest bieding-audit" ON public.bieding_audit_events
  FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.log_bieding_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_row jsonb := NULL;
  new_row jsonb := NULL;
  fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;

  SELECT coalesce(array_agg(k.key ORDER BY k.key), ARRAY[]::text[])
    INTO fields
  FROM jsonb_object_keys(coalesce(old_row, '{}'::jsonb) || coalesce(new_row, '{}'::jsonb)) AS k(key)
  WHERE (old_row -> k.key) IS DISTINCT FROM (new_row -> k.key)
    AND k.key <> 'updated_at';

  IF TG_OP = 'UPDATE' AND cardinality(fields) = 0 THEN RETURN NEW; END IF;

  INSERT INTO public.bieding_audit_events (
    bieding_id, object_id, relatie_id, deal_id, operation, changed_fields,
    old_snapshot, new_snapshot, actor_id
  ) VALUES (
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.object_id ELSE NEW.object_id END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.relatie_id ELSE NEW.relatie_id END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.deal_id ELSE NEW.deal_id END,
    TG_OP, fields, old_row, new_row, auth.uid()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_bieding_audit_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_biedingen_audit
AFTER INSERT OR UPDATE OR DELETE ON public.biedingen
FOR EACH ROW EXECUTE FUNCTION public.log_bieding_audit_event();
