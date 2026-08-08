import { describe, expect, it } from 'vitest';

import {
  bewaakBriefversiesVoorGevraagdeBrief,
  bewaakGevraagdeLeesIdentiteit,
  ProductiekernLeesIdentiteitError,
} from './productiekernLeesIdentiteit';

describe('productiekern leesidentiteit', () => {
  it('accepteert exact dezelfde aangevraagde identiteit', () => {
    expect(() => bewaakGevraagdeLeesIdentiteit('Brief', 'brief-1', 'brief-1'))
      .not.toThrow();
  });

  it('weigert mismatch en lege aangevraagde identiteit fail-closed', () => {
    expect(() => bewaakGevraagdeLeesIdentiteit('Dossier', 'selectie-1', 'selectie-2'))
      .toThrow(ProductiekernLeesIdentiteitError);
    expect(() => bewaakGevraagdeLeesIdentiteit('Printbatch', ' ', 'batch-1'))
      .toThrow('ander record dan aangevraagd');
  });

  it('weigert een briefversielijst met een record van een andere brief', () => {
    expect(() => bewaakBriefversiesVoorGevraagdeBrief(
      'brief-1', ['brief-1', 'brief-2'],
    )).toThrow(ProductiekernLeesIdentiteitError);
    expect(() => bewaakBriefversiesVoorGevraagdeBrief(
      'brief-1', ['brief-1', 'brief-1'],
    )).not.toThrow();
  });
});
