import { describe, expect, it } from 'vitest';
import { isAmsterdamInOnderzoekNevenlevering } from './bereid-amsterdam-import-streamend-voor';

describe('isAmsterdamInOnderzoekNevenlevering', () => {
  it('herkent uitsluitend het vastgelegde landelijke InOnderzoek-bronbestand', () => {
    expect(isAmsterdamInOnderzoekNevenlevering('leveringen/9999InOnderzoek08072026.zip/records.xml')).toBe(true);
    expect(isAmsterdamInOnderzoekNevenlevering('leveringen\\9999InOnderzoek08072026.zip\\records.xml')).toBe(true);
    expect(isAmsterdamInOnderzoekNevenlevering('9999InOnderzoek08072026.zip')).toBe(true);
    expect(isAmsterdamInOnderzoekNevenlevering(
      '9999InOnderzoek08072026.zip!9999IOLIG08072026.zip!9999IOLIG08072026-000001.xml',
    )).toBe(true);
  });

  it('classificeert reguliere BAG-objectleveringen niet als nevenlevering', () => {
    expect(isAmsterdamInOnderzoekNevenlevering('0363Pand08072026.zip/records.xml')).toBe(false);
    expect(isAmsterdamInOnderzoekNevenlevering('9999InOnderzoek08072025.zip/records.xml')).toBe(false);
    expect(isAmsterdamInOnderzoekNevenlevering('kopie-9999InOnderzoek08072026.zip/records.xml')).toBe(false);
    expect(isAmsterdamInOnderzoekNevenlevering(
      '0363Pand08072026.zip!0363PND08072026.zip!0363PND08072026-000001.xml',
    )).toBe(false);
  });
});
