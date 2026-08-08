import { describe, expect, it, vi } from 'vitest';

import { SupabaseProductiekernBulkLeesRepository } from './productiekernSupabaseBulkLeesRepository';
import type { ProductiekernSupabaseLeesTransport } from './productiekernSupabaseLeesRepository';

const briefRij = (id: string) => ({
  id, briefnummer: id === 'brief-1' ? 'BR2026000001' : 'BR2026000002',
  signaal_id: `signaal-${id}`, selectie_id: `selectie-${id}`, object_id: null, relatie_id: null,
  actieve_versie: 1, status: 'definitief', vervanging_van_brief_id: null,
  definitief_op: '2026-08-08T12:00:00Z', vergrendeld_op: '2026-08-08T12:00:00Z', annuleringsreden: null,
});

const versieRij = (id: string, briefId: string) => ({
  id, brief_id: briefId, versienummer: 1, status: 'actief',
  inhoud_snapshot: {
    onderwerp: 'Onderwerp', brieftekst: 'Tekst', objectadres: 'Straat 1',
    objectomschrijving: null, templateId: null, templateVersie: null,
  },
  geadresseerde_snapshot: {
    naam: 'Eigenaar', bedrijfsnaam: null, aanhef: 'Geachte heer/mevrouw',
    straatHuisnummer: 'Straat 1', postcode: '1011 AA', plaats: 'Amsterdam', land: 'Nederland',
    bron: 'handmatig', verificatiestatus: 'geverifieerd', relatieId: null,
  },
  bestand_referentie: 'brief.pdf', created_at: '2026-08-08T12:00:00Z',
  vervallen_op: null, verzonden_op: null,
});

function transport(): ProductiekernSupabaseLeesTransport {
  return {
    haalEen: vi.fn(async () => null),
    haalMeerdere: vi.fn(async () => []),
    haalMeerdereOpIds: vi.fn(async (tabel, ids) => {
      if (tabel === 'off_market_brieven') return ids.map(briefRij);
      return ids.map((id, index) => versieRij(id, `brief-${index + 1}`));
    }),
  };
}

describe('SupabaseProductiekernBulkLeesRepository', () => {
  it('leest meerdere formele brieven in één transportcall', async () => {
    const t = transport();
    const repository = new SupabaseProductiekernBulkLeesRepository(t);
    await expect(repository.haalBrievenOpIds(['brief-1', 'brief-2'])).resolves.toHaveLength(2);
    expect(t.haalMeerdereOpIds).toHaveBeenCalledTimes(1);
    expect(t.haalMeerdereOpIds).toHaveBeenCalledWith('off_market_brieven', ['brief-1', 'brief-2']);
  });

  it('leest exact gekoppelde briefversies in één transportcall, ook wanneer meerdere brieven versie 1 hebben', async () => {
    const t = transport();
    const repository = new SupabaseProductiekernBulkLeesRepository(t);
    await expect(repository.haalBriefversiesOpIds(['versie-1', 'versie-2'])).resolves.toHaveLength(2);
    expect(t.haalMeerdereOpIds).toHaveBeenCalledWith('off_market_brief_versies', ['versie-1', 'versie-2']);
  });

  it('faalt gesloten als bulktransport ontbreekt', async () => {
    const repository = new SupabaseProductiekernBulkLeesRepository({
      haalEen: vi.fn(async () => null),
      haalMeerdere: vi.fn(async () => []),
    });
    await expect(repository.haalBrievenOpIds(['brief-1']))
      .rejects.toThrow('Productiekern-bulktransport is niet aangesloten.');
  });

  it('houdt legacy brieven buiten bulkresultaten zodat ontbrekende formele records zichtbaar blijven', async () => {
    const repository = new SupabaseProductiekernBulkLeesRepository({
      haalEen: vi.fn(async () => null),
      haalMeerdere: vi.fn(async () => []),
      haalMeerdereOpIds: vi.fn(async () => [{
        ...briefRij('brief-1'), selectie_id: null, status: 'verstuurd', briefnummer: null,
      }]),
    });
    await expect(repository.haalBrievenOpIds(['brief-1'])).resolves.toEqual([]);
  });
});
