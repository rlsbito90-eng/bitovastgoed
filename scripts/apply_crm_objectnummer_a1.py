from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


migration = r'''-- BUILD A1 — CRM-breed onveranderlijk objectnummer
-- Additief: bestaande UUID's en interne referentienummers blijven ongewijzigd.

CREATE SEQUENCE IF NOT EXISTS public.crm_objectnummer_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

CREATE OR REPLACE FUNCTION public.next_crm_objectnummer()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'OBJ-' || lpad(nextval('public.crm_objectnummer_seq')::text, 6, '0');
$$;

REVOKE ALL ON FUNCTION public.next_crm_objectnummer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_crm_objectnummer() TO authenticated, service_role;

ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS crm_objectnummer text;

ALTER TABLE public.objecten
  ALTER COLUMN crm_objectnummer SET DEFAULT public.next_crm_objectnummer();

ALTER SEQUENCE public.crm_objectnummer_seq
  OWNED BY public.objecten.crm_objectnummer;

-- Synchroniseer de sequence eerst met eventueel reeds uitgegeven nummers en vul
-- vervolgens ontbrekende nummers deterministisch op created_at/id aan.
DO $$
DECLARE
  object_row record;
  highest_number bigint := 0;
BEGIN
  SELECT COALESCE(MAX(substring(crm_objectnummer FROM 5)::bigint), 0)
    INTO highest_number
  FROM public.objecten
  WHERE crm_objectnummer ~ '^OBJ-[0-9]{6,}$';

  IF highest_number > 0 THEN
    PERFORM setval('public.crm_objectnummer_seq', highest_number, true);
  ELSE
    PERFORM setval('public.crm_objectnummer_seq', 1, false);
  END IF;

  FOR object_row IN
    SELECT id
    FROM public.objecten
    WHERE crm_objectnummer IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.objecten
    SET crm_objectnummer = public.next_crm_objectnummer()
    WHERE id = object_row.id
      AND crm_objectnummer IS NULL;
  END LOOP;

  SELECT COALESCE(MAX(substring(crm_objectnummer FROM 5)::bigint), 0)
    INTO highest_number
  FROM public.objecten
  WHERE crm_objectnummer ~ '^OBJ-[0-9]{6,}$';

  IF highest_number > 0 THEN
    PERFORM setval('public.crm_objectnummer_seq', highest_number, true);
  ELSE
    PERFORM setval('public.crm_objectnummer_seq', 1, false);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.objecten'::regclass
      AND conname = 'objecten_crm_objectnummer_format_check'
  ) THEN
    ALTER TABLE public.objecten
      ADD CONSTRAINT objecten_crm_objectnummer_format_check
      CHECK (crm_objectnummer ~ '^OBJ-[0-9]{6,}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS objecten_crm_objectnummer_key
  ON public.objecten (crm_objectnummer);

ALTER TABLE public.objecten
  ALTER COLUMN crm_objectnummer SET NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_crm_objectnummer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Een ontbrekend nummer mag door een gecontroleerde herstelactie worden gezet;
  -- een eenmaal uitgegeven nummer is daarna onveranderlijk.
  IF OLD.crm_objectnummer IS NOT NULL
     AND NEW.crm_objectnummer IS DISTINCT FROM OLD.crm_objectnummer THEN
    RAISE EXCEPTION 'crm_objectnummer is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS objecten_crm_objectnummer_immutable ON public.objecten;
CREATE TRIGGER objecten_crm_objectnummer_immutable
BEFORE UPDATE OF crm_objectnummer ON public.objecten
FOR EACH ROW
EXECUTE FUNCTION public.prevent_crm_objectnummer_update();

COMMENT ON COLUMN public.objecten.crm_objectnummer IS
  'Blijvend, app-breed leesbaar CRM-objectnummer; onafhankelijk van adres, assettype en externe bronidentifiers.';
'''
write("supabase/migrations/20260802021000_add_crm_objectnummer.sql", migration)

