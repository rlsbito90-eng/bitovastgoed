// Tests voor de "Brief voorbereiden"-helpers (V1.1).
import { describe, it, expect } from 'vitest';
import {
  BITO_CONTACT, VERZENDADRES_PLACEHOLDER,
  bepaalAanhef, bouwBriefPrefill, bouwBriefTekst,
  bouwGeadresseerdeBlok, bouwObjectAdresVoorBrief,
  bouwObjectOmschrijvingVoorstel,
  extraheerEigenaarKandidaten, extraheerRechthebbendenUitRecord,
  getAchternaam, kanBriefVoorbereiden,
} from '@/lib/offMarket/brief';
import { bouwPrintbareHtml } from '@/components/offmarket/BriefVoorbereidenDialog';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';

function maakSignaal(p: Partial<OffMarketSignaal> = {}): OffMarketSignaal {
  return {
    id: 'sig-1',
    titel: 'Marco Polostraat 251-H',
    adres: 'Marco Polostraat 251-H',
    postcode: null,
    plaats: 'Amsterdam',
    eigenaarstatus: 'onbekend',
    ...(p as any),
  } as OffMarketSignaal;
}

function maakKadasterRecord(p: Partial<KadasterDataRecord>): KadasterDataRecord {
  return {
    id: 'rec-1',
    object_id: null,
    signaal_id: 'sig-1',
    source: 'kadaster_objectinformatie_api',
    mode: 'kadaster',
    product_code: 'rechten' as any,
    status: 'geleverd' as any,
    zoekadres: {},
    fetched_at: new Date().toISOString(),
    koopsom: null, koopjaar: null, koopsom_valuta: null,
    meer_onroerend_goed: null, doelbinding: null,
    bag_bouwjaar: null, bag_oppervlakte: null, bag_object_status: null, bag_gebruiksdoel: null,
    woz_objectnummer: null, woz_oppervlakte: null, woz_oppervlakte_wonen: null,
    woz_oppervlakte_niet_wonen: null, woz_inhoud: null, woz_gebruiksklasse: null,
    feitelijk_gebruik: null, monumentaanduiding: null, actualiteit: null,
    rechten_samenvatting: null, rechthebbende_naam: null, rechthebbende_type: null,
    rechtsoort: null, aandeel: null, kadastrale_aanduiding: null,
    raw_limited: {},
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...p,
  };
}

describe('brief — objectadres opbouw', () => {
  it('schoont signaalwoorden zoals "Aanvraag" en "Vergunning" uit het objectadres', () => {
    const s = maakSignaal({ adres: 'Aanvraag Omgevingsvergunning Marco Polostraat 251-H', plaats: 'Amsterdam' });
    const adres = bouwObjectAdresVoorBrief(s);
    expect(adres.toLowerCase()).not.toMatch(/aanvraag/);
    expect(adres.toLowerCase()).not.toMatch(/vergunning/);
    expect(adres).toContain('Marco Polostraat 251-H');
    expect(adres).toContain('Amsterdam');
  });

  it('behoudt toevoegingen zoals 256A-01, 35-H, 77A-02, 340-B', () => {
    expect(bouwObjectAdresVoorBrief(maakSignaal({
      adres: 'Nieuwe Binnenweg 256A-01', postcode: '3021GP', plaats: 'Rotterdam',
    }))).toBe('Nieuwe Binnenweg 256A-01, 3021GP Rotterdam');
    expect(bouwObjectAdresVoorBrief(maakSignaal({
      adres: 'Stuyvesantstraat 35-H', plaats: 'Amsterdam',
    }))).toBe('Stuyvesantstraat 35-H, Amsterdam');
    expect(bouwObjectAdresVoorBrief(maakSignaal({
      adres: 'Maaskade 77A-02', plaats: 'Rotterdam',
    }))).toContain('77A-02');
    expect(bouwObjectAdresVoorBrief(maakSignaal({
      adres: 'Prinsengracht 340-B', plaats: 'Amsterdam',
    }))).toContain('340-B');
  });
});

describe('brief — objectomschrijving voorstel', () => {
  it('voorstel bevat "te <plaats>"', () => {
    expect(bouwObjectOmschrijvingVoorstel(maakSignaal({
      adres: 'Prinsengracht 340-B', plaats: 'Amsterdam',
    }))).toBe('Prinsengracht 340-B te Amsterdam');
  });
  it('voorkomt dubbele plaatsnaam', () => {
    expect(bouwObjectOmschrijvingVoorstel(maakSignaal({
      adres: 'Marco Polostraat 251-H Amsterdam', plaats: 'Amsterdam',
    }))).toBe('Marco Polostraat 251-H Amsterdam');
  });
});

