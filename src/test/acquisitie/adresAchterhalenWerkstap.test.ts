import { describe, expect, it } from 'vitest';
import {
  ACTIE_SUBFILTER_LABEL,
  bepaalWerkbakContext,
} from '@/lib/offMarket/acquisitie/werkbak';
import { leesInitieleView, SUBFILTER_KEY, WERKBAK_KEY } from '@/lib/offMarket/acquisitie/selectieViewState';

describe('Adres achterhalen als eigen acquisitie-actiestap', () => {
  it('routeert adres_ontbreekt niet langer naar Onderzoeken', () => {
    const ctx = bepaalWerkbakContext({
      signaal: { id: 's-adres', status: 'eigenaar_achterhalen' } as any,
      readiness: { fase: 'adres_ontbreekt' } as any,
      brieven: [],
      toegevoegdOp: null,
      vandaag: '2026-08-16',
    });

    expect(ctx.werkbak).toBe('actie');
    expect(ctx.actieCategorie).toBe('adres_achterhalen');
    expect(ctx.actieSubfilter).toBe('adres_achterhalen');
    expect(ctx.procesDatum?.label).toBe('Adres achterhalen');
    expect(ACTIE_SUBFILTER_LABEL.adres_achterhalen).toBe('Adres achterhalen');
  });

  it('herstelt de aparte actiestap uit session storage', () => {
    const storage = {
      getItem(key: string) {
        if (key === WERKBAK_KEY) return 'actie';
        if (key === SUBFILTER_KEY) return 'adres_achterhalen';
        return null;
      },
    };

    expect(leesInitieleView(storage)).toEqual({
      werkbak: 'actie',
      subfilter: 'adres_achterhalen',
    });
  });
});
