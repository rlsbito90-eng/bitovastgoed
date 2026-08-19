import { describe, expect, it } from 'vitest';
import {
  bepaalCrmDetailNavigationAction,
  getCrmDetailModule,
} from '@/components/CrmDetailNavigationBoundary';

describe('CrmDetailNavigationBoundary', () => {
  it('herkent alle ondersteunde CRM-detailroutes', () => {
    expect(getCrmDetailModule('/relaties/r1')).toBe('relaties');
    expect(getCrmDetailModule('/objecten/o1')).toBe('objecten');
    expect(getCrmDetailModule('/deals/d1')).toBe('deals');
    expect(getCrmDetailModule('/taken/t1')).toBe('taken');
    expect(getCrmDetailModule('/off-market/s1')).toBe('off-market');
    expect(getCrmDetailModule('/acquisitie/targets/a1')).toBe('acquisitie');
    expect(getCrmDetailModule('/acquisitie/campagnes/c1')).toBe('acquisitie');
    expect(getCrmDetailModule('/vastgoedkansen/v1')).toBe('vastgoedkansen');
    expect(getCrmDetailModule('/relaties')).toBeNull();
    expect(getCrmDetailModule('/vastgoedrekenen/abc')).toBeNull();
  });

  it('stuurt de vaste terug-link naar de expliciete return-context', () => {
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/deals/d1',
      targetPathname: '/deals',
      fallbackPath: '/deals',
      hasReturnContext: true,
      hasOriginContext: true,
    })).toBe('return');
  });

  it('kiest na return-context de stabiele detail-origin vóór browser-history', () => {
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/off-market/s3',
      targetPathname: '/off-market',
      fallbackPath: '/off-market',
      hasReturnContext: false,
      hasOriginContext: true,
    })).toBe('origin');
  });

  it('gebruikt alleen zonder expliciete context nog de browser-history', () => {
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/deals/d1',
      targetPathname: '/deals',
      fallbackPath: '/deals',
      hasReturnContext: false,
      hasOriginContext: false,
    })).toBe('history-back');
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/vastgoedkansen/v1',
      targetPathname: '/vastgoedkansen',
      fallbackPath: '/vastgoedkansen',
      hasReturnContext: false,
    })).toBe('history-back');
  });

  it('herkent cross-module detailnavigatie ook voor acquisitie en vastgoedkansen', () => {
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/taken/t1',
      targetPathname: '/relaties/r1',
      fallbackPath: '/taken',
      hasReturnContext: false,
    })).toBe('cross-detail');
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/acquisitie/targets/a1',
      targetPathname: '/vastgoedkansen/v1',
      fallbackPath: '/acquisitie',
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
    expect(bepaalCrmDetailNavigationAction({
      currentPathname: '/acquisitie/targets/a1',
      targetPathname: '/acquisitie/campagnes/c1',
      fallbackPath: '/acquisitie',
      hasReturnContext: false,
    })).toBe('normal');
  });
});
