-- 1. Harden is_intern_gebruiker: alleen admin of medewerker telt als intern
CREATE OR REPLACE FUNCTION public.is_intern_gebruiker(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'medewerker'::public.app_role)
  )
$function$;

-- 2. Profiles: expliciete INSERT policy zodat gebruikers alleen hun eigen profiel kunnen aanmaken
DROP POLICY IF EXISTS "Gebruiker maakt eigen profiel aan" ON public.profiles;
CREATE POLICY "Gebruiker maakt eigen profiel aan"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. user_roles SELECT hardening:
--    - admins zien alles (bestaande policy blijft)
--    - gewone gebruikers mogen enkel checken of ZIJZELF een rij hebben (nodig voor eigen UI),
--      maar dit lekt geen extra info: het is altijd hun eigen user_id.
--    Bestaande policy "Gebruiker ziet eigen rollen" doet exact dat al (auth.uid() = user_id) en is veilig.
--    INSERT/UPDATE/DELETE policies zijn al admin-only — bevestigd, geen wijziging.

-- 4. Hergebruik bestaande policies maar zorg dat is_intern_gebruiker nu strikt is.
--    Geen verdere schemawijzigingen nodig op relaties/objecten/deals/taken/notities/matches/zoekprofielen
--    omdat al hun policies via is_intern_gebruiker gaan, die nu correct beperkt is.