helper = r'''import type { ObjectVastgoed } from '@/data/mock-data';

export const CRM_OBJECTNUMMER_PATTERN = /^OBJ-[0-9]{6,}$/;

export function isCrmObjectnummer(value: unknown): value is string {
  return typeof value === 'string' && CRM_OBJECTNUMMER_PATTERN.test(value);
}

export function normalizeCrmObjectnummerQuery(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function objectMatchesCrmSearch(
  object: Pick<ObjectVastgoed, 'titel' | 'plaats' | 'crmObjectnummer'>,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const normalizedObjectNumber = normalizeCrmObjectnummerQuery(object.crmObjectnummer ?? '').toLowerCase();
  const normalizedNumberQuery = normalizeCrmObjectnummerQuery(query).toLowerCase();

  return object.titel.toLowerCase().includes(normalizedQuery)
    || object.plaats.toLowerCase().includes(normalizedQuery)
    || normalizedObjectNumber.includes(normalizedNumberQuery);
}
'''
write("src/lib/objecten/crmObjectnummer.ts", helper)

test = r'''import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isCrmObjectnummer,
  normalizeCrmObjectnummerQuery,
  objectMatchesCrmSearch,
} from '@/lib/objecten/crmObjectnummer';

describe('CRM-objectnummer', () => {
  it('accepteert het vaste OBJ-formaat met minimaal zes cijfers', () => {
    expect(isCrmObjectnummer('OBJ-000001')).toBe(true);
    expect(isCrmObjectnummer('OBJ-1000000')).toBe(true);
    expect(isCrmObjectnummer('obj-000001')).toBe(false);
    expect(isCrmObjectnummer('OBJ-1')).toBe(false);
  });

  it('normaliseert zoekinvoer zonder het opgeslagen nummer te wijzigen', () => {
    expect(normalizeCrmObjectnummerQuery(' obj-000123 ')).toBe('OBJ-000123');
    expect(normalizeCrmObjectnummerQuery('OBJ - 000123')).toBe('OBJ-000123');
  });

  it('zoekt op objectnummer, titel en plaats', () => {
    const object = {
      crmObjectnummer: 'OBJ-000123',
      titel: 'Kantoorpand Stationsstraat',
      plaats: 'Breda',
    };

    expect(objectMatchesCrmSearch(object, 'obj-000123')).toBe(true);
    expect(objectMatchesCrmSearch(object, 'Stationsstraat')).toBe(true);
    expect(objectMatchesCrmSearch(object, 'breda')).toBe(true);
    expect(objectMatchesCrmSearch(object, 'Tilburg')).toBe(false);
  });

  it('legt de databasegaranties vast in de migratie', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260802021000_add_crm_objectnummer.sql'),
      'utf-8',
    );

    expect(sql).toContain('CREATE SEQUENCE IF NOT EXISTS public.crm_objectnummer_seq');
    expect(sql).toContain("'OBJ-' || lpad(nextval('public.crm_objectnummer_seq')::text, 6, '0')");
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS objecten_crm_objectnummer_key');
    expect(sql).toContain('ALTER COLUMN crm_objectnummer SET NOT NULL');
    expect(sql).toContain('objecten_crm_objectnummer_immutable');
    expect(sql).toContain("ORDER BY created_at, id");
  });
});
'''
write("src/test/objecten/crmObjectnummer.test.ts", test)

# Frontenddomein: nummer is tijdens een rolling deploy defensief optioneel,
# terwijl de database na de migratie NOT NULL afdwingt.
replace_once(
    "src/data/mock-data.ts",
    "export interface ObjectVastgoed {\n  id: string;\n  titel: string;\n  internReferentienummer?: string;",
    "export interface ObjectVastgoed {\n  id: string;\n  /** Blijvend, app-breed leesbaar CRM-objectnummer (bijv. OBJ-000001). */\n  crmObjectnummer?: string;\n  titel: string;\n  internReferentienummer?: string;",
)

replace_once(
    "src/hooks/useDataStore.tsx",
    "const objectFromDb = (o: any): ObjectVastgoed => ({\n  id: o.id,\n  titel: o.objectnaam ?? '',",
    "const objectFromDb = (o: any): ObjectVastgoed => ({\n  id: o.id,\n  crmObjectnummer: o.crm_objectnummer ?? undefined,\n  titel: o.objectnaam ?? '',",
)

