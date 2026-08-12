import { describe, expect, it } from 'vitest';
import { STATUS_VOLGORDE } from './vastgoedkansen';
import {
  VASTGOEDKANS_STATUS_PRESENTATIE,
  vastgoedkansStatusChipClass,
  vastgoedkansStatusRowClass,
} from './vastgoedkansStatusPresentation';

describe('BUILD 2.0A.2 — Vastgoedkansen statuspresentatie', () => {
  it('heeft voor iedere operationele status een expliciete presentatie', () => {
    expect(Object.keys(VASTGOEDKANS_STATUS_PRESENTATIE).sort()).toEqual([...STATUS_VOLGORDE].sort());
    for (const status of STATUS_VOLGORDE) {
      expect(vastgoedkansStatusChipClass(status)).toContain('rounded-full');
      expect(vastgoedkansStatusRowClass(status)).toContain('border-l-4');
    }
  });

  it('maakt positieve reactie en afgevallen ook zonder labeltekst visueel verschillend', () => {
    expect(VASTGOEDKANS_STATUS_PRESENTATIE.positieve_reactie.chip)
      .not.toBe(VASTGOEDKANS_STATUS_PRESENTATIE.afgevallen.chip);
    expect(VASTGOEDKANS_STATUS_PRESENTATIE.positieve_reactie.row)
      .not.toBe(VASTGOEDKANS_STATUS_PRESENTATIE.afgevallen.row);
  });
});
