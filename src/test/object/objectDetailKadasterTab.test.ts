import { describe, it, expect } from 'vitest';
import { shouldShowMeerTab, ANCHOR_TO_TAB } from '@/pages/ObjectDetailPage';

const baseObject = {
  id: 'obj-1',
  titel: 'Test Object',
  anoniem: false,
  plaats: 'Amsterdam',
  provincie: 'Noord-Holland',
  status: 'te_beoordelen',
  verhuurStatus: 'verhuurd',
  type: 'bedrijfsvastgoed',
  exclusief: false,
};

describe('shouldShowMeerTab — Kadasterdata zichtbaarheid', () => {
  it('toont "meer" tab wanneer er Kadasterrecords zijn, zonder juridisch/contacten/deals', () => {
    expect(
      shouldShowMeerTab(baseObject, [], [{ id: 'kd-1' }], []),
    ).toBe(true);
  });

  it('toont "meer" tab wanneer er Kadasterdocumenten zijn, zonder juridisch/contacten/deals', () => {
    expect(
      shouldShowMeerTab(baseObject, [], [], [{ id: 'doc-1' }]),
    ).toBe(true);
  });

  it('verbergt "meer" tab wanneer er geen juridisch, contacten, deals of Kadasterdata is', () => {
    expect(
      shouldShowMeerTab(baseObject, [], [], []),
    ).toBe(false);
  });

  it('verbergt "meer" tab wanneer object null is', () => {
    expect(
      shouldShowMeerTab(null, [], [{ id: 'kd-1' }], []),
    ).toBe(false);
  });

  it('toont "meer" tab wanneer er juridische data is (bestaand gedrag)', () => {
    expect(
      shouldShowMeerTab({ ...baseObject, eigendomssituatie: 'volle eigendom' }, [], [], []),
    ).toBe(true);
  });

  it('toont "meer" tab wanneer er contacten zijn (bestaand gedrag)', () => {
    expect(
      shouldShowMeerTab({ ...baseObject, verkoperNaam: 'Jan' }, [], [], []),
    ).toBe(true);
  });

});

describe('shouldShowMeerTab — geen deal-only zichtbaarheid (O5)', () => {
  it('verbergt "meer" tab wanneer er alleen deals zijn', () => {
    expect(shouldShowMeerTab(baseObject, [{ id: 'deal-1' }], [], [])).toBe(false);
  });
});

describe('ANCHOR_TO_TAB — referentieanalyse (O1)', () => {
  it('routeert #referenties naar de financieel-tab', () => {
    expect(ANCHOR_TO_TAB.referenties).toBe('financieel');
  });

  it('houdt #kandidaten op de kandidaten-tab', () => {
    expect(ANCHOR_TO_TAB.kandidaten).toBe('kandidaten');
  });
});
