import { describe, it, expect } from 'vitest';
import { clampFocusValue } from '@/components/object/FocusPointDialog';

describe('FocusPoint clampFocusValue', () => {
  it('defaults naar 50 bij niet-eindige waarden', () => {
    expect(clampFocusValue(NaN)).toBe(50);
    expect(clampFocusValue(Infinity)).toBe(50);
    expect(clampFocusValue(-Infinity)).toBe(50);
  });

  it('clamped onder 0 naar 0', () => {
    expect(clampFocusValue(-25)).toBe(0);
  });

  it('clamped boven 100 naar 100', () => {
    expect(clampFocusValue(150)).toBe(100);
  });

  it('rond af naar dichtstbijzijnde integer', () => {
    expect(clampFocusValue(42.7)).toBe(43);
    expect(clampFocusValue(42.3)).toBe(42);
  });

  it('accepteert de randwaarden', () => {
    expect(clampFocusValue(0)).toBe(0);
    expect(clampFocusValue(100)).toBe(100);
    expect(clampFocusValue(50)).toBe(50);
  });
});

describe('FocusPoint klik-berekening', () => {
  // Simuleert de logica die in FocusPointDialog wordt gebruikt om
  // clientX/Y binnen een rect naar percentages te converteren.
  const berekenFocus = (rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number) => ({
    fx: clampFocusValue(((clientX - rect.left) / rect.width) * 100),
    fy: clampFocusValue(((clientY - rect.top) / rect.height) * 100),
  });

  it('klik in het midden geeft 50/50', () => {
    const rect = { left: 0, top: 0, width: 200, height: 100 };
    expect(berekenFocus(rect, 100, 50)).toEqual({ fx: 50, fy: 50 });
  });

  it('klik linksboven geeft 0/0', () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(berekenFocus(rect, 10, 20)).toEqual({ fx: 0, fy: 0 });
  });

  it('klik rechtsonder geeft 100/100', () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(berekenFocus(rect, 210, 120)).toEqual({ fx: 100, fy: 100 });
  });

  it('klik buiten rect wordt geclamped', () => {
    const rect = { left: 0, top: 0, width: 200, height: 100 };
    expect(berekenFocus(rect, -50, -50)).toEqual({ fx: 0, fy: 0 });
    expect(berekenFocus(rect, 500, 500)).toEqual({ fx: 100, fy: 100 });
  });
});

describe('object-position defaults', () => {
  it('foto zonder focus krijgt 50/50 als fallback', () => {
    const foto: { focusX?: number; focusY?: number } = {};
    const objectPosition = `${foto.focusX ?? 50}% ${foto.focusY ?? 50}%`;
    expect(objectPosition).toBe('50% 50%');
  });

  it('opgeslagen focuspunt wordt toegepast als object-position', () => {
    const foto = { focusX: 25, focusY: 75 };
    const objectPosition = `${foto.focusX ?? 50}% ${foto.focusY ?? 50}%`;
    expect(objectPosition).toBe('25% 75%');
  });
});
