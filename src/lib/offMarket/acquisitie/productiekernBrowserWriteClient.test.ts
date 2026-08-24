import { describe, expect, it, vi } from 'vitest';

import { stelProductiekernBrowserWritesSamen } from './productiekernBrowserWriteClient';

function groeneWerkCrmOmgeving() {
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
function groeneProductieOmgeving() { return { VITE_ACQUISITIE_PRODUCTIEKERN_MODUS:'productie',VITE_SUPABASE_URL:'https://productie123.supabase.co',VITE_ACQUISITIE_PRODUCTIEKERN_PRODUCTIE_PROJECTREF:'productie123',VITE_ACQUISITIE_PRODUCTIEKERN_DDL_GEVERIFIEERD:'true',VITE_ACQUISITIE_PRODUCTIEKERN_RLS_GEVERIFIEERD:'true',VITE_ACQUISITIE_PRODUCTIEKERN_MIGRATIEPROEF_GROEN:'true',VITE_ACQUISITIE_PRODUCTIEKERN_CONCURRENCYPROEF_GROEN:'true',VITE_ACQUISITIE_PRODUCTIEKERN_VOLLEDIGE_TESTSUITE_GROEN:'true',VITE_ACQUISITIE_PRODUCTIEKERN_BUILD_GROEN:'true',VITE_ACQUISITIE_PRODUCTIEKERN_PRODUCTIEAKKOORD:'true' }; }
function uitvoerders() { return { vroege:{rpc:vi.fn()},bestaandConceptBridge:{rpc:vi.fn()},atomischePrintbatch:{rpc:vi.fn()},dossierBron:{rpc:vi.fn()},transacties:{voerRpcUit:vi.fn()} }; }

describe('productiekernBrowserWriteClient', () => {
  it('blokkeert alle write-adapters bij ontbrekend werk-CRM-bewijs vóór een RPC', async () => {
    const x=uitvoerders();const samenstelling=stelProductiekernBrowserWritesSamen({...groeneWerkCrmOmgeving(),VITE_ACQUISITIE_PRODUCTIEKERN_DUURZAME_DATA:'false'},x);
    expect(samenstelling.activatie.schrijvenActief).toBe(false);
    await expect(samenstelling.vroegeRepository.startVerwerking({selectieId:'selectie-1',actorId:'actor-1',operationKey:'op-1'})).rejects.toThrow(/niet geactiveerd/i);
    await expect(samenstelling.dossierBronRepository.startDossier({selectieId:'selectie-1',actorId:'actor-1',operationKey:'op-dossier'})).rejects.toThrow(/niet geactiveerd/i);
    await expect(samenstelling.bestaandConceptBridgeRepository.koppelBestaandConcept({selectieId:'selectie-1',signaalId:'signaal-1',briefId:'brief-1',actorId:'actor-1',operationKey:'op-bridge',inhoudSnapshot:{brieftekst:'Tekst'},geadresseerdeSnapshot:{naam:'Eigenaar'}})).rejects.toThrow(/niet geactiveerd/i);
    await expect(samenstelling.atomischePrintbatchRepository.maakPrintbatchMetBrieven({actorId:'actor-1',operationKey:'op-batch',datum:'2026-08-16',brieven:[{briefId:'brief-1',briefVersieId:'versie-1'}]})).rejects.toThrow(/niet geactiveerd/i);
    expect(()=>samenstelling.transactieRepository.markeerBatchGeprint({soort:'batch_geprint_markeren',batchId:'batch-1',actorId:'actor-1',operationKey:'op-2',verwachtDocumentversie:1,printdatum:'2026-08-08'})).toThrow(/niet geactiveerd/i);
    expect(x.vroege.rpc).not.toHaveBeenCalled();expect(x.dossierBron.rpc).not.toHaveBeenCalled();expect(x.bestaandConceptBridge.rpc).not.toHaveBeenCalled();expect(x.atomischePrintbatch.rpc).not.toHaveBeenCalled();expect(x.transacties.voerRpcUit).not.toHaveBeenCalled();
  });
  it('gebruikt exact hetzelfde groene werk-CRM-besluit voor alle write-adapters',()=>{const s=stelProductiekernBrowserWritesSamen(groeneWerkCrmOmgeving(),uitvoerders());expect(s.activatie.lezenActief).toBe(true);expect(s.activatie.schrijvenActief).toBe(true);expect(s.activatie.ontbrekendBewijs).toEqual([])});
  it('activeert dezelfde write-adapters via de afzonderlijke productiepoort',()=>{const s=stelProductiekernBrowserWritesSamen(groeneProductieOmgeving(),uitvoerders());expect(s.activatie.lezenActief).toBe(true);expect(s.activatie.schrijvenActief).toBe(true);expect(s.activatie.ontbrekendBewijs).toEqual([])});
  it('blijft volledig dicht wanneer de productie-Supabase-projectref niet overeenkomt',()=>{const s=stelProductiekernBrowserWritesSamen({...groeneProductieOmgeving(),VITE_SUPABASE_URL:'https://anderproject.supabase.co'},uitvoerders());expect(s.activatie.schrijvenActief).toBe(false);expect(s.activatie.ontbrekendBewijs).toContain('De gekoppelde Supabase-omgeving komt niet overeen met het verwachte productiedoel.');});
});