# Gegenereerde Supabase-types additief bijwerken voor Row/Insert/Update.
types_path = ROOT / "src/integrations/supabase/types.ts"
types_text = types_path.read_text(encoding="utf-8")
start = types_text.index("      objecten: {\n")
end = types_text.index("      object_fotos: {\n", start)
object_block = types_text[start:end]
for old, new in [
    ("          created_at: string\n", "          created_at: string\n          crm_objectnummer: string\n"),
    ("          created_at?: string\n", "          created_at?: string\n          crm_objectnummer?: string\n"),
]:
    count = object_block.count(old)
    expected = 1 if old.startswith("          created_at: string") else 2
    if count != expected:
        raise RuntimeError(f"Unexpected objecten type shape for {old!r}: {count}")
    if expected == 1:
        object_block = object_block.replace(old, new, 1)
    else:
        object_block = object_block.replace(old, new, 2)
types_path.write_text(types_text[:start] + object_block + types_text[end:], encoding="utf-8")

replace_once(
    "src/pages/ObjectenPage.tsx",
    "import type { SortOption } from '@/lib/sorting/types';",
    "import type { SortOption } from '@/lib/sorting/types';\nimport { objectMatchesCrmSearch } from '@/lib/objecten/crmObjectnummer';",
)
replace_once(
    "src/pages/ObjectenPage.tsx",
    "      const matchZoek = !zoek\n        || o.titel.toLowerCase().includes(zoek.toLowerCase())\n        || o.plaats.toLowerCase().includes(zoek.toLowerCase());",
    "      const matchZoek = objectMatchesCrmSearch(o, zoek);",
)
replace_once(
    "src/pages/ObjectenPage.tsx",
    '          <Input placeholder="Zoek op naam of plaats..." className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />',
    '          <Input placeholder="Zoek op naam, plaats of object-ID..." className="pl-9 h-10" value={zoek} onChange={e => setZoek(e.target.value)} />',
)
replace_once(
    "src/pages/ObjectenPage.tsx",
    "                    </p>\n                    <div className=\"flex items-center gap-1 shrink-0\">",
    "                    </p>\n                    <div className=\"flex items-center gap-1 shrink-0\">",
)
replace_once(
    "src/pages/ObjectenPage.tsx",
    "                  <p className=\"text-xs text-muted-foreground mt-1 truncate\">\n                    {[obj.plaats, obj.provincie].filter(Boolean).join(', ')}\n                  </p>",
    "                  {obj.crmObjectnummer && (\n                    <p className=\"text-[11px] text-muted-foreground mt-1 font-mono-data\">{obj.crmObjectnummer}</p>\n                  )}\n                  <p className=\"text-xs text-muted-foreground mt-1 truncate\">\n                    {[obj.plaats, obj.provincie].filter(Boolean).join(', ')}\n                  </p>",
)
replace_once(
    "src/pages/ObjectenPage.tsx",
    "                          <p className=\"text-xs text-muted-foreground mt-0.5\">{obj.plaats}, {obj.provincie}</p>",
    "                          <p className=\"text-xs text-muted-foreground mt-0.5\">\n                            {obj.crmObjectnummer && <span className=\"font-mono-data\">{obj.crmObjectnummer}</span>}\n                            {obj.crmObjectnummer && (obj.plaats || obj.provincie) && <span> · </span>}\n                            {[obj.plaats, obj.provincie].filter(Boolean).join(', ')}\n                          </p>",
)

replace_once(
    "src/pages/ObjectDetailPage.tsx",
    "              {subtypeLabel && <HeaderChip>{subtypeLabel}</HeaderChip>}\n              {object.internReferentienummer && (",
    "              {subtypeLabel && <HeaderChip>{subtypeLabel}</HeaderChip>}\n              {object.crmObjectnummer && <HeaderChip>{object.crmObjectnummer}</HeaderChip>}\n              {object.internReferentienummer && (",
)
replace_once(
    "src/pages/ObjectDetailPage.tsx",
    "                  <div className=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-5 gap-y-3\">\n                    {object.internReferentienummer && <Field label=\"Intern nummer\">{object.internReferentienummer}</Field>}",
    "                  <div className=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-5 gap-y-3\">\n                    {object.crmObjectnummer && <Field label=\"CRM-object-ID\">{object.crmObjectnummer}</Field>}\n                    {object.internReferentienummer && <Field label=\"Intern nummer\">{object.internReferentienummer}</Field>}",
)

print('BUILD A1 patch applied successfully.')
