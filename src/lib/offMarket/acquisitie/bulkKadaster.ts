import { zoekBagAdressen, type BagAdresResultaat } from '@/lib/bag/pdokLookup';
import { parseObjectAdres } from '@/lib/kadaster/adres';
import type { KadasterAdresInput } from '@/lib/kadaster/types';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export type BulkKadasterPreflightStatus = 'aanvragen' | 'aanwezig' | 'geblokkeerd';

export interface BulkKadasterAdresResultaat {
  status: 'klaar' | 'geblokkeerd';
  adresInput: KadasterAdresInput | null;
  zoekadresLabel: string | null;
  reden: string | null;
}

export interface BulkKadasterBestaandRecord {
  id: string;
  signaal_id: string | null;
  product_code: string;
  status: string;
  fetched_at: string;
  zoekadres?: Record<string, unknown> | null;
  raw_limited?: Record<string, unknown> | null;
}

export interface BulkKadasterBestaandDocument {
  id: string;
  signaal_id: string | null;
  kadaster_data_record_id: string | null;
  product_codes: string[] | null;
  fetched_at: string;
}

export interface BulkKadasterPreflightRij {
  signaal: OffMarketSignaal;
  status: BulkKadasterPreflightStatus;
  adresInput: KadasterAdresInput | null;
  zoekadresLabel: string | null;
  reden: string;
  bestaandRecordId: string | null;
  bestaandDocumentId: string | null;
}

type BagZoeker = (input: {
  straat?: string | null;
  huisnummer?: string | null;
  plaats?: string | null;
  postcode?: string | null;
}) => Promise<BagAdresResultaat[]>;

function compactPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, '').toUpperCase();
}

