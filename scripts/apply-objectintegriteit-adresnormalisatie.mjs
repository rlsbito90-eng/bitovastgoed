import fs from 'node:fs';

const write = (path, content) => {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content);
};

write('src/lib/objecten/adresNormalisatie.ts', `export interface AdresInput {
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}

export interface GenormaliseerdAdres {
  adres: string;
  postcode: string;
  plaats: string;
  sleutel: string;
  volledig: boolean;
}

const DIACRITICS = /[\\u0300-\\u036f]/g;

export function normaliseerTekst(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[.,;:()\\[\\]{}]/g, ' ')
    .replace(/[-_/\\\\]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

export function normaliseerPostcode(value?: string | null): string {
  return (value ?? '').toUpperCase().replace(/\\s+/g, '').trim();
}

export function normaliseerAdres(input: AdresInput): GenormaliseerdAdres {
  const adres = normaliseerTekst(input.adres);
  const postcode = normaliseerPostcode(input.postcode);
  const plaats = normaliseerTekst(input.plaats);
  const onderdelen = [postcode, adres, plaats].filter(Boolean);

  return {
    adres,
    postcode,
    plaats,
    sleutel: onderdelen.join('|'),
    volledig: Boolean(adres && postcode && plaats),
  };
}

export function adressenZijnGelijk(a: AdresInput, b: AdresInput): boolean {
  const links = normaliseerAdres(a);
  const rechts = normaliseerAdres(b);
  return Boolean(links.sleutel && links.sleutel === rechts.sleutel);
}
`);

write('src/lib/objecten/objectIntegriteit.ts', `import type { ObjectVastgoed } from '@/data/mock-data';
import { normaliseerAdres, normaliseerTekst } from './adresNormalisatie';

export type IntegriteitErnst = 'kritiek' | 'waarschuwing' | 'informatie';
export type IntegriteitCode =
  | 'adres_ontbreekt'
  | 'postcode_ontbreekt'
  | 'plaats_ontbreekt'
  | 'mogelijk_dubbel_adres'
  | 'dubbel_intern_referentienummer';

export interface ObjectIntegriteitIssue {
  code: IntegriteitCode;
  ernst: IntegriteitErnst;
  objectIds: string[];
  titel: string;
  toelichting: string;
}

export interface ObjectIntegriteitRapport {
  totaalObjecten: number;
  objectenMetIssues: number;
  issues: ObjectIntegriteitIssue[];
  aantallen: Record<IntegriteitCode, number>;
}

const legeAantallen = (): Record<IntegriteitCode, number> => ({
  adres_ontbreekt: 0,
  postcode_ontbreekt: 0,
  plaats_ontbreekt: 0,
  mogelijk_dubbel_adres: 0,
  dubbel_intern_referentienummer: 0,
});

function groepeer<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groepen = new Map<string, T[]>();
  for (const item of items) {
    const waarde = key(item);
    if (!waarde) continue;
    const groep = groepen.get(waarde) ?? [];
    groep.push(item);
    groepen.set(waarde, groep);
  }
  return groepen;
}

export function analyseerObjectIntegriteit(objecten: ObjectVastgoed[]): ObjectIntegriteitRapport {
  const issues: ObjectIntegriteitIssue[] = [];
  const objectIdsMetIssue = new Set<string>();
  const aantallen = legeAantallen();

  for (const object of objecten) {
    const velden: Array<[IntegriteitCode, string, string]> = [
      ['adres_ontbreekt', 'Adres ontbreekt', 'Vul een straatnaam en huisnummer in.'],
      ['postcode_ontbreekt', 'Postcode ontbreekt', 'Een postcode is nodig voor betrouwbare objectmatching.'],
      ['plaats_ontbreekt', 'Plaats ontbreekt', 'Vul de vestigingsplaats van het object in.'],
    ];
    const waarden = [object.adres, object.postcode, object.plaats];
    velden.forEach(([code, titel, toelichting], index) => {
      if (!waarden[index]?.trim()) {
        issues.push({ code, ernst: 'waarschuwing', objectIds: [object.id], titel, toelichting });
        aantallen[code] += 1;
        objectIdsMetIssue.add(object.id);
      }
    });
  }

  const adresGroepen = groepeer(objecten, object => {
    const adres = normaliseerAdres(object);
    return adres.volledig ? adres.sleutel : '';
  });
  for (const groep of adresGroepen.values()) {
    if (groep.length < 2) continue;
    const objectIds = groep.map(object => object.id);
    issues.push({
      code: 'mogelijk_dubbel_adres',
      ernst: 'kritiek',
      objectIds,
      titel: 'Mogelijk dubbel objectadres',
      toelichting: groep.map(object => object.crmObjectnummer ?? object.titel).join(', '),
    });
    aantallen.mogelijk_dubbel_adres += 1;
    objectIds.forEach(id => objectIdsMetIssue.add(id));
  }

  const referentieGroepen = groepeer(objecten, object => normaliseerTekst(object.internReferentienummer));
  for (const groep of referentieGroepen.values()) {
    if (groep.length < 2) continue;
    const objectIds = groep.map(object => object.id);
    issues.push({
      code: 'dubbel_intern_referentienummer',
      ernst: 'kritiek',
      objectIds,
      titel: 'Dubbel intern referentienummer',
      toelichting: groep.map(object => object.crmObjectnummer ?? object.titel).join(', '),
    });
    aantallen.dubbel_intern_referentienummer += 1;
    objectIds.forEach(id => objectIdsMetIssue.add(id));
  }

  return {
    totaalObjecten: objecten.length,
    objectenMetIssues: objectIdsMetIssue.size,
    issues,
    aantallen,
  };
}
`);

