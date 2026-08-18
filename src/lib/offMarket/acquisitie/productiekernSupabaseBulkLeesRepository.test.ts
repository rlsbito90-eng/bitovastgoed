import { describe, expect, it, vi } from 'vitest';

import { SupabaseProductiekernBulkLeesRepository } from './productiekernSupabaseBulkLeesRepository';
import type { ProductiekernSupabaseLeesTransport } from './productiekernSupabaseLeesRepository';

const dossierRij = (selectieId: string) => ({
  selectie_id: selectieId,
  signaal_id: `signaal-${selectieId}`,
  object_id: null,
  verwerking_gestart_op: '2026-08-08T12:00:00Z',
  verwerking_gestart_door: 'actor-1',
  primaire_werkbak: 'eigenaar_achterhalen',
  volgende_actie_op: null,
  volgende_actie_omschrijving: null,
});

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
      if (tabel === 'off_market_acquisitie_dossiers') return ids.map(dossierRij);
      if (tabel === 'off_market_brieven') return ids.map(briefRij);
      return ids.map((id, index) => versieRij(id, `brief-${index + 1}`));
    }),
    haalMeerdereOpKolomIds: vi.fn(async (_tabel, _kolom, ids) =>
      ids.flatMap((briefId, index) => [
        versieRij(`versie-${index + 1}`, briefId),
        { ...versieRij(`versie-oud-${index + 1}`, briefId), versienummer: 0, status: 'vervallen', vervallen_op: '2026-08-08T11:00:00Z' },
      ])),
  };
}

describe('SupabaseProductiekernBulkLeesRepository', () => {
  it('leest dossiers voor meerdere selecties in één transportcall', async () => {
    const t = transport();
    const repository = new SupabaseProductiekernBulkLeesRepository(t);
    await expect(repository.haalDossiersOpSelectieIds(['selectie-1', 'selectie-2']))
      .resolves.toHaveLength(2);
    expect(t.haalMeerdereOpIds).toHaveBeenCalledTimes(1);
    expect(t.haalMeerdereOpIds).toHaveBeenCalledWith(
      'off_market_acquisitie_dossiers',
      ['selectie-1', 'selectie-2'],
    );
  });

  it('weigert dubbele dossiers voor dezelfde selectie fail-closed', async () => {
    const repository = new SupabaseProductiekernBulkLeesRepository({
      haalEen: vi.fn(async () => null),
      haalMeerdere: vi.fn(async () => []),
      haalMeerdereOpIds: vi.fn(async () => [dossierRij('selectie-1'), dossierRij('selectie-1')]),
    });
    await expect(repository.haalDossiersOpSelectieIds(['selectie-1']))
      .rejects.toThrow('Acquisitiedossier-bulkread bevat dubbele records.');
  });

  it('weigert een dossier voor een niet-gevraagde selectie fail-closed', async () => {
    const repository = new SupabaseProductiekernBulkLeesRepository({
      haalEen: vi.fn(async () => null),
      haalMeerdere: vi.fn(async () => []),
      haalMeerdereOpIds: vi.fn(async () => [dossierRij('selectie-onverwacht')]),
    });
    await expect(repository.haalDossiersOpSelectieIds(['selectie-1']))
      .rejects.toThrow('Acquisitiedossier-bulkread bevat een onverwacht ID.');
  });

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

  it('leest alle versies van een briefscope in één toegestane bulkcall', async () => {
    const t = transport();
    const repository = new SupabaseProductiekernBulkLeesRepository(t);
    const versies = await repository.haalBriefversiesOpBriefIds(['brief-1', 'brief-2']);
    expect(versies).toHaveLength(4);
    expect(t.haalMeerdereOpKolomIds).toHaveBeenCalledTimes(1);
    expect(t.haalMeerdereOpKolomIds).toHaveBeenCalledWith(
      'off_market_brief_versies', 'brief_id', ['brief-1', 'brief-2'],
    );
    expect(new Set(versies.map((v) => v.briefId))).toEqual(new Set(['brief-1', 'brief-2']));
  });

  it('weigert een versie buiten de gevraagde briefscope', async () => {
    const repository = new SupabaseProductiekernBulkLeesRepository({
      haalEen: vi.fn(async () => null),
      haalMeerdere: vi.fn(async () => []),
      haalMeerdereOpKolomIds: vi.fn(async () => [versieRij('versie-x', 'brief-onverwacht')]),
    });
    await expect(repository.haalBriefversiesOpBriefIds(['brief-1']))
      .rejects.toThrow('Briefversie-bulkread bevat een versie buiten de gevraagde briefscope.');
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
