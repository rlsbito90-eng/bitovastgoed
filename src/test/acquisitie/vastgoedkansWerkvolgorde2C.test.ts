import { describe, expect, it } from 'vitest';
import {
  bepaalVastgoedkansActieContext,
  filterEnSorteerVastgoedkansen,
  type VastgoedkansLijstWorkspaceState,
} from '@/lib/vastgoedkansWorkspace';
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
  status: 'opvolgen',
  prioriteit: 3,
  eigenaarStatus: 'bekend',
  eigenaarNaam: null,
  eigenaarBron: null,
  eigenaarRelatieId: null,
  eigenaarLaatstGecontroleerdOp: null,
  kadasterStatus: 'gegevens_bekend',
  kadastraleAanduiding: null,
  kadasterLaatstGecontroleerdOp: null,
  onderzoeksnotities: null,
  briefStatus: 'verzonden',
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

const state = (sortering: VastgoedkansLijstWorkspaceState['sortering']): VastgoedkansLijstWorkspaceState => ({
  werkbak: 'alles',
  zoekterm: '',
  sortering,
  filters: { prioriteiten: [], herkomsten: [], eigenaar: [], brief: [] },
});

describe('BUILD 2.0C — Vastgoedkansen werkvolgorde', () => {
  it('geeft nieuwe commerciële actiedatum voorrang boven oude briefopvolgdatum', () => {
    const context = bepaalVastgoedkansActieContext(kans('a', {
      opvolgdatum: '2026-08-10',
      opvolgactie: 'Oude briefopvolging',
      volgendeActieDatum: '2026-08-20',
      volgendeActieOmschrijving: 'Plan inhoudelijk gesprek',
    }), '2026-08-15');

    expect(context.datum).toBe('2026-08-20');
    expect(context.omschrijving).toBe('Plan inhoudelijk gesprek');
    expect(context.urgentie).toBe('gepland');
  });

  it('classificeert verlopen, vandaag, gepland en zonder datum voorspelbaar', () => {
    expect(bepaalVastgoedkansActieContext(kans('a', { volgendeActieDatum: '2026-08-14', volgendeActieOmschrijving: 'Bel eigenaar' }), '2026-08-15').urgentie).toBe('verlopen');
    expect(bepaalVastgoedkansActieContext(kans('b', { volgendeActieDatum: '2026-08-15', volgendeActieOmschrijving: 'Bel eigenaar' }), '2026-08-15').urgentie).toBe('vandaag');
    expect(bepaalVastgoedkansActieContext(kans('c', { volgendeActieDatum: '2026-08-16', volgendeActieOmschrijving: 'Bel eigenaar' }), '2026-08-15').urgentie).toBe('gepland');
    expect(bepaalVastgoedkansActieContext(kans('d', { volgendeActieOmschrijving: 'Beoordeel reactie' }), '2026-08-15').urgentie).toBe('zonder_datum');
  });

  it('laat oude opvolgdatums van afgevallen/gepromoveerde dossiers niet als actieve deadline terugkomen', () => {
    const context = bepaalVastgoedkansActieContext(kans('a', {
      status: 'afgevallen',
      opvolgdatum: '2026-08-01',
      opvolgactie: 'Oude briefopvolging',
    }), '2026-08-15');

    expect(context.urgentie).toBe('geen_actie');
    expect(context.datum).toBeNull();
  });

  it('sorteert werkvolgorde op verlopen, vandaag, toekomst, zonder datum en daarna geen actie', () => {
    const lijst = [
      kans('geen'),
      kans('zonder', { volgendeActieOmschrijving: 'Beoordeel reactie' }),
      kans('toekomst', { volgendeActieDatum: '2026-08-20', volgendeActieOmschrijving: 'Bel later' }),
      kans('vandaag', { volgendeActieDatum: '2026-08-15', volgendeActieOmschrijving: 'Bel vandaag' }),
      kans('verlopen', { volgendeActieDatum: '2026-08-14', volgendeActieOmschrijving: 'Bel eigenaar' }),
    ];

    const resultaat = filterEnSorteerVastgoedkansen(lijst, state('werkvolgorde'));
    expect(resultaat.map((item) => item.id)).toEqual(['verlopen', 'vandaag', 'toekomst', 'zonder', 'geen']);
  });

  it('neemt de commerciële volgende actie mee in zoeken', () => {
    const lijst = [
      kans('a', { volgendeActieOmschrijving: 'Plan taxatiegesprek' }),
      kans('b', { volgendeActieOmschrijving: 'Bel eigenaar' }),
    ];
    const resultaat = filterEnSorteerVastgoedkansen(lijst, { ...state('recent'), zoekterm: 'taxatiegesprek' });
    expect(resultaat.map((item) => item.id)).toEqual(['a']);
  });
});
