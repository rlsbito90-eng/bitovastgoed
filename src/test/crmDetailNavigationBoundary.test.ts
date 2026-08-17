import { describe, expect, it } from 'vitest';
import {
  bepaalCrmDetailNavigationAction,
  getCrmDetailModule,
  isCrmTerugKnopTekst,
} from '@/components/CrmDetailNavigationBoundary';

describe('CrmDetailNavigationBoundary', () => {
  it('herkent uitsluitend ondersteunde CRM-detailroutes', () => {
    expect(getCrmDetailModule('/relaties/r1')).toBe('relaties');
    expect(getCrmDetailModule('/objecten/o1')).toBe('objecten');
    expect(getCrmDetailModule('/deals/d1')).toBe('deals');
    expect(getCrmDetailModule('/taken/t1')).toBe('taken');
    expect(getCrmDetailModule('/off-market/s1')).toBe('off-market');
    expect(getCrmDetailModule('/relaties')).toBeNull();
    expect(getCrmDetailModule('/vastgoedrekenen/abc')).toBeNull();
  });

  it('stuurt de vaste terug-link naar de expliciete return-context', () => {
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/deals/d1',
      targetPathname: '/deals',
      fallbackPath: '/deals',
      hasReturnContext: true,
    })).toBe('return');
  });

  it('laat de normale hoofdlijst-link intact zonder return-context', () => {
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/deals/d1',
      targetPathname: '/deals',
      fallbackPath: '/deals',
      hasReturnContext: false,
    })).toBe('normal');
  });

  it('herkent cross-module detailnavigatie', () => {
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/taken/t1',
      targetPathname: '/relaties/r1',
      fallbackPath: '/taken',
      hasReturnContext: false,
    })).toBe('cross-detail');
  });

  it('bemoeit zich niet met vorige/volgende binnen dezelfde module', () => {
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/objecten/o1',
      targetPathname: '/objecten/o2',
      fallbackPath: '/objecten',
      hasReturnContext: true,
    })).toBe('normal');
  });

  it('herkent programmatische terugknoppen maar niet terugzet-acties', () => {
    expect(isCrmTerugKnopTekst('Terug')).toBe(true);
    expect(isCrmTerugKnopTekst('Terug naar signalen')).toBe(true);
    expect(isCrmTerugKnopTekst('  TERUG NAAR TAKEN  ')).toBe(true);
    expect(isCrmTerugKnopTekst('Terugzetten naar actief')).toBe(false);
    expect(isCrmTerugKnopTekst('Vorige')).toBe(false);
  });
});