function norm(v: string | null | undefined): string {
  return (v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function straatKomtOvereen(a: string | null | undefined, b: string | null | undefined): boolean {
  const links = norm(a);
  const rechts = norm(b);
  if (!links || !rechts) return false;
  return links === rechts || links.endsWith(` ${rechts}`) || rechts.endsWith(` ${links}`);
}

function bagHuisnummerLabel(r: BagAdresResultaat): string {
  const base = r.huisnummer ?? '';
  const letter = r.huisletter ?? '';
  const toevoeging = r.huisnummertoevoeging ?? '';
  if (!base) return '';
  if (letter && toevoeging) return `${base}-${letter}${toevoeging}`;
  if (letter) return `${base}-${letter}`;
  if (toevoeging) return `${base}-${toevoeging}`;
  return base;
}

function normaliseerLabel(v: string | null | undefined): string {
  return (v ?? '')
    .toUpperCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normaliseerZoekadres(v: string | null | undefined): string {
  return (v ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function bagVoorkeurScore(r: BagAdresResultaat, explicietLabel: string | null): number {
  const label = normaliseerLabel(bagHuisnummerLabel(r));
  const exact = normaliseerLabel(explicietLabel);
  if (exact && label === exact) return 0;
  const suffix = label.includes('-') ? label.slice(label.indexOf('-') + 1) : '';
  if (suffix === 'H') return 10;
  if (suffix === '1') return 20;
  if (suffix === 'A') return 30;
  if (suffix) return 40;
  return 50;
}

function adresUitBag(r: BagAdresResultaat, reden = 'Zoekadres gratis bevestigd via BAG/PDOK.'): BulkKadasterAdresResultaat | null {
  if (!r.postcode || !r.huisnummer) return null;
  const postcode = compactPostcode(r.postcode);
  if (!/^\d{4}[A-Z]{2}$/.test(postcode)) return null;
  const adresInput: KadasterAdresInput = {
    postalcode: postcode,
    houseNumber: r.huisnummer,
    houseLetter: r.huisletter ?? null,
    houseNumberAddition: r.huisnummertoevoeging ?? null,
  };
  const zoekadresLabel = [
    postcode,
    `${r.huisnummer}${r.huisletter ?? ''}`,
    r.huisnummertoevoeging ?? null,
  ].filter(Boolean).join(' ');
  return {
    status: 'klaar',
    adresInput,
    zoekadresLabel,
    reden,
  };
}

function opgeslagenBagKandidaten(signaal: OffMarketSignaal): BagAdresResultaat[] {
  const raw = (signaal as any).bag_match_kandidaten;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((k): k is Record<string, unknown> => !!k && typeof k === 'object')
    .map((k) => ({
      straat: typeof k.openbareruimte === 'string'
        ? k.openbareruimte
        : (typeof k.straat === 'string' ? k.straat : ''),
      huisnummer: k.huisnummer == null ? null : String(k.huisnummer),
      huisletter: typeof k.huisletter === 'string' ? k.huisletter : null,
      huisnummertoevoeging: typeof k.huisnummertoevoeging === 'string' ? k.huisnummertoevoeging : null,
      postcode: typeof k.postcode === 'string'
        ? k.postcode
        : (typeof k.postcode_normalized === 'string' ? k.postcode_normalized : null),
      woonplaats: typeof k.woonplaats === 'string' ? k.woonplaats : null,
    } as BagAdresResultaat));
}

function kiesBagKandidaat(
  kandidaten: BagAdresResultaat[],
  straat: string,
  huisnummer: string,
  plaats: string,
  explicietLabel: string | null,
): BagAdresResultaat | null {
  const officieel = kandidaten.filter((r) =>
    straatKomtOvereen(r.straat, straat)
    && String(r.huisnummer ?? '') === huisnummer
    && norm(r.woonplaats) === norm(plaats),
  );
  if (officieel.length === 0) return null;

  return [...officieel].sort((a, b) => {
    const pref = bagVoorkeurScore(a, explicietLabel) - bagVoorkeurScore(b, explicietLabel);
    if (pref !== 0) return pref;
    return bagHuisnummerLabel(a).localeCompare(bagHuisnummerLabel(b), 'nl', { numeric: true });
  })[0] ?? null;
}

export function bepaalBulkKadasterAdres(signaal: OffMarketSignaal): BulkKadasterAdresResultaat {
  const parsed = parseObjectAdres(
    signaal.adres ?? signaal.titel ?? '',
    (signaal as any).postcode ?? null,
    signaal.plaats ?? null,
  );

  if (!parsed.postcode) {
    return {
      status: 'geblokkeerd',
      adresInput: null,
      zoekadresLabel: null,
      reden: 'Geen geldige postcode beschikbaar.',
    };
  }
  if (parsed.huisnummers.length === 0) {
    return {
      status: 'geblokkeerd',
      adresInput: null,
      zoekadresLabel: null,
      reden: 'Geen betrouwbaar huisnummer herkend.',
    };
  }
  if (parsed.huisnummers.length > 1) {
    return {
      status: 'geblokkeerd',
      adresInput: null,
      zoekadresLabel: null,
      reden: `Meerdere mogelijke huisnummers (${parsed.huisnummers.map(h => h.label).join(', ')}); kies eerst het juiste BAG-/zoekadres in het dossier.`,
    };
  }

  const h = parsed.huisnummers[0];
  const postcode = compactPostcode(parsed.postcode);
  const adresInput: KadasterAdresInput = {
    postalcode: postcode,
    houseNumber: h.huisnummer,
    houseLetter: h.huisletter ?? null,
    houseNumberAddition: h.toevoeging ?? null,
  };
  const zoekadresLabel = [
    postcode,
    `${h.huisnummer}${h.huisletter ?? ''}`,
    h.toevoeging ?? null,
  ].filter(Boolean).join(' ');

  return { status: 'klaar', adresInput, zoekadresLabel, reden: null };
}

export async function bepaalBulkKadasterAdresMetBag(
  signaal: OffMarketSignaal,
  bagZoeker: BagZoeker = zoekBagAdressen,
): Promise<BulkKadasterAdresResultaat> {
  const direct = bepaalBulkKadasterAdres(signaal);
  if (direct.status === 'klaar') return direct;

  const parsed = parseObjectAdres(
    signaal.adres ?? signaal.titel ?? '',
    (signaal as any).postcode ?? null,
    signaal.plaats ?? null,
  );
  const eerste = parsed.huisnummers[0] ?? null;
  const straat = parsed.straat?.trim() ?? '';
  const plaats = signaal.plaats?.trim() ?? parsed.plaats?.trim() ?? '';
  if (!straat || !plaats || !eerste?.huisnummer) return direct;

  const explicietLabel = (eerste.huisletter || eerste.toevoeging) ? eerste.label : null;

  const opgeslagen = kiesBagKandidaat(
    opgeslagenBagKandidaten(signaal),
    straat,
    eerste.huisnummer,
    plaats,
    explicietLabel,
  );
  if (opgeslagen) {
    return adresUitBag(opgeslagen, 'Zoekadres bevestigd via reeds opgeslagen BAG-kandidaten.') ?? direct;
  }

  const raw = await bagZoeker({
    straat,
    huisnummer: eerste.huisnummer,
    plaats,
    postcode: null,
  });
  const kandidaat = kiesBagKandidaat(raw, straat, eerste.huisnummer, plaats, explicietLabel);
  return kandidaat ? (adresUitBag(kandidaat) ?? direct) : direct;
}

function documentVoorRecord(
  record: BulkKadasterBestaandRecord,
  documenten: BulkKadasterBestaandDocument[],
): BulkKadasterBestaandDocument | null {
  const direct = documenten.find((d) =>
    d.signaal_id === record.signaal_id
    && d.kadaster_data_record_id === record.id
    && (d.product_codes ?? []).includes('rechten'),
  );
  if (direct) return direct;

  const rt = new Date(record.fetched_at).getTime();
  return documenten.find((d) => {
    if (d.signaal_id !== record.signaal_id) return false;
    if (!(d.product_codes ?? []).includes('rechten')) return false;
    const dt = Math.abs(new Date(d.fetched_at).getTime() - rt);
    return Number.isFinite(dt) && dt <= 5 * 60 * 1000;
  }) ?? null;
}

function bestaandRechtenRecord(
  signaalId: string,
  records: BulkKadasterBestaandRecord[],
): BulkKadasterBestaandRecord | undefined {
  return records.find((r) =>
    r.signaal_id === signaalId
    && r.product_code === 'rechten'
    && (r.status === 'geleverd' || r.status === 'gedeeltelijk'),
  );
}

function definitieveNotFoundVoorZoekadres(
  signaalId: string,
  zoekadresLabel: string | null,
  records: BulkKadasterBestaandRecord[],
): BulkKadasterBestaandRecord | undefined {
  if (!zoekadresLabel) return undefined;
  const kandidaat = normaliseerZoekadres(zoekadresLabel);
  return records.find((r) => {
    if (r.signaal_id !== signaalId || r.product_code !== 'rechten' || r.status !== 'niet_geleverd') return false;
    const poging = r.raw_limited?.poging;
    const opgeslagenZoekadres = typeof r.zoekadres?.waarde === 'string'
      ? normaliseerZoekadres(String(r.zoekadres.waarde))
      : '';
    return !!poging && typeof poging === 'object'
      && (poging as Record<string, unknown>).uitkomst === 'not_found'
      && opgeslagenZoekadres === kandidaat;
  });
}

function rijVoorBestaand(
  signaal: OffMarketSignaal,
  bestaand: BulkKadasterBestaandRecord,
  documenten: BulkKadasterBestaandDocument[],
): BulkKadasterPreflightRij {
  const document = documentVoorRecord(bestaand, documenten);
  return {
    signaal,
    status: 'aanwezig',
    adresInput: null,
    zoekadresLabel: typeof bestaand.zoekadres?.waarde === 'string'
      ? String(bestaand.zoekadres.waarde)
      : null,
    reden: document
      ? 'Rechten + intern Kadasterbericht zijn al aanwezig; geen nieuwe betaalde aanvraag.'
      : 'Rechten zijn al opgehaald, maar het interne PDF-bericht ontbreekt. Veiligheidshalve geen nieuwe betaalde aanvraag; eerst handmatig controleren.',
    bestaandRecordId: bestaand.id,
    bestaandDocumentId: document?.id ?? null,
  };
}

function rijVoorNotFound(
  signaal: OffMarketSignaal,
  poging: BulkKadasterBestaandRecord,
): BulkKadasterPreflightRij {
  return {
    signaal,
    status: 'geblokkeerd',
    adresInput: null,
    zoekadresLabel: typeof poging.zoekadres?.waarde === 'string' ? String(poging.zoekadres.waarde) : null,
    reden: 'Dit exacte Kadasterzoekadres gaf eerder definitief: geen Kadasterobject gevonden. Dezelfde variant wordt niet automatisch opnieuw betaald aangevraagd; een andere geldige BAG-/adresvariant mag wel opnieuw worden gecontroleerd.',
    bestaandRecordId: poging.id,
    bestaandDocumentId: null,
  };
}

export function bouwBulkKadasterPreflight(
  signalen: OffMarketSignaal[],
  records: BulkKadasterBestaandRecord[],
  documenten: BulkKadasterBestaandDocument[],
): BulkKadasterPreflightRij[] {
  return signalen.map((signaal) => {
    const bestaand = bestaandRechtenRecord(signaal.id, records);
    if (bestaand) return rijVoorBestaand(signaal, bestaand, documenten);

    const adres = bepaalBulkKadasterAdres(signaal);
    if (adres.status === 'geblokkeerd') {
      return {
        signaal,
        status: 'geblokkeerd',
        adresInput: null,
        zoekadresLabel: null,
        reden: adres.reden ?? 'Adres moet eerst worden gecontroleerd.',
        bestaandRecordId: null,
        bestaandDocumentId: null,
      };
    }

    const notFound = definitieveNotFoundVoorZoekadres(signaal.id, adres.zoekadresLabel, records);
    if (notFound) return rijVoorNotFound(signaal, notFound);

    return {
      signaal,
      status: 'aanvragen',
      adresInput: adres.adresInput,
      zoekadresLabel: adres.zoekadresLabel,
      reden: 'Nieuwe Rechten-aanvraag nodig.',
      bestaandRecordId: null,
      bestaandDocumentId: null,
    };
  });
}

export async function bouwBulkKadasterPreflightMetBag(
  signalen: OffMarketSignaal[],
  records: BulkKadasterBestaandRecord[],
  documenten: BulkKadasterBestaandDocument[],
  bagZoeker: BagZoeker = zoekBagAdressen,
): Promise<BulkKadasterPreflightRij[]> {
  const out: BulkKadasterPreflightRij[] = [];
  for (const signaal of signalen) {
    const bestaand = bestaandRechtenRecord(signaal.id, records);
    if (bestaand) {
      out.push(rijVoorBestaand(signaal, bestaand, documenten));
      continue;
    }

    let adres: BulkKadasterAdresResultaat;
    try {
      adres = await bepaalBulkKadasterAdresMetBag(signaal, bagZoeker);
    } catch (e) {
      const direct = bepaalBulkKadasterAdres(signaal);
      adres = direct.status === 'klaar'
        ? direct
        : {
            ...direct,
            reden: `BAG/PDOK-controle mislukt: ${e instanceof Error ? e.message : 'onbekende fout'}. Geen betaalde aanvraag gestart.`,
          };
    }

    if (adres.status === 'geblokkeerd') {
      out.push({
        signaal,
        status: 'geblokkeerd',
        adresInput: null,
        zoekadresLabel: null,
        reden: adres.reden ?? 'Adres moet eerst worden gecontroleerd.',
        bestaandRecordId: null,
        bestaandDocumentId: null,
      });
      continue;
    }

    const notFound = definitieveNotFoundVoorZoekadres(signaal.id, adres.zoekadresLabel, records);
    if (notFound) {
      out.push(rijVoorNotFound(signaal, notFound));
      continue;
    }

    out.push({
      signaal,
      status: 'aanvragen',
      adresInput: adres.adresInput,
      zoekadresLabel: adres.zoekadresLabel,
      reden: adres.reden
        ? `Nieuwe Rechten-aanvraag nodig. ${adres.reden}`
        : 'Nieuwe Rechten-aanvraag nodig.',
      bestaandRecordId: null,
      bestaandDocumentId: null,
    });
  }
  return out;
}
