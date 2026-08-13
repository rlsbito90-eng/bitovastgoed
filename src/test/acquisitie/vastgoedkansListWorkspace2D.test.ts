import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_VASTGOEDKANS_LIJST_WORKSPACE,
  filterEnSorteerVastgoedkansen,
  type VastgoedkansLijstWorkspaceState,
} from '@/lib/vastgoedkansWorkspace';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';

const kans = (id: string, extra: Partial<Vastgoedkans> = {}) => ({
  id,
  kansnummer: id,
  adres: `${id} Straat 1`,
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
} as Vastgoedkans);

const state = (extra: Partial<VastgoedkansLijstWorkspaceState> = {}): VastgoedkansLijstWorkspaceState => ({
  ...DEFAULT_VASTGOEDKANS_LIJST_WORKSPACE,
  ...extra,
  filters: extra.filters ?? DEFAULT_VASTGOEDKANS_LIJST_WORKSPACE.filters,
});

describe('BUILD 2.0D — Vastgoedkans List Workspace', () => {
  it('combineert filtercategorieën met AND en waarden binnen een categorie met OR', () => {
    const lijst = [
      kans('a', { prioriteit: 1, eigenaarStatus: 'bekend', herkomst: 'bag_selectie' }),
      kans('b', { prioriteit: 2, eigenaarStatus: 'bekend', herkomst: 'bag_selectie' }),
      kans('c', { prioriteit: 1, eigenaarStatus: 'niet_gestart', herkomst: 'bag_selectie' }),
      kans('d', { prioriteit: 1, eigenaarStatus: 'bekend', herkomst: 'handmatig' }),
    ];
    const resultaat = filterEnSorteerVastgoedkansen(lijst, state({
      filters: { prioriteiten: [1, 2], herkomsten: ['bag_selectie'], eigenaar: ['bekend'], brief: [] },
    }));
    expect(resultaat.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('zoekt accent-onafhankelijk en sorteert null scores achteraan', () => {
    const lijst = [
      kans('a', { eigenaarNaam: 'José Vastgoed', algoritmeScore: null }),
      kans('b', { eigenaarNaam: 'Josef', algoritmeScore: 80 }),
      kans('c', { eigenaarNaam: 'Andere', algoritmeScore: 95 }),
    ];
    const gevonden = filterEnSorteerVastgoedkansen(lijst, state({ zoekterm: 'jose', werkbak: 'alles' }));
    expect(gevonden.map((item) => item.id)).toEqual(['a', 'b']);
    const score = filterEnSorteerVastgoedkansen(lijst, state({ werkbak: 'alles', sortering: 'score' }));
    expect(score.map((item) => item.id)).toEqual(['c', 'b', 'a']);
  });

  it('sorteert opvolgdatums vroegste eerst en ontbrekende datums achteraan', () => {
    const lijst = [
      kans('a', { opvolgdatum: null }),
      kans('b', { opvolgdatum: '2026-08-20' }),
      kans('c', { volgendeActieDatum: '2026-08-15' }),
    ];
    const resultaat = filterEnSorteerVastgoedkansen(lijst, state({ werkbak: 'alles', sortering: 'opvolgdatum' }));
    expect(resultaat.map((item) => item.id)).toEqual(['c', 'b', 'a']);
  });

  it('bulkupdate gebruikt alleen een expliciete patch en raakt geen archief', () => {
    const hook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useVastgoedkansen.tsx'), 'utf8');
    const bulk = hook.slice(hook.indexOf('const bulkUpdateKansen'), hook.indexOf('const archiveKansen'));
    expect(bulk).toContain("patch.status = wijziging.status");
    expect(bulk).toContain("patch.prioriteit = wijziging.prioriteit");
    expect(bulk).toContain(".is('archived_at', null)");
    expect(bulk).not.toContain('snake(');
  });

  it('lijstpagina bewaart weergave en exacte zichtbare volgorde vóór openen van een dossier', () => {
    const pagina = fs.readFileSync(path.join(process.cwd(), 'src/pages/VastgoedkansenPage.tsx'), 'utf8');
    expect(pagina).toContain('bewaarVastgoedkansLijstWorkspace');
    expect(pagina).toContain('ids: listIds');
    expect(pagina).toContain('zoekterm: q');
    expect(pagina).toContain('bepaalPrimaireWerkTab(kans)');
    expect(pagina).toContain('bulkUpdateKansen');
  });

  it('detailnavigatie geeft opgeslagen lijstcontext voorrang boven de volledige lijst', () => {
    const workspace = fs.readFileSync(path.join(process.cwd(), 'src/lib/vastgoedkansWorkspace.ts'), 'utf8');
    expect(workspace).toContain("context.zoekterm === undefined");
    expect(workspace).toContain("bestaand?.ids?.includes(context.kansId)");
    expect(workspace).toContain("opgeslagen?.ids?.includes(huidigId) ? opgeslagen.ids : ids");
  });
});
