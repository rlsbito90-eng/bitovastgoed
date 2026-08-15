import { describe, expect, it } from 'vitest';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';
import {
  kiesLeidendeVastgoedkansTaak,
  type VastgoedkansLijstTaak,
} from '@/hooks/useVastgoedkansLijstTaken';
import {
  bepaalVastgoedkansActieContextMetTaak,
  filterEnSorteerVastgoedkansenMetTaken,
} from '@/lib/vastgoedkansTakenWerkvoorraad';
import { legeVastgoedkansFilters } from '@/lib/vastgoedkansWorkspace';

const taak = (partial: Partial<VastgoedkansLijstTaak> & Pick<VastgoedkansLijstTaak, 'id' | 'vastgoedkans_id' | 'titel'>): VastgoedkansLijstTaak => ({
  deadline: null,
  prioriteit: 'normaal',
  status: 'open',
  created_at: '2026-08-15T08:00:00.000Z',
  ...partial,
});

const kans = (id: string, partial: Partial<Vastgoedkans> = {}): Vastgoedkans => ({
  id,
  kansnummer: `VK-${id}`,
  adres: `Teststraat ${id}`,
  postcode: '1000AA',
  plaats: 'Amsterdam',
  provincie: 'Noord-Holland',
  typeVastgoed: 'Gemengd',
  korteOmschrijving: `Kans ${id}`,
  herkomst: 'handmatig',
  herkomstReferentie: null,
  selectieprofielId: null,
  selectierunId: null,
  bagPandId: 'pand-1',
  bagVerblijfsobjectId: null,
  algoritmeScore: null,
  scoreUitleg: null,
  status: 'opvolgen',
  prioriteit: 3,
  eigenaarStatus: 'bekend',
  eigenaarNaam: 'Eigenaar Test',
  eigenaarBron: 'kadaster',
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
  createdAt: '2026-08-14T08:00:00.000Z',
  updatedAt: '2026-08-15T08:00:00.000Z',
  ...partial,
});

describe('BUILD 2.0C — centrale taken in Vastgoedkans werkvoorraad', () => {
  it('kiest eerst de vroegste deadline en daarna de hoogste prioriteit', () => {
    const taken = [
      taak({ id: 'later', vastgoedkans_id: '1', titel: 'Later bellen', deadline: '2026-08-20', prioriteit: 'urgent' }),
      taak({ id: 'vroeg-laag', vastgoedkans_id: '1', titel: 'Eerst bellen', deadline: '2026-08-16', prioriteit: 'laag' }),
      taak({ id: 'vroeg-hoog', vastgoedkans_id: '1', titel: 'Eerst mailen', deadline: '2026-08-16', prioriteit: 'hoog' }),
    ];
    expect(kiesLeidendeVastgoedkansTaak(taken)?.id).toBe('vroeg-hoog');
  });

  it('laat een open taak voorgaan op de commerciële dossieractie', () => {
    const dossier = kans('1', {
      volgendeActieOmschrijving: 'Later opnieuw benaderen',
      volgendeActieDatum: '2026-08-30',
    });
    const openTaak = taak({ id: 't1', vastgoedkans_id: '1', titel: 'Bel eigenaar', deadline: '2026-08-15' });
    const context = bepaalVastgoedkansActieContextMetTaak(dossier, openTaak, '2026-08-15');
    expect(context.bron).toBe('taak');
    expect(context.omschrijving).toBe('Bel eigenaar');
    expect(context.urgentie).toBe('vandaag');
  });

  it('gebruikt taaktekst voor zoeken en taakdeadline voor werkvolgorde zonder originele kans te muteren', () => {
    const a = kans('a', { volgendeActieOmschrijving: 'Dossieractie A', volgendeActieDatum: '2026-08-25' });
    const b = kans('b', { volgendeActieOmschrijving: 'Dossieractie B', volgendeActieDatum: '2026-08-18' });
    const taken = new Map([
      ['a', taak({ id: 'ta', vastgoedkans_id: 'a', titel: 'Unieke beltaak', deadline: '2026-08-16' })],
    ]);

    const gevonden = filterEnSorteerVastgoedkansenMetTaken([a, b], {
      werkbak: 'alles',
      zoekterm: 'unieke beltaak',
      sortering: 'recent',
      filters: legeVastgoedkansFilters(),
    }, taken);
    expect(gevonden.map((item) => item.id)).toEqual(['a']);
    expect(gevonden[0]).toBe(a);
    expect(a.volgendeActieOmschrijving).toBe('Dossieractie A');

    const gesorteerd = filterEnSorteerVastgoedkansenMetTaken([a, b], {
      werkbak: 'alles',
      zoekterm: '',
      sortering: 'werkvolgorde',
      filters: legeVastgoedkansFilters(),
    }, taken);
    expect(gesorteerd.map((item) => item.id)).toEqual(['a', 'b']);
  });
});
