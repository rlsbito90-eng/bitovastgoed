// Fase 1.1 — SessionStorage-view, legacy-migratie en verplaatstoast-diff.
import { describe, expect, it } from 'vitest';
import {
  bepaalVerplaatsToasts,
  extraheerSignaalIds,
  leesInitieleView,
  migreerLegacyFilter,
  LEGACY_FILTER_KEY,
  SUBFILTER_KEY,
  WERKBAK_KEY,
  type StorageLike,
  type VorigeCtx,
} from '@/lib/offMarket/acquisitie/selectieViewState';

function mkStorage(entries: Record<string, string>): StorageLike {
  return { getItem: (k) => (k in entries ? entries[k] : null) };
}

describe('migreerLegacyFilter', () => {
  it('mapt bekende legacy-waarden', () => {
    expect(migreerLegacyFilter('alles')).toEqual({ werkbak: 'alles', subfilter: 'alle' });
    expect(migreerLegacyFilter('geblokkeerd')).toEqual({ werkbak: 'actie', subfilter: 'onderzoeken' });
    expect(migreerLegacyFilter('brief_voorbereiden')).toEqual({ werkbak: 'actie', subfilter: 'brief_voorbereiden' });
    expect(migreerLegacyFilter('printklaar')).toEqual({ werkbak: 'actie', subfilter: 'printen_posten' });
    expect(migreerLegacyFilter('opvolging')).toEqual({ werkbak: 'actie', subfilter: 'opvolgen' });
  });
  it('onbekende waarde valt terug op actie/alle', () => {
    expect(migreerLegacyFilter('bogus')).toEqual({ werkbak: 'actie', subfilter: 'alle' });
    expect(migreerLegacyFilter(null)).toEqual({ werkbak: 'actie', subfilter: 'alle' });
  });
});

describe('leesInitieleView', () => {
  it('gebruikt geldige werkbak+subfilter', () => {
    const s = mkStorage({ [WERKBAK_KEY]: 'wachten', [SUBFILTER_KEY]: 'alle' });
    expect(leesInitieleView(s)).toEqual({ werkbak: 'wachten', subfilter: 'alle' });
  });
  it('ongeldig subfilter → alle', () => {
    const s = mkStorage({ [WERKBAK_KEY]: 'actie', [SUBFILTER_KEY]: 'bogus' });
    expect(leesInitieleView(s)).toEqual({ werkbak: 'actie', subfilter: 'alle' });
  });
  it('ongeldige werkbak → legacy-migratie', () => {
    const s = mkStorage({ [WERKBAK_KEY]: 'bogus', [LEGACY_FILTER_KEY]: 'printklaar' });
    expect(leesInitieleView(s)).toEqual({ werkbak: 'actie', subfilter: 'printen_posten' });
  });
  it('lege storage → actie/alle', () => {
    expect(leesInitieleView(mkStorage({}))).toEqual({ werkbak: 'actie', subfilter: 'alle' });
  });
});

describe('extraheerSignaalIds', () => {
  it('herkent { id }, { signaal_id } en { signaalId }', () => {
    expect(extraheerSignaalIds({ id: 'a' })).toEqual(['a']);
    expect(extraheerSignaalIds({ signaal_id: 'b' })).toEqual(['b']);
    expect(extraheerSignaalIds({ signaalId: 'c' })).toEqual(['c']);
  });
  it('werkt met arrays en negeert onbekende vormen', () => {
    expect(extraheerSignaalIds([{ id: 'a' }, { id: 'b' }])).toEqual(['a', 'b']);
    expect(extraheerSignaalIds(null)).toEqual([]);
    expect(extraheerSignaalIds('x')).toEqual([]);
  });
});

describe('bepaalVerplaatsToasts', () => {
  const NU = 1_000_000;
  const RECENT = new Map<string, number>([['s1', NU - 1000]]);
  const OUD = new Map<string, number>([['s1', NU - 60_000]]);

  it('initiële laadactie (vorig=null) geeft nooit toasts', () => {
    const huidig = new Map<string, VorigeCtx>([['s1', { werkbak: 'wachten', subfilter: null }]]);
    expect(bepaalVerplaatsToasts({ vorig: null, huidig, recenteMutaties: RECENT, nu: NU })).toEqual([]);
  });

  it('achtergrondrefresh zonder recente mutatie: geen toast', () => {
    const vorig = new Map<string, VorigeCtx>([['s1', { werkbak: 'actie', subfilter: 'alle' }]]);
    const huidig = new Map<string, VorigeCtx>([['s1', { werkbak: 'wachten', subfilter: null }]]);
    expect(bepaalVerplaatsToasts({ vorig, huidig, recenteMutaties: OUD, nu: NU })).toEqual([]);
  });

  it('werkbakwissel na expliciete mutatie: toast met werkbak-label', () => {
    const vorig = new Map<string, VorigeCtx>([['s1', { werkbak: 'actie', subfilter: 'alle' }]]);
    const huidig = new Map<string, VorigeCtx>([['s1', { werkbak: 'wachten', subfilter: null }]]);
    const res = bepaalVerplaatsToasts({ vorig, huidig, recenteMutaties: RECENT, nu: NU });
    expect(res).toEqual([{ id: 's1', soort: 'werkbak', doelLabel: 'Wachten' }]);
  });

  it('subfilterwissel binnen Actie na expliciete mutatie: toast met subfilter-label', () => {
    const vorig = new Map<string, VorigeCtx>([['s1', { werkbak: 'actie', subfilter: 'brief_voorbereiden' }]]);
    const huidig = new Map<string, VorigeCtx>([['s1', { werkbak: 'actie', subfilter: 'printen_posten' }]]);
    const res = bepaalVerplaatsToasts({ vorig, huidig, recenteMutaties: RECENT, nu: NU });
    expect(res).toHaveLength(1);
    expect(res[0].soort).toBe('subfilter');
    expect(res[0].doelLabel).toMatch(/[Pp]rinten|[Pp]osten/);
  });

  it('geen zichtbare wijziging: geen toast', () => {
    const vorig = new Map<string, VorigeCtx>([['s1', { werkbak: 'actie', subfilter: 'alle' }]]);
    const huidig = new Map(vorig);
    expect(bepaalVerplaatsToasts({ vorig, huidig, recenteMutaties: RECENT, nu: NU })).toEqual([]);
  });
});
