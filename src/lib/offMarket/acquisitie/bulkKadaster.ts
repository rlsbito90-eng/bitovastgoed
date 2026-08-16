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
}

function compactPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, '').toUpperCase();
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

function heeftPdfVoorRecord(
  record: BulkKadasterBestaandRecord,
  documenten: BulkKadasterBestaandDocument[],
): boolean {
  const direct = documenten.some((d) =>
    d.signaal_id === record.signaal_id
    && d.kadaster_data_record_id === record.id
    && (d.product_codes ?? []).includes('rechten'),
  );
  if (direct) return true;

  const rt = new Date(record.fetched_at).getTime();
  return documenten.some((d) => {
    if (d.signaal_id !== record.signaal_id) return false;
    if (!(d.product_codes ?? []).includes('rechten')) return false;
    const dt = Math.abs(new Date(d.fetched_at).getTime() - rt);
    return Number.isFinite(dt) && dt <= 5 * 60 * 1000;
  });
}

export function bouwBulkKadasterPreflight(
  signalen: OffMarketSignaal[],
  records: BulkKadasterBestaandRecord[],
  documenten: BulkKadasterBestaandDocument[],
): BulkKadasterPreflightRij[] {
  return signalen.map((signaal) => {
    const adres = bepaalBulkKadasterAdres(signaal);
    if (adres.status === 'geblokkeerd') {
      return {
        signaal,
        status: 'geblokkeerd',
        adresInput: null,
        zoekadresLabel: null,
        reden: adres.reden ?? 'Adres moet eerst worden gecontroleerd.',
        bestaandRecordId: null,
      };
    }

    const bestaand = records.find((r) =>
      r.signaal_id === signaal.id
      && r.product_code === 'rechten'
      && (r.status === 'geleverd' || r.status === 'gedeeltelijk'),
    );
    if (bestaand) {
      const metPdf = heeftPdfVoorRecord(bestaand, documenten);
      return {
        signaal,
        status: 'aanwezig',
        adresInput: adres.adresInput,
        zoekadresLabel: adres.zoekadresLabel,
        reden: metPdf
          ? 'Rechten + intern Kadasterbericht zijn al aanwezig; geen nieuwe betaalde aanvraag.'
          : 'Rechten zijn al opgehaald, maar het interne PDF-bericht ontbreekt. Veiligheidshalve geen nieuwe betaalde aanvraag; eerst handmatig controleren.',
        bestaandRecordId: bestaand.id,
      };
    }

    return {
      signaal,
      status: 'aanvragen',
      adresInput: adres.adresInput,
      zoekadresLabel: adres.zoekadresLabel,
      reden: 'Nieuwe Rechten-aanvraag nodig.',
      bestaandRecordId: null,
    };
  });
}
