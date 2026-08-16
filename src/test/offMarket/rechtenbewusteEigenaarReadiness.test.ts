import { describe, expect, it } from 'vitest';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { bepaalSignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';
import { bepaalWerkbakContext } from '@/lib/offMarket/acquisitie/werkbak';
import { bepaalFocusContext } from '@/lib/offMarket/acquisitie/focusContext';
import { bepaalOperationeleWerkbak } from '@/lib/offMarket/acquisitie/operationeleWerkbak';

function signaal(overrides: Partial<any> = {}): OffMarketSignaal {
  return {
    id: 'sig-controle',
    titel: 'Controleobject',
    type_signaal: 'overig',
    status: 'eigenaar_gevonden',
    assettype: 'overig',
    prioriteit: 'midden',
    bron_type: 'handmatig',
    ai_status: 'klaar',
    ai_score: 80,
    eigenaar_naam: 'Voorbeeld Eigenaar',
    eigenaar_verzendadres: 'Voorbeeldstraat 1\n1234 AB Voorbeeldstad',
    eigenaar_controle_nodig: false,
    eigenaar_controle_reden: null,
    ...overrides,
  } as any;
}

describe('rechtenbewuste eigenaar — readiness', () => {
  it('controleflag wint vóór adres/briefvoorbereiding en bewaart actuele blokkadereden', () => {
    const r = bepaalSignaalReadiness({
      signaal: signaal({
        eigenaar_controle_nodig: true,
        eigenaar_controle_reden: 'Meerdere rechthebbenden binnen het primaire recht.',
      }),
      brieven: [],
    });

    expect(r.fase).toBe('eigenaar_controleren');
    expect(r.info.status).toBe('geblokkeerd');
    expect(r.info.label).toBe('Eigenaar controleren');
    expect(r.info.reden).toContain('handmatige controle');
    expect(r.blokkadeReden).toBe('Meerdere rechthebbenden binnen het primaire recht.');
  });

  it('gebruikt veilige generieke reden wanneer controle_reden leeg is', () => {
    const r = bepaalSignaalReadiness({
      signaal: signaal({ eigenaar_controle_nodig: true, eigenaar_controle_reden: '   ' }),
      brieven: [],
    });

    expect(r.fase).toBe('eigenaar_controleren');
    expect(r.info.reden).toContain('handmatige controle');
    expect(r.blokkadeReden).toContain('handmatige controle');
  });

  it('afgeronde dossierstatus blijft leidend boven controleflag', () => {
    const r = bepaalSignaalReadiness({
      signaal: signaal({
        status: 'archief',
        eigenaar_controle_nodig: true,
        eigenaar_controle_reden: 'Historische controleflag',
      }),
      brieven: [],
    });

    expect(r.fase).toBe('afgerond');
  });
});

describe('rechtenbewuste eigenaar — routering', () => {
  it('plaatst eigenaar_controleren in Actie > Eigenaar controleren', () => {
    const s = signaal({ eigenaar_controle_nodig: true });
    const readiness = bepaalSignaalReadiness({ signaal: s, brieven: [] });
    const ctx = bepaalWerkbakContext({
      signaal: s,
      readiness,
      brieven: [],
      toegevoegdOp: '2026-08-16T12:00:00Z',
      vandaag: '2026-08-16',
    });

    expect(ctx.werkbak).toBe('actie');
    expect(ctx.actieSubfilter).toBe('eigenaar_controleren');
    expect(ctx.actieCategorie).toBe('eigenaar_controleren');
    expect(ctx.procesDatum?.label).toBe('Eigenaar controleren');
  });

  it('opent controlefase in Kadaster-focuscontext', () => {
    expect(bepaalFocusContext('eigenaar_controleren')).toMatchObject({
      context: 'onderzoeken',
      titel: 'Eigenaar controleren',
      tab: 'kadaster',
    });
  });

  it('routeert een gestarte controlefase naar eigenaar achterhalen', () => {
    expect(bepaalOperationeleWerkbak({
      fase: 'eigenaar_controleren',
      verwerkingGestart: true,
      wachtOpToekomstigeOpvolging: false,
    })).toBe('eigenaar_achterhalen');
  });
});
