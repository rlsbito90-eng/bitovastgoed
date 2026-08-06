import { describe, expect, it } from 'vitest';
import {
  isGeldigeProductiekernOperationKey,
  maakProductiekernOperationKey,
} from './productiekernOperationKey';

describe('productiekern operation keys', () => {
  it('bouwt een stabiele sleutel voor retries van hetzelfde verzoek', () => {
    const input = {
      handeling: 'brief_reserveren' as const,
      hoofdobjectType: 'selectie' as const,
      hoofdobjectId: 'selectie-123',
      verzoekId: 'request-abc',
    };

    const eerste = maakProductiekernOperationKey(input);
    const retry = maakProductiekernOperationKey(input);

    expect(eerste).toBe('acq-productie:v1:brief_reserveren:selectie:selectie-123:request-abc');
    expect(retry).toBe(eerste);
    expect(isGeldigeProductiekernOperationKey(eerste)).toBe(true);
  });

  it('geeft een nieuw bewust verzoek een andere sleutel', () => {
    const basis = {
      handeling: 'printbatch_maken' as const,
      hoofdobjectType: 'selectie' as const,
      hoofdobjectId: 'selectie-123',
    };

    expect(maakProductiekernOperationKey({ ...basis, verzoekId: 'request-1' }))
      .not.toBe(maakProductiekernOperationKey({ ...basis, verzoekId: 'request-2' }));
  });

  it('neemt geen vrije tekst of persoonsgegevens aan', () => {
    expect(() => maakProductiekernOperationKey({
      handeling: 'brief_gepost_markeren',
      hoofdobjectType: 'brief',
      hoofdobjectId: 'brief met spaties',
      verzoekId: 'request-1',
    })).toThrow(/hoofdobjectId/);

    expect(() => maakProductiekernOperationKey({
      handeling: 'brief_gepost_markeren',
      hoofdobjectType: 'brief',
      hoofdobjectId: 'brief-1',
      verzoekId: 'eigenaar@example.nl',
    })).toThrow(/verzoekId/);
  });

  it('weigert onbekende versies, handelingen en onvolledige sleutels', () => {
    expect(isGeldigeProductiekernOperationKey(
      'acq-productie:v2:brief_reserveren:selectie:selectie-1:request-1',
    )).toBe(false);
    expect(isGeldigeProductiekernOperationKey(
      'acq-productie:v1:onbekend:selectie:selectie-1:request-1',
    )).toBe(false);
    expect(isGeldigeProductiekernOperationKey('acq-productie:v1')).toBe(false);
  });
});