describe('brief — aanhef', () => {
  it('valt terug op neutrale aanhef zonder achternaam', () => {
    expect(bepaalAanhef(null)).toBe('Geachte heer/mevrouw,');
    expect(bepaalAanhef('')).toBe('Geachte heer/mevrouw,');
  });
  it('gebruikt de achternaam wanneer beschikbaar', () => {
    expect(bepaalAanhef('Jan de Jong')).toBe('Geachte heer/mevrouw Jong,');
    expect(getAchternaam('P. van der Berg')).toBe('Berg');
  });
});

describe('brief — Kadaster rechthebbende-adres extractie', () => {
  it('extraheert naam + verzendadres uit raw_limited.rechten.blokken[*].persons', () => {
    const r = maakKadasterRecord({
      rechthebbende_naam: 'Anneka Treon',
      raw_limited: {
        rechten: {
          blokken: [{
            persons: [{
              naam: 'Treon',
              voornamen: 'Anneka',
              adres: {
                straat: 'De Borcht',
                huisnummer: '3',
                postcode: '1083AC',
                plaats: 'Amsterdam',
              },
            }],
          }],
        },
      },
    });
    const rh = extraheerRechthebbendenUitRecord(r);
    expect(rh.length).toBe(1);
    expect(rh[0].naam).toBe('Anneka Treon');
    expect(rh[0].verzendadres).toContain('De Borcht 3');
    expect(rh[0].verzendadres).toContain('1083AC Amsterdam');
  });

  it('verwisselt verzendadres en objectadres niet', () => {
    const s = maakSignaal({ adres: 'Prinsengracht 340-B', plaats: 'Amsterdam' });
    const r = maakKadasterRecord({
      rechthebbende_naam: 'Anneka Treon',
      raw_limited: {
        rechten: { blokken: [{ persons: [{
          naam: 'Treon', voornamen: 'Anneka',
          adres: { straat: 'De Borcht', huisnummer: '3', postcode: '1083AC', plaats: 'Amsterdam' },
        }] }] },
      },
    });
    const p = bouwBriefPrefill(s, [r]);
    expect(p.verzendadres).toContain('De Borcht 3');
    expect(p.verzendadres).not.toContain('Prinsengracht');
    expect(p.objectadres).toContain('Prinsengracht 340-B');
    expect(p.objectadres).not.toContain('De Borcht');
  });

  it('zonder Kadaster-adres blijft verzendadres leeg', () => {
    const r = maakKadasterRecord({
      rechthebbende_naam: 'Treon Vastgoed B.V.',
      raw_limited: { rechten: { blokken: [{ persons: [{ naam: 'Treon Vastgoed B.V.' }] }] } },
    });
    const k = extraheerEigenaarKandidaten(maakSignaal(), [r]);
    expect(k.length).toBe(1);
    expect(k[0].verzendadres).toBeNull();
  });

  it('valt netjes terug zonder blokken', () => {
    const r = maakKadasterRecord({ raw_limited: {} });
    expect(extraheerRechthebbendenUitRecord(r)).toEqual([]);
  });

  it('accepteert voorgeformatteerd string-adres', () => {
    const r = maakKadasterRecord({
      raw_limited: { rechten: { blokken: [{ persons: [{
        naam: 'Jansen',
        adres: 'Hoofdstraat 1\n1234 AB Amsterdam',
      }] }] } },
    });
    const rh = extraheerRechthebbendenUitRecord(r);
    expect(rh[0].verzendadres).toContain('Hoofdstraat 1');
    expect(rh[0].verzendadres).toContain('1234 AB Amsterdam');
  });
});

describe('brief — kandidaten', () => {
  it('geeft eigenaar_naam voorrang boven Kadaster-rechthebbende', () => {
    const s = maakSignaal({ eigenaar_naam: 'Jan Jansen' } as any);
    const recs = [maakKadasterRecord({
      rechthebbende_naam: 'Treon Vastgoed B.V.',
      raw_limited: { rechten: { blokken: [{ persons: [{ naam: 'Treon Vastgoed B.V.' }] }] } },
    })];
    const k = extraheerEigenaarKandidaten(s, recs);
    expect(k[0].naam).toBe('Jan Jansen');
    expect(k.length).toBe(2);
  });
});

