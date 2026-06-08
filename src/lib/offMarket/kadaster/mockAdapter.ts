// Mock-adapter voor Kadaster Check V1A/V1B/V1C.
// Genereert deterministische, geloofwaardige resultaten op basis van de
// zoekvariant. Wordt zowel in de edge function (mock-modus) als in tests
// gebruikt.
import type {
  KadasterResultaat, ZoekVariant, KadasterStatus,
} from './types';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const MOCK_EIGENAREN: Array<{ naam: string; type: KadasterResultaat['eigenaar_type']; bedrijf?: string }> = [
  { naam: 'A. Janssen Holding B.V.', type: 'bv', bedrijf: 'A. Janssen Holding B.V.' },
  { naam: 'Stichting Vastgoed Centrum', type: 'stichting', bedrijf: 'Stichting Vastgoed Centrum' },
  { naam: 'P. de Vries', type: 'particulier' },
  { naam: 'VvE Hoofdweg 160', type: 'vve', bedrijf: 'VvE Hoofdweg 160' },
  { naam: 'Gemeente Amsterdam', type: 'overheid', bedrijf: 'Gemeente Amsterdam' },
];

export interface MockAdapterInput {
  variant: ZoekVariant;
  /** Origineel adres voor in het resultaat. */
  origineelAdres: string;
}

export interface MockAdapterResultaat {
  status: KadasterStatus;
  resultaten: KadasterResultaat[];
  match_confidence: number;
}

/**
 * Geeft 0..N mock-resultaten terug. Brede varianten kunnen meerdere matches
 * geven, exacte varianten meestal één. Bewust deterministisch o.b.v. label.
 */
export function mockKadasterLookup(input: MockAdapterInput): MockAdapterResultaat {
  const seed = hash(input.variant.label);
  const eigenaar = MOCK_EIGENAREN[seed % MOCK_EIGENAREN.length];
  const sectie = String.fromCharCode(65 + (seed % 26)); // A-Z
  const perceel = 1000 + (seed % 9000);
  const index = (seed % 5) + 1;
  const kadastrale = `AMSTERDAM ${sectie} ${perceel} A${index}`;

  // Brede varianten zonder toevoeging kunnen 0..3 resultaten geven.
  // Met toevoeging meestal 1 exact resultaat.
  const isBreed = input.variant.precisie < 0.6 && !input.variant.metToevoeging;
  const aantal = isBreed ? (seed % 3) : 1; // 0..2 of 1
  const totaal = aantal === 0 ? 0 : aantal;

  if (totaal === 0) {
    return { status: 'geen_resultaat', resultaten: [], match_confidence: 0 };
  }

  const resultaten: KadasterResultaat[] = [];
  for (let i = 0; i < Math.max(1, totaal); i++) {
    const eig = MOCK_EIGENAREN[(seed + i) % MOCK_EIGENAREN.length];
    // Hogere precisie en met-toevoeging = hogere confidence.
    const baseConfidence = input.variant.precisie + (input.variant.metToevoeging ? 0.1 : 0);
    const confidence = Math.min(0.98, baseConfidence - i * 0.15);
    resultaten.push({
      adres: input.origineelAdres || input.variant.label,
      eigenaar_naam: eig.naam,
      eigenaar_type: eig.type,
      eigenaar_bedrijfsnaam: eig.bedrijf,
      kadastrale_aanduiding: `${kadastrale}${i > 0 ? `-${i}` : ''}`,
      confidence: Math.round(confidence * 100) / 100,
      bron: 'mock',
      brondatum: new Date().toISOString().slice(0, 10),
    });
  }

  // Eerste mock-resultaat gebruikt de hoofd-eigenaar uit MOCK_EIGENAREN (deterministisch)
  if (resultaten[0]) {
    resultaten[0] = {
      ...resultaten[0],
      eigenaar_naam: eigenaar.naam,
      eigenaar_type: eigenaar.type,
      eigenaar_bedrijfsnaam: eigenaar.bedrijf,
    };
  }

  const best = Math.max(...resultaten.map(r => r.confidence));
  const status: KadasterStatus = resultaten.length > 1 ? 'meerdere_resultaten' : 'geslaagd';
  return { status, resultaten, match_confidence: best };
}
