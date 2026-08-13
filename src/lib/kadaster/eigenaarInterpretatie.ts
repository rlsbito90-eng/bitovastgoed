import type { Relatie } from '@/data/mock-data';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';

export interface KadasterEigenaarVoorstel {
  sleutel: string;
  naam: string;
  bedrijfsnaam: string | null;
  persoonType: 'natuurlijk' | 'rechtspersoon' | null;
  voornamen: string | null;
  voorletters: string | null;
  type: string | null;
  kvkNummer: string | null;
  adresRegels: string[];
  postcode: string | null;
  plaats: string | null;
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

interface Kandidaat {
  naam: string;
  bedrijfsnaam: string | null;
  persoonType: 'natuurlijk' | 'rechtspersoon' | null;
  voornamen: string | null;
  voorletters: string | null;
  type: string | null;
  kvkNummer: string | null;
  adresRegels: string[];
  postcode: string | null;
  plaats: string | null;
  aandeel: string | null;
  rechtsoort: string | null;
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

function zoekEerste(o: Record<string, unknown> | null, keys: string[]): string | null {
  if (!o) return null;
  for (const key of keys) {
    const v = tekst(o[key]);
    if (v) return v;
  }
  return null;
}

function maakVoorletters(voornamen: string | null): string | null {
  if (!voornamen) return null;
  const letters = voornamen
    .split(/[\s-]+/)
    .map((deel) => deel.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/)?.[0]?.toUpperCase() ?? '')
    .filter(Boolean);
  return letters.length ? `${letters.join('.')}.` : null;
}

function leesAdres(o: Record<string, unknown>): { regels: string[]; postcode: string | null; plaats: string | null } {
  const adres = obj(o.adres) ?? obj(o.woonadres) ?? obj(o.vestigingsadres) ?? obj(o.correspondentieadres) ?? o;
  const straat = zoekEerste(adres, ['straat', 'straatnaam', 'openbareRuimte']);
  const huisnummer = zoekEerste(adres, ['huisnummer']);
  const huisletter = zoekEerste(adres, ['huisletter']);
  const toevoeging = zoekEerste(adres, ['huisnummertoevoeging', 'toevoeging']);
  const postbus = zoekEerste(adres, ['postbus']);
  const postcode = zoekEerste(adres, ['postcode']);
  const plaats = zoekEerste(adres, ['plaats', 'woonplaats', 'stad', 'vestigingsplaats']);
  const regels: string[] = [];
  if (straat) {
    const nummer = [huisnummer, huisletter].filter(Boolean).join('');
    const nummerMetToevoeging = [nummer, toevoeging].filter(Boolean).join('-');
    regels.push([straat, nummerMetToevoeging].filter(Boolean).join(' '));
  }
  if (postbus) regels.push(`Postbus ${postbus}`);
  return { regels, postcode, plaats };
}

function kandidaatUitObject(o: Record<string, unknown>, inherited: { aandeel: string | null; rechtsoort: string | null }): Kandidaat | null {
  const persoon = obj(o.persoon) ?? obj(o.natuurlijkPersoon) ?? obj(o.naturalPerson) ?? obj(o.naamNatuurlijkPersoon);
  const onderneming = obj(o.onderneming) ?? obj(o.nietNatuurlijkPersoon) ?? obj(o.rechtspersoon)
    ?? obj(o.organisatie) ?? obj(o.legalEntity) ?? obj(o.naamNietNatuurlijkPersoon);

  const voornamen = zoekEerste(persoon, ['voornamen', 'givenNames']) ?? zoekEerste(o, ['voornamen', 'givenNames']);
  const geslachtsnaam = zoekEerste(persoon, ['geslachtsnaam', 'achternaam', 'surname'])
    ?? zoekEerste(o, ['geslachtsnaam', 'achternaam', 'surname']);
  const volledigeNaam = zoekEerste(persoon, ['volledigeNaam', 'naam'])
    ?? zoekEerste(o, ['volledigeNaam', 'naamRechthebbende']);
  const natuurlijkeNaam = volledigeNaam ?? [voornamen, geslachtsnaam].filter(Boolean).join(' ').trim() || null;
  const bedrijfsnaam = zoekEerste(onderneming, ['statutaireNaam', 'bedrijfsnaam', 'naam', 'handelsnaam', 'organisatieNaam'])
    ?? zoekEerste(o, ['bedrijfsnaam', 'statutaireNaam', 'handelsnaam', 'organisatieNaam']);
  const naam = bedrijfsnaam ?? natuurlijkeNaam ?? zoekEerste(o, ['naam']);
  if (!naam) return null;

  const persoonType: Kandidaat['persoonType'] = onderneming || bedrijfsnaam
    ? 'rechtspersoon'
    : persoon || natuurlijkeNaam ? 'natuurlijk' : null;
  const bronVoorAdres = onderneming ?? persoon ?? o;
  const adres = leesAdres(bronVoorAdres);

  return {
    naam,
    bedrijfsnaam,
    persoonType,
    voornamen,
    voorletters: zoekEerste(persoon, ['voorletters', 'initialen', 'initials']) ?? maakVoorletters(voornamen),
    type: zoekEerste(o, ['soortRechthebbende', 'typeRechthebbende', 'rechtsvorm', 'type', 'soort']),
    kvkNummer: zoekEerste(onderneming, ['kvkNummer', 'kvk', 'kvkNumber']) ?? zoekEerste(o, ['kvkNummer', 'kvk', 'kvkNumber']),
    adresRegels: adres.regels,
    postcode: adres.postcode,
    plaats: adres.plaats,
    aandeel: zoekEerste(o, ['aandeel', 'aandeelInRecht', 'breukdeel', 'gerechtigdAandeel']) ?? inherited.aandeel,
    rechtsoort: zoekEerste(o, ['rechtsoort', 'soortRecht', 'aardRecht', 'aardRechtVerkort', 'omschrijvingRecht', 'zakelijkRecht', 'recht']) ?? inherited.rechtsoort,
  };
}

function kandidatenUitBlok(v: unknown): Kandidaat[] {
  const out: Kandidaat[] = [];
  const walk = (node: unknown, inherited: { aandeel: string | null; rechtsoort: string | null }, depth: number) => {
    if (depth > 5) return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, inherited, depth + 1));
      return;
    }
    const o = obj(node);
    if (!o) return;
    const next = {
      aandeel: zoekEerste(o, ['aandeel', 'aandeelInRecht', 'breukdeel', 'gerechtigdAandeel']) ?? inherited.aandeel,
      rechtsoort: zoekEerste(o, ['rechtsoort', 'soortRecht', 'aardRecht', 'aardRechtVerkort', 'omschrijvingRecht', 'zakelijkRecht', 'recht']) ?? inherited.rechtsoort,
    };
    const kandidaat = kandidaatUitObject(o, next);
    if (kandidaat) out.push(kandidaat);
    for (const key of ['persons', 'entities', 'rechthebbenden', 'personen', 'persoon', 'natuurlijkPersoon', 'onderneming', 'nietNatuurlijkPersoon', 'rechtspersoon', 'organisatie']) {
      if (o[key] != null) walk(o[key], next, depth + 1);
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
    const gevonden = blokken.flatMap(kandidatenUitBlok);
    if (gevonden.length === 0 && record.rechthebbende_naam) {
      gevonden.push({
        naam: record.rechthebbende_naam,
        bedrijfsnaam: record.rechthebbende_type?.toLowerCase().includes('rechtspersoon') ? record.rechthebbende_naam : null,
        persoonType: record.rechthebbende_type?.toLowerCase().includes('rechtspersoon') ? 'rechtspersoon' : null,
        voornamen: null,
        voorletters: null,
        type: record.rechthebbende_type,
        kvkNummer: null,
        adresRegels: [],
        postcode: null,
        plaats: null,
        aandeel: record.aandeel,
        rechtsoort: record.rechtsoort,
      });
    }

    for (const kandidaat of gevonden) {
      const norm = normaliseerPartijNaam(kandidaat.naam);
      if (!norm) continue;
      const kvkSchoon = kandidaat.kvkNummer?.replace(/\D/g, '') ?? '';
      const sleutel = kvkSchoon ? `kvk:${kvkSchoon}` : `naam:${norm}`;
      const bestaand = map.get(sleutel);
      const bronAdres = tekst(record.zoekadres?.waarde) ?? '';
      if (bestaand) {
        if (!bestaand.bronRecordIds.includes(record.id)) bestaand.bronRecordIds.push(record.id);
        if (bronAdres && !bestaand.bronAdressen.includes(bronAdres)) bestaand.bronAdressen.push(bronAdres);
        bestaand.kvkNummer ||= kandidaat.kvkNummer;
        bestaand.bedrijfsnaam ||= kandidaat.bedrijfsnaam;
        bestaand.voornamen ||= kandidaat.voornamen;
        bestaand.voorletters ||= kandidaat.voorletters;
        bestaand.persoonType ||= kandidaat.persoonType;
        bestaand.adresRegels = [...new Set([...bestaand.adresRegels, ...kandidaat.adresRegels])];
        bestaand.postcode ||= kandidaat.postcode;
        bestaand.plaats ||= kandidaat.plaats;
        bestaand.aandeel ||= kandidaat.aandeel;
        bestaand.rechtsoort ||= kandidaat.rechtsoort;
        bestaand.kadastraleAanduiding ||= record.kadastrale_aanduiding;
      } else {
        map.set(sleutel, {
          sleutel,
          naam: kandidaat.naam,
          bedrijfsnaam: kandidaat.bedrijfsnaam,
          persoonType: kandidaat.persoonType,
          voornamen: kandidaat.voornamen,
          voorletters: kandidaat.voorletters,
          type: kandidaat.type ?? record.rechthebbende_type,
          kvkNummer: kandidaat.kvkNummer,
          adresRegels: kandidaat.adresRegels,
          postcode: kandidaat.postcode,
          plaats: kandidaat.plaats,
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
  const naam = normaliseerPartijNaam(voorstel.bedrijfsnaam ?? voorstel.naam);
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
