// Tests voor de "Brief voorbereiden"-helpers.
import { describe, it, expect } from 'vitest';
import {
  BITO_CONTACT, bepaalAanhef, bouwBriefPrefill, bouwBriefTekst,
  bouwGeadresseerdeBlok, bouwObjectAdresVoorBrief, extraheerEigenaarKandidaten,
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
    expect(adres.toLowerCase()).not.toMatch(/besluit/);
    expect(adres).toContain('Marco Polostraat 251-H');
    expect(adres).toContain('Amsterdam');
  });

  it('behoudt toevoegingen zoals 256A-01 en huisletter 35-H', () => {
    expect(bouwObjectAdresVoorBrief(maakSignaal({
      adres: 'Nieuwe Binnenweg 256A-01', postcode: '3021GP', plaats: 'Rotterdam',
    }))).toBe('Nieuwe Binnenweg 256A-01, 3021GP Rotterdam');
    expect(bouwObjectAdresVoorBrief(maakSignaal({
      adres: 'Stuyvesantstraat 35-H', plaats: 'Amsterdam',
    }))).toBe('Stuyvesantstraat 35-H, Amsterdam');
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

describe('brief — kandidaten', () => {
  it('geeft eigenaar_naam voorrang boven Kadaster-rechthebbende', () => {
    const s = maakSignaal({ eigenaar_naam: 'Jan Jansen' } as any);
    const recs = [maakKadasterRecord({ rechthebbende_naam: 'Treon Vastgoed B.V.', rechthebbende_type: 'NIET_NATUURLIJK_PERSOON' })];
    const k = extraheerEigenaarKandidaten(s, recs);
    expect(k[0].naam).toBe('Jan Jansen');
    expect(k.length).toBe(2);
    expect(k[1].bedrijfsnaam).toBe('Treon Vastgoed B.V.');
  });
  it('gebruikt bedrijfsnaam wanneer naam ontbreekt', () => {
    const s = maakSignaal({ eigenaar_bedrijfsnaam: 'Treon Vastgoed B.V.' } as any);
    const k = extraheerEigenaarKandidaten(s, []);
    expect(k[0].naam).toBeNull();
    expect(k[0].bedrijfsnaam).toBe('Treon Vastgoed B.V.');
  });
});

describe('brief — kan voorbereiden', () => {
  it('disabled zonder objectadres', () => {
    const s = maakSignaal({ adres: null, titel: '' } as any);
    expect(kanBriefVoorbereiden(s, []).ok).toBe(false);
  });
  it('disabled zonder eigenaar/rechthebbende', () => {
    expect(kanBriefVoorbereiden(maakSignaal(), []).ok).toBe(false);
  });
  it('ok als objectadres + eigenaar bekend zijn', () => {
    const s = maakSignaal({ eigenaar_naam: 'Jan Jansen' } as any);
    expect(kanBriefVoorbereiden(s, []).ok).toBe(true);
  });
  it('ok als alleen Kadaster rechthebbende beschikbaar is', () => {
    const recs = [maakKadasterRecord({ rechthebbende_naam: 'Treon Vastgoed B.V.' })];
    expect(kanBriefVoorbereiden(maakSignaal(), recs).ok).toBe(true);
  });
});

describe('brief — tekst en prefill', () => {
  it('bevat vaste Bito-contactgegevens en sleutelzin', () => {
    const t = bouwBriefTekst({ aanhef: 'Geachte heer/mevrouw,', objectadres: 'Marco Polostraat 251-H, Amsterdam' });
    expect(t).toContain('+31 6 16 98 76 06');
    expect(t).toContain('info@bitovastgoed.nl');
    expect(t).toContain('Ramysh Bito');
    expect(t).toContain('Bito Vastgoed');
    expect(t).toContain('dit pand, ander vastgoed of een bredere vastgoedportefeuille');
    expect(t).toContain('Marco Polostraat 251-H, Amsterdam');
    expect(t).not.toMatch(/\[telefoonnummer\]/i);
    expect(t).not.toMatch(/kadaster/i);
    expect(t).not.toMatch(/radar/i);
    expect(t).not.toMatch(/signaal/i);
  });

  it('prefill neemt eigenaar_naam, objectadres en kandidaten over', () => {
    const s = maakSignaal({ eigenaar_naam: 'Jan Jansen' } as any);
    const p = bouwBriefPrefill(s, []);
    expect(p.eigenaarNaam).toBe('Jan Jansen');
    expect(p.objectadres).toContain('Marco Polostraat 251-H');
    expect(p.aanhef).toBe('Geachte heer/mevrouw Jansen,');
    expect(p.onderwerp).toMatch(/vastgoedbezit/i);
    expect(p.brieftekst).toContain('Marco Polostraat 251-H');
  });

  it('BITO_CONTACT bevat het juiste telefoonnummer', () => {
    expect(BITO_CONTACT.telefoon).toBe('+31 6 16 98 76 06');
  });
});

describe('brief — printbare html', () => {
  it('bevat onderwerp, datum, brieftekst en geadresseerde', () => {
    const html = bouwPrintbareHtml({
      eigenaarNaam: 'Jan Jansen',
      eigenaarBedrijfsnaam: 'Jansen Vastgoed',
      verzendadres: 'Hoofdstraat 1\n1234 AB Amsterdam',
      onderwerp: 'Vrijblijvende interesse in vastgoedbezit',
      brieftekst: bouwBriefTekst({ aanhef: 'Geachte heer/mevrouw Jansen,', objectadres: 'Marco Polostraat 251-H, Amsterdam' }),
    });
    expect(html).toContain('Vrijblijvende interesse in vastgoedbezit');
    expect(html).toContain('Jansen Vastgoed');
    expect(html).toContain('Hoofdstraat 1');
    expect(html).toContain('Marco Polostraat 251-H');
    expect(html).toContain('+31 6 16 98 76 06');
  });
});

describe('brief — geadresseerdeblok', () => {
  it('combineert bedrijfsnaam, naam en adresregels', () => {
    const lines = bouwGeadresseerdeBlok({
      naam: 'Jan Jansen',
      bedrijfsnaam: 'Jansen Vastgoed',
      verzendadres: 'Hoofdstraat 1\n1234 AB Amsterdam',
    });
    expect(lines).toEqual(['Jansen Vastgoed', 'Jan Jansen', 'Hoofdstraat 1', '1234 AB Amsterdam']);
  });
});
