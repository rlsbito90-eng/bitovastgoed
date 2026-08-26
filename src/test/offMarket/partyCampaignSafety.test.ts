import { describe, expect, it } from 'vitest';
import { pasCampagneContextToeAanBrieftekst } from '@/lib/offMarket/acquisitie/campaignBriefText';
import { classificeerConceptVoorVernieuwing, magConceptAutomatischVernieuwen } from '@/lib/offMarket/acquisitie/conceptRefresh';
import { sterkeRadarPartijSleutel } from '@/lib/offMarket/acquisitie/partyIdentity';
import { bepaalWerkvoorraadProjectie } from '@/lib/offMarket/acquisitie/workvoorraadProjection';
import type { RoutingResult } from '@/lib/offMarket/acquisitie/partyCampaign';

const basisRoute = (overrides: Partial<RoutingResult> = {}): RoutingResult => ({
  outcome: 'bundelen_bij_partij',
  werkvoorraadStatus: 'gebundeld_bij_partij',
  reden: 'Zelfde partij, bestaande campagne.',
  briefAdvies: 'geen_brief',
  geadviseerdeStap: null,
  magAutomatischBriefMaken: false,
  magHandmatigBriefMaken: true,
  nieuwHoofdobjectVoorstellen: false,
  huidigObjectScore: null,
  nieuwObjectScore: { score: 50, redenen: ['test'], betrouwbaarheid: 'middel' },
  ...overrides,
});

describe('Radar party/campaign safety', () => {
  it('herkent de oude generieke standaardtekst als veilig legacy', () => {
    const c = classificeerConceptVoorVernieuwing({
      status: 'concept',
      brieftekst: 'Geachte heer/mevrouw,\n\nMijn naam is Ramysh Bito. Vanuit mijn kantoor begeleid ik professionele beleggers, ontwikkelaars en vastgoedondernemers bij de aan- en verkoop van vastgoed.',
    } as any, 'Geachte heer/mevrouw,\n\nNieuwe standaardtekst');
    expect(c).toBe('legacy_standaard');
    expect(magConceptAutomatischVernieuwen(c, false)).toBe(true);
  });

  it('beschouwt onbekende afwijkende concepttekst conservatief als mogelijk handmatig', () => {
    const c = classificeerConceptVoorVernieuwing({ status: 'concept', brieftekst: 'Mijn eigen aangepaste tekst.' } as any, 'Nieuwe standaardtekst');
    expect(c).toBe('afwijkend_mogelijk_handmatig');
    expect(magConceptAutomatischVernieuwen(c, false)).toBe(false);
    expect(magConceptAutomatischVernieuwen(c, true)).toBe(true);
  });

  it('laat exact actuele concepttekst ongemoeid', () => {
    const c = classificeerConceptVoorVernieuwing({ status: 'concept', brieftekst: 'A\n\nB' } as any, 'A\n\nB');
    expect(c).toBe('actueel');
    expect(magConceptAutomatischVernieuwen(c, false)).toBe(false);
  });

  it('maakt Brief 2 campagnebewust bij een nieuw object zonder CTA/handtekening te vervangen', () => {
    const bron = 'Geachte heer/mevrouw,\n\nOude template-intro.\n\nCTA blijft staan.\n\nMet vriendelijke groet,\n\nRamysh Bito';
    const tekst = pasCampagneContextToeAanBrieftekst(bron, {
      campagneStap: 'brief_2', eerderObject: 'Keizersgracht 100', huidigObject: 'Nieuwezijds Voorburgwal 20',
      heeftEerderContact: true, portefeuille: true,
    });
    expect(tekst).toContain('Keizersgracht 100');
    expect(tekst).toContain('Nieuwezijds Voorburgwal 20');
    expect(tekst).toContain('CTA blijft staan.');
    expect(tekst).toContain('Ramysh Bito');
  });

  it('verandert Brief 1 niet via de campagnecontextlaag', () => {
    const bron = 'Geachte heer/mevrouw,\n\nEerste contact.';
    expect(pasCampagneContextToeAanBrieftekst(bron, {
      campagneStap: 'brief_1', eerderObject: 'A', huidigObject: 'B', heeftEerderContact: true, portefeuille: true,
    })).toBe(bron);
  });

  it('sterke partij-identiteit vereist een volledig postadres en niet alleen een naam', () => {
    expect(sterkeRadarPartijSleutel({
      naam: 'P. Boer', bedrijfsnaam: null, verzendadres: 'Leeuwerikstraat 30\n1171 TX Badhoevedorp', geadresseerdeKey: 'x',
    } as any)).toContain('radar_geadresseerde:');
    expect(sterkeRadarPartijSleutel({
      naam: 'P. Boer', bedrijfsnaam: null, verzendadres: null, geadresseerdeKey: 'x',
    } as any)).toBeNull();
  });

  it('actieve productie houdt een signaal in Actief', () => {
    const p = bepaalWerkvoorraadProjectie([
      { itemKey: 's|p', routing: basisRoute({ outcome: 'nieuwe_campagne_brief_1', geadviseerdeStap: 'brief_1', magAutomatischBriefMaken: true }), partijMatchBevestigd: true },
    ], new Set(['s|p']));
    expect(p.status).toBe('actief');
  });

  it('onzekere partijmatch wint van overige routes en wordt Benadering bepalen', () => {
    const p = bepaalWerkvoorraadProjectie([
      { itemKey: 'a', routing: basisRoute(), partijMatchBevestigd: true },
      { itemKey: 'b', routing: basisRoute({ outcome: 'benadering_bepalen', reden: 'Mogelijk dezelfde partij.' }), partijMatchBevestigd: false },
    ], new Set());
    expect(p.status).toBe('benadering_bepalen');
    expect(p.partijMatchBeoordelen).toBe(true);
  });

  it('warm/no-letter contact wordt Eerder benaderd', () => {
    const p = bepaalWerkvoorraadProjectie([
      { itemKey: 'a', routing: basisRoute({ outcome: 'gespreksonderwerp', reden: 'Warm contact.' }), partijMatchBevestigd: true },
    ], new Set());
    expect(p.status).toBe('eerder_benaderd');
  });

  it('absolute blokkade wordt Niet benaderen', () => {
    const p = bepaalWerkvoorraadProjectie([
      { itemKey: 'a', routing: basisRoute({ outcome: 'niet_benaderen', reden: 'Do not contact.' }), partijMatchBevestigd: true },
    ], new Set());
    expect(p.status).toBe('niet_benaderen');
  });

  it('context zonder directe productie wordt Gebundeld bij partij', () => {
    const p = bepaalWerkvoorraadProjectie([
      { itemKey: 'a', routing: basisRoute(), partijMatchBevestigd: true },
    ], new Set());
    expect(p.status).toBe('gebundeld_bij_partij');
  });
});
