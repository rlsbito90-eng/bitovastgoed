import { describe, it, expect } from 'vitest';
import { formatUnitIdentity } from '@/lib/vastgoedrekenen/unitIdentity';

describe('formatUnitIdentity', () => {
  it('formats full identity with index, label, type and m²', () => {
    const r = formatUnitIdentity({ label: '92A', type: 'appartement', surface: 85 }, 0);
    expect(r.indexStr).toBe('01');
    expect(r.full).toBe('01 — 92A · appartement · 85 m²');
  });

  it('falls back to name when label missing', () => {
    const r = formatUnitIdentity({ name: 'Woonunit', surface: 60 }, 2);
    expect(r.full).toBe('03 — Woonunit · 60 m²');
  });

  it('uses "Unit" when both label and name are empty', () => {
    const r = formatUnitIdentity({}, 0);
    expect(r.primary).toBe('Unit');
    expect(r.full).toBe('01 — Unit');
  });

  it('skips surface when zero or null', () => {
    const r = formatUnitIdentity({ label: 'A', type: 'winkel', surface: 0 }, 0);
    expect(r.full).toBe('01 — A · winkel');
  });

  it('formats studio identity correctly', () => {
    const r = formatUnitIdentity({ label: 'S1', type: 'studio', surface: 32 }, 4);
    expect(r.full).toBe('05 — S1 · studio · 32 m²');
  });

  it('formats kamer identity correctly', () => {
    const r = formatUnitIdentity({ label: 'K2', type: 'kamer', surface: 14 }, 9);
    expect(r.full).toBe('10 — K2 · kamer · 14 m²');
  });
});
