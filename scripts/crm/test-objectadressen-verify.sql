-- Synthetische data en asserts. Ephemere CI-database wordt na job vernietigd.
DO $test$
DECLARE
  a uuid; b uuid; aid uuid; aantal integer; fout_opgetreden boolean;
BEGIN
  INSERT INTO public.objecten(objectnaam,type_vastgoed) VALUES('Geuzenweg test','wonen') RETURNING id INTO a;
  INSERT INTO public.objecten(objectnaam,type_vastgoed) VALUES('Ander fictief object','wonen') RETURNING id INTO b;
  INSERT INTO public.crm_object_adressen(object_id,adresregel,plaats,is_hoofdadres)
     VALUES (a,'Geuzenweg 22A','Hilversum',true) RETURNING id INTO aid;
  INSERT INTO public.crm_object_adressen(object_id,adresregel,plaats,is_hoofdadres)
     VALUES (a,'Geuzenweg 22B','Hilversum',false);
  SELECT count(*) INTO aantal FROM public.crm_object_adressen WHERE object_id=a;
  IF aantal <> 2 THEN RAISE EXCEPTION 'Verwacht 2 adressen voor hetzelfde object'; END IF;
  INSERT INTO public.crm_object_onderdelen(object_id,adres_id,naam,gebruiksfunctie_code,oppervlakte_m2,meetbasis)
     VALUES (a,aid,'Appartement A','wonen',75,'gbo');
  SELECT count(*) INTO aantal FROM public.crm_object_onderdelen WHERE object_id=a;
  IF aantal <> 1 THEN RAISE EXCEPTION 'Verhuureenheid ontbreekt'; END IF;

  fout_opgetreden:=false;
  BEGIN
    INSERT INTO public.crm_object_adressen(object_id,adresregel,plaats,is_hoofdadres)
      VALUES(a,'Geuzenweg 22C','Hilversum',true);
  EXCEPTION WHEN unique_violation THEN fout_opgetreden:=true; END;
  IF NOT fout_opgetreden THEN RAISE EXCEPTION 'Tweede hoofdadres niet geweigerd'; END IF;

  fout_opgetreden:=false;
  BEGIN
    INSERT INTO public.crm_object_onderdelen(object_id,adres_id,naam)
      VALUES(b,aid,'Foutieve koppeling naar ander object');
  EXCEPTION WHEN foreign_key_violation THEN fout_opgetreden:=true; END;
  IF NOT fout_opgetreden THEN RAISE EXCEPTION 'Cross-object adresrelatie niet geweigerd'; END IF;

  fout_opgetreden:=false;
  BEGIN
    INSERT INTO public.crm_object_onderdelen(object_id,naam,oppervlakte_m2)
      VALUES(a,'Geen meetbasis',55);
  EXCEPTION WHEN check_violation THEN fout_opgetreden:=true; END;
  IF NOT fout_opgetreden THEN RAISE EXCEPTION 'Ontbrekende meetbasis niet geweigerd'; END IF;
END $test$;

DO $rls$
DECLARE aantal integer;
BEGIN
  SELECT count(*) INTO aantal FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('crm_object_adressen','crm_object_onderdelen') AND c.relrowsecurity;
  IF aantal<>2 THEN RAISE EXCEPTION 'RLS niet ingeschakeld op beide tabellen'; END IF;
  SELECT count(*) INTO aantal FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('crm_object_adressen','crm_object_onderdelen');
  IF aantal<>8 THEN RAISE EXCEPTION 'Verwacht 8 CRUD policies, gevonden %',aantal; END IF;
END $rls$;

-- Authenticated zonder interne gebruiker ziet geen gegevens.
SET ROLE authenticated;
DO $deny$
DECLARE aantal integer;
BEGIN
  SELECT count(*) INTO aantal FROM public.crm_object_adressen;
  IF aantal<>0 THEN RAISE EXCEPTION 'Niet-geautoriseerde gebruiker ziet adressen'; END IF;
END $deny$;
RESET ROLE;

-- Authenticated met interne gebruiker mag de afzonderlijke adressen lezen.
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
SET ROLE authenticated;
DO $allow$
DECLARE aantal integer;
BEGIN
  SELECT count(*) INTO aantal FROM public.crm_object_adressen;
  IF aantal<>2 THEN RAISE EXCEPTION 'Interne gebruiker ziet niet beide adressen'; END IF;
  SELECT count(*) INTO aantal FROM public.crm_object_onderdelen;
  IF aantal<>1 THEN RAISE EXCEPTION 'Interne gebruiker ziet geen unit'; END IF;
END $allow$;
RESET ROLE;
