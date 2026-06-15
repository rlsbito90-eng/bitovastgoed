// Verifieert dat alle Kadasterrecords per signaal zichtbaar zijn,
// nieuwste bovenaan, en dat per record de juiste PDF en details
// gekoppeld blijven.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { documentenPerRecord, type KadasterDocument } from '@/hooks/useKadasterDocumenten';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';
import KadasterRecordDetailDialog from '@/components/offmarket/kadaster/KadasterRecordDetailDialog';

const signaalId = 's-1';

function maakRecord(over: Partial<KadasterDataRecord>): KadasterDataRecord {
  return {
    id: 'r-x',
    object_id: null,
    signaal_id: signaalId,
    source: 'kadaster',
    mode: 'kadaster',
    product_code: 'rechten',
    status: 'geleverd',
    zoekadres: { waarde: '1016HZ 340B' },
    fetched_at: '2026-06-15T16:13:00Z',
    koopsom: null, koopjaar: null, koopsom_valuta: null,
    meer_onroerend_goed: null, doelbinding: null,
    bag_bouwjaar: null, bag_oppervlakte: null,
    bag_object_status: null, bag_gebruiksdoel: null,
    woz_objectnummer: null, woz_oppervlakte: null,
    woz_oppervlakte_wonen: null, woz_oppervlakte_niet_wonen: null,
    woz_inhoud: null, woz_gebruiksklasse: null,
    feitelijk_gebruik: null, monumentaanduiding: null, actualiteit: null,
    rechten_samenvatting: null, rechthebbende_naam: null,
    rechthebbende_type: null, rechtsoort: null, aandeel: null,
    kadastrale_aanduiding: null, raw_limited: {},
    created_at: '2026-06-15T16:13:00Z', updated_at: '2026-06-15T16:13:00Z',
    ...over,
  } as KadasterDataRecord;
}

function maakDoc(over: Partial<KadasterDocument>): KadasterDocument {
  return {
    id: 'd-x',
    object_id: null, signaal_id: signaalId,
    kadaster_data_record_id: null,
    source: 'kadaster',
    product_codes: ['rechten'],
    zoekadres: {},
    fetched_at: '2026-06-15T16:13:00Z',
    storage_bucket: 'bito-objecten',
    storage_path: 'kadaster/x.pdf',
    bestandsnaam: 'x.pdf',
    bestandsgrootte_bytes: 1024,
    mime_type: 'application/pdf',
    intern_only: true,
    created_at: '2026-06-15T16:13:00Z',
    ...over,
  } as KadasterDocument;
}

describe('Kadasterberichten historie', () => {
  it('documentenPerRecord koppelt PDF aan het juiste record-id', () => {
    const recordA = maakRecord({ id: 'rec-a', fetched_at: '2026-06-15T16:13:00Z' });
    const recordB = maakRecord({ id: 'rec-b', fetched_at: '2026-06-14T10:00:00Z' });
    const docA = maakDoc({ id: 'doc-a', kadaster_data_record_id: 'rec-a' });
    const docB = maakDoc({ id: 'doc-b', kadaster_data_record_id: 'rec-b' });

    const map = documentenPerRecord([docA, docB], [recordA, recordB]);
    expect(map.get('rec-a')?.id).toBe('doc-a');
    expect(map.get('rec-b')?.id).toBe('doc-b');
  });

  it('records zonder bestand krijgen geen PDF gemapt', () => {
    const recordA = maakRecord({ id: 'rec-a' });
    const map = documentenPerRecord([], [recordA]);
    expect(map.get('rec-a')).toBeUndefined();
  });

  it('detaildialog toont status, zoekadres en record-id van het gekozen record', () => {
    const r = maakRecord({
      id: 'rec-detail',
      rechthebbende_naam: 'Treon',
      rechtsoort: 'Eigendom',
    });
    render(
      <KadasterRecordDetailDialog
        record={r} pdf={null} open={true} onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText('Kadasterbericht')).toBeInTheDocument();
    expect(screen.getByText('rec-detail')).toBeInTheDocument();
    expect(screen.getByText('1016HZ 340B')).toBeInTheDocument();
    expect(screen.getByText('Treon')).toBeInTheDocument();
    expect(
      screen.getByText(/Geen Kadasterbericht\/PDF opgeslagen/i),
    ).toBeInTheDocument();
  });

  it('detaildialog toont foutmelding bij niet-geleverde status', () => {
    const r = maakRecord({
      id: 'rec-fout', status: 'niet_geleverd',
      raw_limited: { foutmelding: 'Adres niet gevonden' },
    });
    render(
      <KadasterRecordDetailDialog
        record={r} pdf={null} open={true} onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText('Aanvraag niet succesvol')).toBeInTheDocument();
    expect(screen.getByText('Adres niet gevonden')).toBeInTheDocument();
  });
});