write('src/components/objecten/ObjectIntegriteitSamenvatting.tsx', `import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { ObjectVastgoed } from '@/data/mock-data';
import { analyseerObjectIntegriteit } from '@/lib/objecten/objectIntegriteit';

export function ObjectIntegriteitSamenvatting({ objecten }: { objecten: ObjectVastgoed[] }) {
  const [open, setOpen] = useState(false);
  const rapport = useMemo(() => analyseerObjectIntegriteit(objecten), [objecten]);

  if (rapport.issues.length === 0) {
    return (
      <div className="section-card p-3.5 flex items-center gap-3 text-sm">
        <ShieldCheck className="h-5 w-5 text-success shrink-0" />
        <div>
          <p className="font-medium text-foreground">Objectintegriteit op orde</p>
          <p className="text-xs text-muted-foreground">Geen ontbrekende kernadressen of mogelijke duplicaten gevonden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card overflow-hidden">
      <button type="button" onClick={() => setOpen(value => !value)} className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Objectintegriteitscontrole</p>
            <p className="text-xs text-muted-foreground">{rapport.objectenMetIssues} van {rapport.totaalObjecten} objecten vragen controle · read-only</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border p-3.5 space-y-2">
          {rapport.issues.slice(0, 12).map((issue, index) => (
            <div key={\`${'${issue.code}'}-${'${index}'}\`} className="rounded-md border border-border/70 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{issue.titel}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{issue.ernst}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{issue.toelichting}</p>
            </div>
          ))}
          {rapport.issues.length > 12 && <p className="text-xs text-muted-foreground">Nog {rapport.issues.length - 12} controles niet weergegeven.</p>}
          <p className="text-[11px] text-muted-foreground pt-1">Deze controle wijzigt, koppelt of archiveert geen gegevens automatisch.</p>
        </div>
      )}
    </div>
  );
}
`);

