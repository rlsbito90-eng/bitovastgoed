import { describe, expect, it } from 'vitest';
import { bepaalVastgoedkansActieContext, filterEnSorteerVastgoedkansen, type VastgoedkansLijstWorkspaceState } from '@/lib/vastgoedkansWorkspace';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';

const kans = (id: string, extra: Partial<Vastgoedkans> = {}): Vastgoedkans => ({
  id,
  kansnummer: id,
  adres: `Straat ${id}`,
  postcode: '1000AA',
  plaats: 'Amsterdam',
  provincie: 'Noord-Holland',
  typeVastgoed: 'Kantoor',
  korteOmschrijving: null,
  herkomst: 'bag_selectie',
  herkomstReferentie: null,
  selectieprofielId: null,
  selectierunId: null,
  bagPandId: null,
  bagVerblijfsobjectId: null,
  algoritmeScore: null,
  scoreUitleg: null,
  status: 'te_beoordelen',
  prioriteit: 3,
  eigenaarStatus: 'niet_gestart',
  eigenaarNaam: null,
  eigenaarBron: null,
  eigenaarRelatieId: null,
  eigenaarLaatstGecontroleerdOp: null,
  kadasterStatus: 'niet_gestart',
  kadastraleAanduiding: null,
  kadasterLaatstGecontroleerdOp: null,
  onderzoeksnotities: null,
  briefStatus: 'niet_gestart',
  briefGeadresseerde: null,
  briefVerzendwijze: null,
  briefVerzondenOp: null,
  briefKenmerk: null,
  opvolgdatum: null,
  opvolgactie: null,
  reactieStatus: 'geen_reactie',
  reactieOntvangenOp: null,
  reactieKanaal: null,
  reactieSamenvatting: null,
  reactieUitkomst: null,
  volgendeActieDatum: null,
  volgendeActieOmschrijving: null,
  redenInteressant: null,
  notities: null,
  objectId: null,
  archivedAt: null,
  archivedBy: null,
  archivedReason: null,
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-01T10:00:00Z',
  ...extra,
});

const state = (zoekterm = ''): VastgoedkansLijstWorkspaceState => ({
  werkbak: 'alles',
  zoekterm,
  sortering: 'werkvolgorde',
  filters: { prioriteiten: [], herkomsten: [], eigenaar: [], brief: [] },
});

describe('BUILD 2.0C — workflow fallback in Vastgoedkansen', () => {
  it('gebruikt de centrale workflow-engine wanneer geen expliciete of legacy actie bestaat', () => {
    const context = bepaalVastgoedkansActieContext(kans('a'));
    expect(context.omschrijving).toBe('Beoordeel vastgoedkans');
    expect(context.bron).toBe('workflow');
    expect(context.urgentie).toBe('processtap');
    expect(context.urgentieLabel).toBe('Processtap');
  });

  it('houdt expliciet opgeslagen commerciële actie boven workflow fallback', () => {
    const context = bepaalVastgoedkansActieContext(kans('a', {
      volgendeActieOmschrijving: 'Bel eigenaar over voorstel',
      volgendeActieDatum: '2026-08-20',
    }), '2026-08-15');
    expect(context.omschrijving).toBe('Bel eigenaar over voorstel');
    expect(context.bron).toBe('expliciet');
    expect(context.urgentie).toBe('gepland');
  });

  it('leidt na bevestigde eigenaar de processtap Brief voorbereiden af', () => {
    const context = bepaalVastgoedkansActieContext(kans('a', {
      kadasterStatus: 'gegevens_bekend',
      kadasterLaatstGecontroleerdOp: '2026-08-09',
      eigenaarStatus: 'bekend',
      eigenaarLaatstGecontroleerdOp: '2026-08-10',
    }));
    expect(context.omschrijving).toBe('Brief voorbereiden');
    expect(context.bron).toBe('workflow');
  });

  it('neemt workflow-afgeleide actie mee in zoeken', () => {
    const lijst = [
      kans('a'),
      kans('b', {
        kadasterStatus: 'gegevens_bekend',
        kadasterLaatstGecontroleerdOp: '2026-08-09',
        eigenaarStatus: 'bekend',
        eigenaarLaatstGecontroleerdOp: '2026-08-10',
      }),
    ];
    const resultaat = filterEnSorteerVastgoedkansen(lijst, state('brief voorbereiden'));
    expect(resultaat.map((item) => item.id)).toEqual(['b']);
  });

  it('toont voor afgesloten dossiers zonder expliciete actie geen workflow fallback', () => {
    const context = bepaalVastgoedkansActieContext(kans('a', { status: 'afgevallen' }));
    expect(context.urgentie).toBe('geen_actie');
    expect(context.bron).toBe('geen');
  });
});