describe('brief — kan voorbereiden', () => {
  it('ok als alleen Kadaster rechthebbende beschikbaar is', () => {
    const recs = [maakKadasterRecord({
      rechthebbende_naam: 'Treon Vastgoed B.V.',
      raw_limited: { rechten: { blokken: [{ persons: [{ naam: 'Treon Vastgoed B.V.' }] }] } },
    })];
    expect(kanBriefVoorbereiden(maakSignaal(), recs).ok).toBe(true);
  });
});

describe('brief — tekst en prefill', () => {
  it('brieftekst bevat objectomschrijving (niet blind objectadres)', () => {
    const t = bouwBriefTekst({
      aanhef: 'Geachte heer/mevrouw,',
      objectadres: 'Prinsengracht 340-A en 340-B te Amsterdam',
    });
    expect(t).toContain('Prinsengracht 340-A en 340-B te Amsterdam');
    expect(t).not.toMatch(/kadaster/i);
    expect(t).not.toMatch(/radar/i);
    expect(t).not.toMatch(/signaal/i);
    expect(t).not.toMatch(/\[telefoonnummer\]/i);
  });

  it('prefill vult objectomschrijving en verzendadres uit Kadaster', () => {
    const s = maakSignaal({ adres: 'Prinsengracht 340-B', plaats: 'Amsterdam' });
    const r = maakKadasterRecord({
      raw_limited: { rechten: { blokken: [{ persons: [{
        naam: 'Treon', voornamen: 'Anneka',
        adres: { straat: 'De Borcht', huisnummer: '3', postcode: '1083AC', plaats: 'Amsterdam' },
      }] }] } },
    });
    const p = bouwBriefPrefill(s, [r]);
    expect(p.eigenaarNaam).toBe('Anneka Treon');
    expect(p.verzendadres).toContain('De Borcht 3');
    expect(p.objectomschrijving).toBe('Prinsengracht 340-B te Amsterdam');
    expect(p.brieftekst).toContain('Prinsengracht 340-B te Amsterdam');
  });

  it('BITO_CONTACT bevat het juiste telefoonnummer', () => {
    expect(BITO_CONTACT.telefoon).toBe('+31 6 16 98 76 06');
  });
});

describe('brief — printbare html', () => {
  it('bevat onderwerp, datum, brieftekst en geadresseerde', () => {
    const html = bouwPrintbareHtml({
      eigenaarNaam: 'Anneka Treon',
      eigenaarBedrijfsnaam: '',
      verzendadres: 'De Borcht 3\n1083AC Amsterdam',
      onderwerp: 'Vrijblijvende interesse in vastgoedbezit',
      brieftekst: bouwBriefTekst({ aanhef: 'Geachte heer/mevrouw Treon,', objectadres: 'Prinsengracht 340-B te Amsterdam' }),
    });
    expect(html).toContain('Vrijblijvende interesse in vastgoedbezit');
    expect(html).toContain('Anneka Treon');
    expect(html).toContain('De Borcht 3');
    expect(html).toContain('1083AC Amsterdam');
    expect(html).toContain('Prinsengracht 340-B te Amsterdam');
    expect(html).toContain('+31 6 16 98 76 06');
  });

  it('placeholdertekst wordt niet als verzendadres in print getoond', () => {
    const html = bouwPrintbareHtml({
      eigenaarNaam: 'Jan Jansen',
      eigenaarBedrijfsnaam: '',
      verzendadres: VERZENDADRES_PLACEHOLDER,
      onderwerp: 'Test',
      brieftekst: 'Body',
    });
    expect(html).not.toContain('Straat 1');
    expect(html).not.toContain('1234 AB Plaats');
    expect(html).toContain('Geen verzendadres');
  });
});

describe('brief — geadresseerdeblok', () => {
  it('combineert bedrijfsnaam, naam en adresregels', () => {
    const lines = bouwGeadresseerdeBlok({
      naam: 'Anneka Treon',
      bedrijfsnaam: '',
      verzendadres: 'De Borcht 3\n1083AC Amsterdam',
    });
    expect(lines).toEqual(['Anneka Treon', 'De Borcht 3', '1083AC Amsterdam']);
  });
});
