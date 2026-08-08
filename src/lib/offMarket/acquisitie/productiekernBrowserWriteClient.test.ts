import { describe, expect, it, vi } from 'vitest';

import { stelProductiekernBrowserWritesSamen } from './productiekernBrowserWriteClient';

function groeneOmgeving() {
  return {
    VITE_ACQUISITIE_PRODUCTIEKERN_MODUS: 'werkcrm',
    VITE_SUPABASE_URL: 'https://werkcrm123.supabase.co',
    VITE_ACQUISITIE_PRODUCTIEKERN_WERKCRM_PROJECTREF: 'werkcrm123',
    VITE_ACQUISITIE_PRODUCTIEKERN_SCHEMA_GEINSTALLEERD: 'true',
    VITE_ACQUISITIE_PRODUCTIEKERN_RLS_GEVERIFIEERD: 'true',
    VITE_ACQUISITIE_PRODUCTIEKERN_WORKFLOWTESTS_GROEN: 'true',
    VITE_ACQUISITIE_PRODUCTIEKERN_BUILD_GROEN: 'true',
    VITE_ACQUISITIE_PRODUCTIEKERN_DUURZAME_DATA: 'true',
    VITE_ACQUISITIE_PRODUCTIEKERN_WERKAKKOORD: 'true',
  };
}

describe('productiekernBrowserWriteClient', () => {
  it('blokkeert alle write-adapters bij ontbrekend werk-CRM-bewijs vóór een RPC', async () => {
    const vroegeRpc = vi.fn();
    const bridgeRpc = vi.fn();
    const lateRpc = vi.fn();
    const samenstelling = stelProductiekernBrowserWritesSamen(
      { ...groeneOmgeving(), VITE_ACQUISITIE_PRODUCTIEKERN_DUURZAME_DATA: 'false' },
      {
        vroege: { rpc: vroegeRpc },
        bestaandConceptBridge: { rpc: bridgeRpc },
        transacties: { voerRpcUit: lateRpc },
      },
    );

    expect(samenstelling.activatie.schrijvenActief).toBe(false);
    await expect(samenstelling.vroegeRepository.startVerwerking({
      selectieId: 'selectie-1', actorId: 'actor-1', operationKey: 'op-1',
    })).rejects.toThrow(/niet geactiveerd/i);
    await expect(samenstelling.bestaandConceptBridgeRepository.koppelBestaandConcept({
      selectieId: 'selectie-1',
      signaalId: 'signaal-1',
      briefId: 'brief-1',
      actorId: 'actor-1',
      operationKey: 'op-bridge',
      inhoudSnapshot: { brieftekst: 'Tekst' },
      geadresseerdeSnapshot: { naam: 'Eigenaar' },
    })).rejects.toThrow(/niet geactiveerd/i);
    expect(() => samenstelling.transactieRepository.markeerBatchGeprint({
      soort: 'batch_geprint_markeren',
      batchId: 'batch-1', actorId: 'actor-1', operationKey: 'op-2',
      verwachtDocumentversie: 1, printdatum: '2026-08-08',
    })).toThrow(/niet geactiveerd/i);

    expect(vroegeRpc).not.toHaveBeenCalled();
    expect(bridgeRpc).not.toHaveBeenCalled();
    expect(lateRpc).not.toHaveBeenCalled();
  });

  it('gebruikt exact hetzelfde groene werk-CRM-besluit voor alle write-adapters', () => {
    const samenstelling = stelProductiekernBrowserWritesSamen(groeneOmgeving(), {
      vroege: { rpc: vi.fn() },
      bestaandConceptBridge: { rpc: vi.fn() },
      transacties: { voerRpcUit: vi.fn() },
    });

    expect(samenstelling.activatie.lezenActief).toBe(true);
    expect(samenstelling.activatie.schrijvenActief).toBe(true);
    expect(samenstelling.activatie.ontbrekendBewijs).toEqual([]);
  });

  it('blijft volledig dicht wanneer de actuele Supabase-projectref niet overeenkomt', () => {
    const samenstelling = stelProductiekernBrowserWritesSamen(
      { ...groeneOmgeving(), VITE_SUPABASE_URL: 'https://anderproject.supabase.co' },
      {
        vroege: { rpc: vi.fn() },
        bestaandConceptBridge: { rpc: vi.fn() },
        transacties: { voerRpcUit: vi.fn() },
      },
    );

    expect(samenstelling.activatie.schrijvenActief).toBe(false);
    expect(samenstelling.activatie.ontbrekendBewijs.length).toBeGreaterThan(0);
  });
});
