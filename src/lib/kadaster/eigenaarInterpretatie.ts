import type { Relatie } from '@/data/mock-data';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';

export interface KadasterEigenaarVoorstel {
  sleutel: string;
  naam: string;
  type: string | null;
  kvkNummer: string | null;
  rechtsoort: string | null;
  aandeel: string | null;
  kadastraleAanduiding: string | null;
  bronRecordIds: string[];
  bronAdressen: string[];
}

export interface EigenaarCrmMatch {
  relatie: Relatie;
  score: number;
  reden: 'kvk_exact' | 'naam_exact' | 'contact_exact' | 'naam_deels';
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;

const tekst = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

export function normaliseerPartijNaam(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/\b(b\.?v\.?|n\.?v\.?|stichting|vereniging)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function zoekEerste(o: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = tekst(o[key]);
    if (v) return v;
  }
  return null;
}

function kandidatenUitBlok(v: unknown): Array<{ naam: string; type: string | null; kvkNummer: string | null; aandeel: string | null; rechtsoort: string | null }> {
  const out: Array<{ naam: string; type: string | null; kvkNummer: string | null; aandeel: string | null; rechtsoort: string | null }> = [];
  const walk = (node: unknown, inherited: { aandeel: string | null; rechtsoort: string | null }, depth: number) => {
    if (depth > 4) return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, inherited, depth + 1));
      return;
    }
    const o = obj(node);
    if (!o) return;
    const aandeel = zoekEerste(o, ['aandeel', 'aandeelInRecht', 'breukdeel', 'gerechtigdAandeel']) ?? inherited.aandeel;
    const rechtsoort = zoekEerste(o, ['rechtsoort', 'soortRecht', 'aardRecht', 'aardRechtVerkort', 'omschrijvingRecht', 'zakelijkRecht', 'recht']) ?? inherited.rechtsoort;
    const naam = zoekEerste(o, ['statutaireNaam', 'bedrijfsnaam', 'handelsnaam', 'organisatieNaam', 'volledigeNaam', 'naamRechthebbende', 'naam']);
    const kvkNummer = zoekEerste(o, ['kvkNummer', 'kvk']);
    if (naam) {
      const type = zoekEerste(o, ['soortRechthebbende', 'typeRechthebbende', 'rechtsvorm', 'type', 'soort']);
      out.push({ naam, type, kvkNummer, aandeel, rechtsoort });
    }
    for (const key of ['persons', 'entities', 'rechthebbenden', 'personen', 'persoon', 'natuurlijkPersoon', 'onderneming', 'nietNatuurlijkPersoon', 'rechtspersoon', 'organisatie']) {
      if (o[key] != null) walk(o[key], { aandeel, rechtsoort }, depth + 1);
    }
  };
  walk(v, { aandeel: null, rechtsoort: null }, 0);
  return out;
}

export function bouwKadasterEigenaarVoorstellen(records: KadasterDataRecord[]): KadasterEigenaarVoorstel[] {
  const rechten = records.filter((r) => r.product_code === 'rechten' && r.status !== 'fout');
  const map = new Map<string, KadasterEigenaarVoorstel>();

  for (const record of rechten) {
    const raw = obj(record.raw_limited);
    const rechtenRaw = raw ? obj(raw.rechten) : null;
    const blokken = rechtenRaw && Array.isArray(rechtenRaw.blokken) ? rechtenRaw.blokken : [];
    const gevonden = blokken.flatMap((blok) => kandidatenUitBlok(blok));
    if (record.rechthebbende_naam) {
      gevonden.unshift({
        naam: record.rechthebbende_naam,
        type: record.rechthebbende_type,
        kvkNummer: null,
        aandeel: record.aandeel,
        rechtsoort: record.rechtsoort,
      });
    }

    for (const kandidaat of gevonden) {
      const norm = normaliseerPartijNaam(kandidaat.naam);
      if (!norm) continue;
      const sleutel = kandidaat.kvkNummer ? `kvk:${kandidaat.kvkNummer.replace(/\D/g, '')}` : `naam:${norm}`;
      const bestaand = map.get(sleutel);
      const bronAdres = tekst(record.zoekadres?.waarde) ?? '';
      if (bestaand) {
        if (!bestaand.bronRecordIds.includes(record.id)) bestaand.bronRecordIds.push(record.id);
        if (bronAdres && !bestaand.bronAdressen.includes(bronAdres)) bestaand.bronAdressen.push(bronAdres);
        bestaand.kvkNummer ||= kandidaat.kvkNummer;
        bestaand.aandeel ||= kandidaat.aandeel;
        bestaand.rechtsoort ||= kandidaat.rechtsoort;
        bestaand.kadastraleAanduiding ||= record.kadastrale_aanduiding;
      } else {
        map.set(sleutel, {
          sleutel,
          naam: kandidaat.naam,
          type: kandidaat.type ?? record.rechthebbende_type,
          kvkNummer: kandidaat.kvkNummer,
          rechtsoort: kandidaat.rechtsoort ?? record.rechtsoort,
          aandeel: kandidaat.aandeel ?? record.aandeel,
          kadastraleAanduiding: record.kadastrale_aanduiding,
          bronRecordIds: [record.id],
          bronAdressen: bronAdres ? [bronAdres] : [],
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' }));
}

export function vindCrmMatches(voorstel: KadasterEigenaarVoorstel, relaties: Relatie[]): EigenaarCrmMatch[] {
  const naam = normaliseerPartijNaam(voorstel.naam);
  const kvk = voorstel.kvkNummer?.replace(/\D/g, '') ?? '';
  return relaties
    .map((relatie): EigenaarCrmMatch | null => {
      const relatieKvk = relatie.kvkNummer?.replace(/\D/g, '') ?? '';
      const bedrijf = normaliseerPartijNaam(relatie.bedrijfsnaam);
      const contact = normaliseerPartijNaam(relatie.contactpersoon);
      if (kvk && relatieKvk && kvk === relatieKvk) return { relatie, score: 100, reden: 'kvk_exact' };
      if (naam && bedrijf === naam) return { relatie, score: 96, reden: 'naam_exact' };
      if (naam && contact === naam) return { relatie, score: 90, reden: 'contact_exact' };
      if (naam.length >= 5 && bedrijf.length >= 5 && (bedrijf.includes(naam) || naam.includes(bedrijf))) return { relatie, score: 82, reden: 'naam_deels' };
      return null;
    })
    .filter((x): x is EigenaarCrmMatch => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
