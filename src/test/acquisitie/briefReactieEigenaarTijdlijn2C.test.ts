import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { vindBriefEigenaar } from '@/lib/acquisitie/briefEigenaarMatch';
import type { AcquisitieBrief } from '@/hooks/useAcquisitieBrieven';

const activiteitBron = fs.readFileSync(
  path.resolve('src/components/acquisitie/VastgoedkansEigenaarActiviteitKaart.tsx'),
  'utf8',
);
const opvolgTaakBron = fs.readFileSync(
  path.resolve('src/components/acquisitie/VastgoedkansBriefOpvolgTaak.tsx'),
  'utf8',
);

function brief(overrides: Partial<AcquisitieBrief> = {}): AcquisitieBrief {
  return {
    id: 'brief-1',
    eigenaar_naam: 'A.W. Enthoven',
    eigenaar_bedrijfsnaam: null,
    verzendadres: 'Voorbeeldstraat 1\n1234 AB Amsterdam',
    ...overrides,
  } as AcquisitieBrief;
}

const eigenaren = [
  {
    id: 'e1',
    naam: 'A.W. Enthoven',
    bedrijfsnaam: null,
    adres: 'Voorbeeldstraat 1',
    postcode: '1234AB',
    plaats: 'Amsterdam',
  },
  {
    id: 'e2',
    naam: 'Andere Eigenaar',
    bedrijfsnaam: null,
    adres: 'Andereweg 2',
    postcode: '5678CD',
    plaats: 'Utrecht',
  },
];

describe('BUILD 2.0C — briefreactie in eigenaarstijdlijn', () => {
  it('gebruikt één centrale matcher voor opvolgtaak en tijdlijn', () => {
    expect(opvolgTaakBron).toContain("from '@/lib/acquisitie/briefEigenaarMatch'");
    expect(activiteitBron).toContain("from '@/lib/acquisitie/briefEigenaarMatch'");
    expect(opvolgTaakBron).toContain('vindBriefEigenaar(brief, eigenaren)');
    expect(activiteitBron).toContain('vindBriefEigenaar(brief, eigenaren)?.id === eigenaar.id');
  });

  it('matcht uniek op naam en correspondentieadres', () => {
    expect(vindBriefEigenaar(brief(), eigenaren)?.id).toBe('e1');
  });

  it('weigert een ambigue naam zonder uniek adres', () => {
    const dubbel = [
      ...eigenaren,
      { id: 'e3', naam: 'A.W. Enthoven', bedrijfsnaam: null, adres: 'Tweedeweg 3', postcode: '9999ZZ', plaats: 'Amsterdam' },
    ];
    expect(vindBriefEigenaar(brief({ verzendadres: null }), dubbel)).toBeNull();
  });

  it('toont geregistreerde briefreacties read-only in dezelfde tijdlijn', () => {
    expect(activiteitBron).toContain('useVastgoedkansBrieven(vastgoedkansId)');
    expect(activiteitBron).toContain('brief.responsstatus');
    expect(activiteitBron).toContain('brief.responsdatum');
    expect(activiteitBron).toContain("soort: 'brief-reactie' as const");
    expect(activiteitBron).toContain('RESPONS_LABEL');
  });

  it('maakt geen duplicaat contactmoment aan vanuit een briefreactie', () => {
    const reactieBlokStart = activiteitBron.indexOf('const briefReacties');
    const tijdlijnStart = activiteitBron.indexOf('const tijdlijn');
    const reactieBlok = activiteitBron.slice(reactieBlokStart, tijdlijnStart);
    expect(reactieBlok).not.toContain('voegContactToe');
    expect(reactieBlok).not.toContain("from('contact_moments')");
  });
});