write('src/test/objecten/adresNormalisatie.test.ts', `import { describe, expect, it } from 'vitest';
import { adressenZijnGelijk, normaliseerAdres, normaliseerPostcode, normaliseerTekst } from '@/lib/objecten/adresNormalisatie';

describe('adresnormalisatie', () => {
  it('normaliseert hoofdletters, diakritische tekens en leestekens', () => {
    expect(normaliseerTekst('  Sint-Jansstraat 10-A,  ')).toBe('sint jansstraat 10 a');
  });

  it('normaliseert Nederlandse postcodes zonder spatie', () => {
    expect(normaliseerPostcode(' 5038 AB ')).toBe('5038AB');
  });

  it('maakt een stabiele samengestelde adressleutel', () => {
    expect(normaliseerAdres({ adres: 'Markt 1', postcode: '5038 AB', plaats: 'Tilburg' }).sleutel)
      .toBe('5038AB|markt 1|tilburg');
  });

  it('herkent equivalent geschreven adressen', () => {
    expect(adressenZijnGelijk(
      { adres: 'Sint-Jansstraat 10-A', postcode: '5038 ab', plaats: 'Tilburg' },
      { adres: 'Sint Jansstraat 10 A', postcode: '5038AB', plaats: 'tilburg' },
    )).toBe(true);
  });
});
`);

write('src/test/objecten/objectIntegriteit.test.ts', `import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import { analyseerObjectIntegriteit } from '@/lib/objecten/objectIntegriteit';

const object = (id: string, overrides: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  id,
  titel: id,
  anoniem: false,
  plaats: 'Tilburg',
  provincie: 'Noord-Brabant',
  adres: 'Markt 1',
  postcode: '5038 AB',
  type: 'winkels',
  status: 'te_beoordelen',
  exclusief: false,
  verhuurStatus: 'leeg',
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  isPortefeuille: false,
  documentenBeschikbaar: false,
  datumToegevoegd: '2026-08-02',
  ...overrides,
});

describe('objectintegriteitscontrole', () => {
  it('meldt ontbrekende adresvelden zonder data te wijzigen', () => {
    const input = object('1', { adres: undefined, postcode: undefined });
    const rapport = analyseerObjectIntegriteit([input]);
    expect(rapport.aantallen.adres_ontbreekt).toBe(1);
    expect(rapport.aantallen.postcode_ontbreekt).toBe(1);
    expect(input.adres).toBeUndefined();
  });

  it('groepeert gelijkwaardige adressen als mogelijk duplicaat', () => {
    const rapport = analyseerObjectIntegriteit([
      object('1', { crmObjectnummer: 'OBJ-000001' }),
      object('2', { crmObjectnummer: 'OBJ-000002', adres: 'markt-1', postcode: '5038AB', plaats: 'tilburg' }),
    ]);
    expect(rapport.aantallen.mogelijk_dubbel_adres).toBe(1);
    expect(rapport.objectenMetIssues).toBe(2);
  });

  it('meldt dubbele interne referentienummers', () => {
    const rapport = analyseerObjectIntegriteit([
      object('1', { internReferentienummer: 'REF-10' }),
      object('2', { adres: 'Markt 2', internReferentienummer: ' ref 10 ' }),
    ]);
    expect(rapport.aantallen.dubbel_intern_referentienummer).toBe(1);
  });
});
`);

const pagePath = 'src/pages/ObjectenPage.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
const importNeedle = "import { objectMatchesCrmSearch } from '@/lib/objecten/crmObjectnummer';";
if (!page.includes(importNeedle)) throw new Error('ObjectenPage import anchor ontbreekt');
page = page.replace(importNeedle, `${importNeedle}\nimport { ObjectIntegriteitSamenvatting } from '@/components/objecten/ObjectIntegriteitSamenvatting';`);
const headerEnd = `      />\n\n      <div className="flex gap-1 border-b border-border">`;
if (!page.includes(headerEnd)) throw new Error('ObjectenPage header anchor ontbreekt');
page = page.replace(headerEnd, `      />\n\n      <ObjectIntegriteitSamenvatting objecten={objecten} />\n\n      <div className="flex gap-1 border-b border-border">`);
fs.writeFileSync(pagePath, page);
