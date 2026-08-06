import { describe, expect, it } from 'vitest';

import {
  bevestigLeegRpcResultaat,
  normaliseerProductieRpcFout,
  parseBriefDefinitiefRpcResultaat,
} from './productieRpcResultaat';

describe('normaliseerProductieRpcFout', () => {
  it('herkent een optimistic lock conflict als retrybaar', () => {
    const fout = normaliseerProductieRpcFout({
      rpc: 'off_market_brief_definitief_maken',
      message: 'optimistic_lock_conflict',
    });

    expect(fout).toMatchObject({
      code: 'optimistic_lock_conflict',
      retrybaar: true,
      veiligBericht: 'De gegevens zijn intussen gewijzigd. Ververs en probeer opnieuw.',
    });
  });

  it('maakt technische details niet onderdeel van het veilige bericht', () => {
    const fout = normaliseerProductieRpcFout({
      rpc: 'off_market_brief_gepost_markeren',
      message: 'briefversie_niet_in_batch',
      details: 'internal row id 123',
    });

    expect(fout.code).toBe('briefversie_niet_in_batch');
    expect(fout.veiligBericht).not.toContain('123');
    expect(fout.technischeMelding).toContain('internal row id 123');
  });

  it('valt fail-closed terug op een onbekende productiefout', () => {
    const fout = normaliseerProductieRpcFout({
      rpc: 'off_market_batch_geprint_markeren',
      message: 'connection reset',
    });

    expect(fout.code).toBe('onbekende_productiefout');
    expect(fout.retrybaar).toBe(true);
  });
});

describe('parseBriefDefinitiefRpcResultaat', () => {
  it('accepteert het tabelresultaat van de SQL-functie', () => {
    expect(parseBriefDefinitiefRpcResultaat([
      { brief_id: 'brief-1', briefnummer: 'BR2026000482' },
    ])).toEqual({ briefId: 'brief-1', briefnummer: 'BR2026000482' });
  });

  it('accepteert ook één object zonder array-wrapper', () => {
    expect(parseBriefDefinitiefRpcResultaat({
      brief_id: 'brief-1',
      briefnummer: 'BR2026000482',
    })).toEqual({ briefId: 'brief-1', briefnummer: 'BR2026000482' });
  });

  it('weigert een clientverzonnen of verkeerd geformatteerd nummer', () => {
    expect(() => parseBriefDefinitiefRpcResultaat([
      { brief_id: 'brief-1', briefnummer: 'BR-482' },
    ])).toThrow('briefnummer heeft een ongeldig formaat');
  });

  it('weigert een ontbrekend brief-id', () => {
    expect(() => parseBriefDefinitiefRpcResultaat([
      { briefnummer: 'BR2026000482' },
    ])).toThrow('brief_id ontbreekt');
  });
});

describe('bevestigLeegRpcResultaat', () => {
  it('accepteert null en undefined voor void-RPCs', () => {
    expect(() => bevestigLeegRpcResultaat(null)).not.toThrow();
    expect(() => bevestigLeegRpcResultaat(undefined)).not.toThrow();
  });

  it('weigert onverwachte responsepayloads', () => {
    expect(() => bevestigLeegRpcResultaat({ ok: true })).toThrow(
      'lege bevestiging verwacht',
    );
  });
});
