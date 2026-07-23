import { describe, expect, it } from 'vitest';
import { formatArea, formatNumberForKind, parseDutchNumber } from '@/lib/format/nl';

describe('Fase 1.1 — decimale metrages', () => {
  it('behoudt één decimaal zonder kunstmatige nul', () => {
    expect(formatArea(76.4)).toBe('76,4 m²');
    expect(formatArea(562.4)).toBe('562,4 m²');
    expect(formatNumberForKind(76.4, 'area')).toBe('76,4');
  });

  it('toont hele metrages zonder decimalen', () => {
    expect(formatArea(80)).toBe('80 m²');
    expect(formatNumberForKind(80, 'area')).toBe('80');
  });

  it('parseert Nederlandse en punt-decimale metrages gelijk', () => {
    expect(parseDutchNumber('76,4 m²')).toBe(76.4);
    expect(parseDutchNumber('562.4')).toBe(562.4);
  });
});
