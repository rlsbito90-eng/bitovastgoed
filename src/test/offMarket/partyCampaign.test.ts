import { describe, expect, it } from 'vitest';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import {
  campagnebewusteVervolgIntro,
  routeerPartijCampagne,
  scoreRadarObject,
  type CampaignSnapshot,
  type PartyIdentity,
} from '@/lib/offMarket/acquisitie/partyCampaign';

const basisSignaal = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  status: 'benaderen',
  adres: `Teststraat ${id}`,
  plaats: 'Amsterdam',
  prioriteit: 'midden',
  type_signaal: 'vergunning_bekendmaking',
  vergunningtype: 'splitsing',
  created_at: '2026-08-20T10:00:00Z',
  ...overrides,
} as any as OffMarketSignaal);

const partij: PartyIdentity = {
  eigenaarId: 'owner-1', matchStatus: 'bevestigd', partijType: 'rechtspersoon',
};

const campagne = (overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot => ({
  id: 'camp-1', eigenaarId: 'owner-1', doelstelling: 'radar_acquisitie',
  status: 'actief', contactStatus: 'cold', huidigeStap: 'brief_1',
  laatsteKoudeContactOp: null, herbenaderenVanaf: null, cooldownMaanden: 6,
  primarySignaalId: 'sig-old', ...overrides,
});

const brief = (overrides: Partial<OffMarketBrief> = {}): OffMarketBrief => ({
  id: 'b1', signaal_id: 'sig-old', eigenaar_naam: null, eigenaar_bedrijfsnaam: 'Test B.V.',
  verzendadres: 'Teststraat 1\n1000 AA Amsterdam', objectadres: 'Oud 1', objectomschrijving: 'Oud 1',
  aanhef: 'Geachte heer/mevrouw,', onderwerp: 'Onderwerp', brieftekst: 'Tekst', status: 'verstuurd',
  verzonden_op: '2026-08-01T10:00:00Z', aangemaakt_door: null,
  created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z',
  archived_at: null, archived_reason: null, kanaal: 'post', campagne_stap: 'brief_1',
  geadresseerde_key: 'key', responsstatus: null,
  ...overrides,
} as OffMarketBrief);

describe('Radar partij-/campagnerouting', () => {
  it('1. één bevestigde partij zonder historie start Brief 1', () => {
    const r = routeerPartijCampagne({ signaal: basisSignaal('s1'), partij, campagne: null, partijBrieven: [] });
    expect(r.outcome).toBe('nieuwe_campagne_brief_1');
    expect(r.geadviseerdeStap).toBe('brief_1');
  });

  it('2. bestaande campagne voorkomt een tweede koude Brief 1', () => {
    const r = routeerPartijCampagne({ signaal: basisSignaal('s2'), partij, campagne: campagne(), partijBrieven: [brief()] });
    expect(r.outcome).toBe('meenemen_in_vervolgbrief');
    expect(r.geadviseerdeStap).toBe('brief_2');
  });

  it('3. Brief 2 verstuurd betekent vervolg met Brief 3', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2'), partij, campagne: campagne({ huidigeStap: 'brief_2' }),
      partijBrieven: [brief({ campagne_stap: 'brief_2' })],
    });
    expect(r.geadviseerdeStap).toBe('brief_3');
  });

  it('4. volledige sequence start niet opnieuw met Brief 1', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2'), partij, campagne: campagne({ huidigeStap: 'brief_3' }),
      partijBrieven: [brief({ campagne_stap: 'brief_3' })],
    });
    expect(r.outcome).toBe('bundelen_bij_partij');
    expect(r.geadviseerdeStap).toBeNull();
  });

  it('5. onzekere partijmatch blokkeert automatische brief', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2'),
      partij: { eigenaarId: null, matchStatus: 'mogelijk_dezelfde_partij' },
      campagne: null, partijBrieven: [],
    });
    expect(r.outcome).toBe('benadering_bepalen');
    expect(r.magAutomatischBriefMaken).toBe(false);
  });

  it('6. do_not_contact blokkeert ook handmatige briefproductie', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2'), partij,
      campagne: campagne({ contactStatus: 'do_not_contact' }), partijBrieven: [],
    });
    expect(r.outcome).toBe('niet_benaderen');
    expect(r.magHandmatigBriefMaken).toBe(false);
  });

  it('7. not_now registreert maar schrijft niet automatisch aan', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2'), partij,
      campagne: campagne({ contactStatus: 'not_now' }), partijBrieven: [],
    });
    expect(r.outcome).toBe('alleen_registreren');
    expect(r.magAutomatischBriefMaken).toBe(false);
  });

  it('8. not_interested registreert maar start geen campagne', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2'), partij,
      campagne: campagne({ contactStatus: 'not_interested' }), partijBrieven: [],
    });
    expect(r.outcome).toBe('alleen_registreren');
  });

  it('9. positieve reactie gaat naar gespreksonderwerp', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2'), partij, campagne: campagne(),
      partijBrieven: [brief({ responsstatus: 'interesse' })],
    });
    expect(r.outcome).toBe('gespreksonderwerp');
    expect(r.briefAdvies).toBe('geen_brief');
  });

  it('10. actieve warme signaalstatus gaat naar gespreksonderwerp', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2'), partij, campagne: campagne(), partijBrieven: [],
      partijSignalen: [basisSignaal('sig-old', { status: 'in_gesprek' })],
    });
    expect(r.outcome).toBe('gespreksonderwerp');
  });

  it('11. afgerond binnen cooldown met vergelijkbaar signaal wordt gebundeld', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2', { prioriteit: 'laag' }), partij,
      campagne: campagne({
        status: 'afgerond_geen_reactie', laatsteKoudeContactOp: '2026-07-01T10:00:00Z',
        herbenaderenVanaf: '2027-01-01',
      }), partijBrieven: [], partijSignalen: [basisSignaal('sig-old', { prioriteit: 'hoog' })],
      vandaag: new Date('2026-08-26T12:00:00Z'),
    });
    expect(r.outcome).toBe('alleen_registreren');
  });

  it('12. afgerond met duidelijk sterker nieuw signaal vraagt beoordeling', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2', { prioriteit: 'urgent', vergunningtype: 'transformatie', ai_relevantie_score: 95 }),
      partij,
      campagne: campagne({ status: 'afgerond_geen_reactie', herbenaderenVanaf: '2027-01-01' }),
      partijBrieven: [], partijSignalen: [basisSignaal('sig-old', { prioriteit: 'laag', ai_relevantie_score: 10 })],
      vandaag: new Date('2026-08-26T12:00:00Z'),
    });
    expect(r.outcome).toBe('benadering_bepalen');
    expect(r.nieuwHoofdobjectVoorstellen).toBe(true);
  });

  it('13. sterke aanleiding na cooldown stelt herbenadering voor maar verstuurt niet automatisch', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('s2', { prioriteit: 'urgent', vergunningtype: 'transformatie', ai_relevantie_score: 98 }),
      partij,
      campagne: campagne({ status: 'afgerond_geen_reactie', herbenaderenVanaf: '2026-08-01' }),
      partijBrieven: [], partijSignalen: [basisSignaal('sig-old', { prioriteit: 'laag', ai_relevantie_score: 5 })],
      vandaag: new Date('2026-08-26T12:00:00Z'),
    });
    expect(r.outcome).toBe('herbenadering_voorstellen');
    expect(r.magAutomatischBriefMaken).toBe(false);
  });

  it('14. score gebruikt bestaande velden en documenteert redenen', () => {
    const s = scoreRadarObject(basisSignaal('s', { prioriteit: 'urgent', vergunningtype: 'transformatie', ai_relevantie_score: 90 }));
    expect(s.score).toBeGreaterThan(50);
    expect(s.redenen.length).toBeGreaterThan(1);
  });

  it('15. score blijft begrensd en presenteert geen schijnprecisie', () => {
    const s = scoreRadarObject(basisSignaal('s', { ai_relevantie_score: 1000, bron_betrouwbaarheid: 1000, prioriteit: 'urgent', vergunningtype: 'transformatie' }));
    expect(s.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(s.score * 10)).toBe(true);
  });

  it('16. campagnebewuste Brief 2 noemt oud en nieuw object', () => {
    const tekst = campagnebewusteVervolgIntro({ stap: 'brief_2', huidigHoofdobject: 'Keizersgracht 100', nieuwObject: 'Nieuwezijds Voorburgwal 20' });
    expect(tekst).toContain('Keizersgracht 100');
    expect(tekst).toContain('Nieuwezijds Voorburgwal 20');
  });

  it('17. eerste brief krijgt geen kunstmatige vervolgintro', () => {
    expect(campagnebewusteVervolgIntro({ stap: 'brief_1', huidigHoofdobject: 'A' })).toBeNull();
  });

  it('18. portefeuille-context kan zonder adressenlijst worden benoemd', () => {
    const tekst = campagnebewusteVervolgIntro({ stap: 'brief_3', huidigHoofdobject: 'A', portefeuille: true });
    expect(tekst).toContain('vastgoedportefeuille');
    expect(tekst).not.toContain(', B');
  });

  it('19. vergelijkbare juridische partijen worden niet door router zelf samengevoegd', () => {
    const a = routeerPartijCampagne({ signaal: basisSignaal('s'), partij: { eigenaarId: 'bv-a', matchStatus: 'bevestigd' }, campagne: null, partijBrieven: [] });
    const b = routeerPartijCampagne({ signaal: basisSignaal('s'), partij: { eigenaarId: 'bv-b', matchStatus: 'bevestigd' }, campagne: null, partijBrieven: [] });
    expect(a.outcome).toBe('nieuwe_campagne_brief_1');
    expect(b.outcome).toBe('nieuwe_campagne_brief_1');
  });

  it('20. centrale hoofdregel: bestaand party-id + bestaand contact kan nooit ongemerkt tweede Brief 1 opleveren', () => {
    const r = routeerPartijCampagne({
      signaal: basisSignaal('nieuw'), partij,
      campagne: campagne({ huidigeStap: 'brief_1', laatsteKoudeContactOp: '2026-08-20T10:00:00Z' }),
      partijBrieven: [brief()],
    });
    expect(r.geadviseerdeStap).not.toBe('brief_1');
  });
});
