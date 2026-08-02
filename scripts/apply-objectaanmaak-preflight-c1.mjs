import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content);
};
const replace = (path, from, to) => {
  const content = read(path);
  if (!content.includes(from)) throw new Error(`Pattern not found in ${path}: ${from.slice(0, 120)}`);
  write(path, content.replace(from, to));
};

write('src/lib/objecten/objectAanmaakPreflight.ts', `import type { ObjectVastgoed } from '@/data/mock-data';
import { vindObjectMatches, type ObjectMatchInput, type ObjectMatchResultaat } from './objectMatchService';

/**
 * Read-only controle vóór het aanmaken van een nieuw Object.
 * Alleen exacte, sterke identifiers worden getoond. De functie muteert niets.
 */
export function beoordeelObjectAanmaakPreflight(
  input: ObjectMatchInput,
  objecten: ObjectVastgoed[],
): ObjectMatchResultaat[] {
  return vindObjectMatches(input, objecten)
    .filter((match) => match.score >= 80)
    .slice(0, 3);
}
`);

write('src/test/objecten/objectAanmaakPreflight.test.ts', `import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import { beoordeelObjectAanmaakPreflight } from '@/lib/objecten/objectAanmaakPreflight';

const object = (id: string, patch: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  id,
  titel: id,
  anoniem: false,
  adres: 'Markt 1',
  postcode: '5038 AB',
  plaats: 'Tilburg',
  provincie: 'Noord-Brabant',
  type: 'winkels',
  status: 'te_beoordelen',
  exclusief: false,
  verhuurStatus: 'leeg',
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  isPortefeuille: false,
  documentenBeschikbaar: false,
  datumToegevoegd: '2026-08-02',
  ...patch,
});

describe('objectaanmaak-preflight', () => {
  it('signaleert een bestaand object op volledig genormaliseerd adres', () => {
    const matches = beoordeelObjectAanmaakPreflight(
      { adres: 'Markt-1', postcode: '5038ab', plaats: 'TILBURG' },
      [object('bestaand')],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].object.id).toBe('bestaand');
    expect(matches[0].redenen).toContain('volledig_adres');
  });

  it('geeft maximaal drie sterke kandidaten terug', () => {
    const matches = beoordeelObjectAanmaakPreflight(
      { adres: 'Markt 1', postcode: '5038 AB', plaats: 'Tilburg' },
      [object('1'), object('2'), object('3'), object('4')],
    );
    expect(matches).toHaveLength(3);
  });

  it('wijzigt bronobjecten niet', () => {
    const bestaand = object('1');
    const snapshot = JSON.stringify(bestaand);
    beoordeelObjectAanmaakPreflight({ adres: 'Markt 1', postcode: '5038 AB', plaats: 'Tilburg' }, [bestaand]);
    expect(JSON.stringify(bestaand)).toBe(snapshot);
  });
});
`);

const formPath = 'src/components/forms/ObjectFormDialog.tsx';
replace(
  formPath,
  "import { useState, useEffect, ReactNode, useMemo, useRef } from 'react';",
  "import { useState, useEffect, ReactNode, useMemo, useRef } from 'react';\nimport { useNavigate } from 'react-router-dom';",
);
replace(
  formPath,
  "import ArchiveerDialog from '@/components/ArchiveerDialog';",
  "import ArchiveerDialog from '@/components/ArchiveerDialog';\nimport {\n  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,\n  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,\n} from '@/components/ui/alert-dialog';\nimport { beoordeelObjectAanmaakPreflight } from '@/lib/objecten/objectAanmaakPreflight';\nimport type { ObjectMatchResultaat } from '@/lib/objecten/objectMatchService';",
);
replace(
  formPath,
  "export default function ObjectFormDialog({ open, onOpenChange, object, initialTab = 'algemeen' }: Props) {\n  const { addObject, updateObject, objecten, genereerRefnummer } = useDataStore();",
  "export default function ObjectFormDialog({ open, onOpenChange, object, initialTab = 'algemeen' }: Props) {\n  const navigate = useNavigate();\n  const { addObject, updateObject, objecten, genereerRefnummer } = useDataStore();",
);
replace(
  formPath,
  "  const [bezig, setBezig] = useState(false);\n  const [tab, setTab] = useState(initialTab);",
  "  const [bezig, setBezig] = useState(false);\n  const [tab, setTab] = useState(initialTab);\n  const [preflightOpen, setPreflightOpen] = useState(false);\n  const [preflightMatches, setPreflightMatches] = useState<ObjectMatchResultaat[]>([]);",
);
replace(
  formPath,
  "    const triggertArchief = finalStatussen.includes(form.status)",
  "    if (!isEdit && !gemaaktId) {\n      const matches = beoordeelObjectAanmaakPreflight({\n        internReferentienummer: form.internReferentienummer,\n        adres: form.adres,\n        postcode: form.postcode,\n        plaats: form.plaats,\n        kadastraleGemeente: form.kadastraleGemeente,\n        kadastraleSectie: form.kadastraleSectie,\n        kadastraalNummer: form.kadastraalNummer,\n      }, objecten);\n      if (matches.length > 0) {\n        setPreflightMatches(matches);\n        setPreflightOpen(true);\n        return;\n      }\n    }\n    const triggertArchief = finalStatussen.includes(form.status)",
);
replace(
  formPath,
  "      <ArchiveerDialog\n        open={archiefOpen}",
  `      <AlertDialog open={preflightOpen} onOpenChange={setPreflightOpen}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Mogelijk bestaand Object gevonden</AlertDialogTitle>
            <AlertDialogDescription>
              Controleer eerst of de nieuwe invoer al bestaat. Er wordt niets automatisch gekoppeld of samengevoegd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {preflightMatches.map((match) => (
              <button
                key={match.object.id}
                type="button"
                onClick={() => {
                  setPreflightOpen(false);
                  onOpenChange(false);
                  navigate(\`/objecten/\${match.object.id}\`);
                }}
                className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{match.object.titel}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {[match.object.adres, match.object.postcode, match.object.plaats].filter(Boolean).join(', ') || 'Locatie onbekend'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Match op {match.redenen.map((reden) => reden === 'volledig_adres' ? 'volledig adres' : reden === 'kadastrale_identiteit' ? 'kadastrale identiteit' : reden === 'intern_referentienummer' ? 'intern referentienummer' : 'CRM-objectnummer').join(' en ')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-mono-data text-muted-foreground">
                    {match.score}/100
                  </span>
                </div>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Terug naar invoer</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={bezig}
              onClick={async () => {
                setPreflightOpen(false);
                await persist();
              }}
            >
              Toch nieuw Object aanmaken
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ArchiveerDialog
        open={archiefOpen}`,
);
