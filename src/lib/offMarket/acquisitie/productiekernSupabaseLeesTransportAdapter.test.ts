import { describe, expect, it, vi } from 'vitest';

import {
  maakProductiekernSupabaseLeesTransport,
  ProductiekernLeesTransportError,
  type ProductiekernSupabaseQueryUitvoerder,
} from './productiekernSupabaseLeesTransportAdapter';

describe('maakProductiekernSupabaseLeesTransport', () => {
  it('voert uitsluitend het vaste dossiercontract uit en audit zonder filterwaarde', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => ({ selectie_id: 'selectie-1' })),
    };
    const audit = vi.fn();
    const tijden = [100, 112];
    const transport = maakProductiekernSupabaseLeesTransport(uitvoerder, {
      audit,
      klok: () => tijden.shift() ?? 112,
    });

    await expect(transport.haalEen('off_market_acquisitie_dossiers', { selectie_id: 'selectie-1' }))
      .resolves.toEqual({ selectie_id: 'selectie-1' });
    expect(uitvoerder.voerUit).toHaveBeenCalledWith(expect.objectContaining({
      tabel: 'off_market_acquisitie_dossiers', filterKolom: 'selectie_id', filterWaarde: 'selectie-1',
      cardinaliteit: 'nul_of_een', maximaalAantalRecords: 1,
    }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ query: 'haal_dossier', aantalRecords: 1 }));
    expect(JSON.stringify(audit.mock.calls)).not.toContain('selectie-1');
  });

  it('voert de allowlisted batchbrief-lijst deterministisch uit', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => [{ id: 'koppeling-1', batch_id: 'batch-1' }]),
    };
    const transport = maakProductiekernSupabaseLeesTransport(uitvoerder);
    await expect(transport.haalMeerdere(
      'off_market_printbatch_brieven', { batch_id: 'batch-1' }, { kolom: 'created_at', oplopend: true },
    )).resolves.toHaveLength(1);
  });

  it('voert bulk uitsluitend via de aparte bulk-capability uit', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => null),
      voerBulkUit: vi.fn(async ({ filterWaarden }) => filterWaarden.map((id) => ({ id }))),
    };
    const audit = vi.fn();
    const transport = maakProductiekernSupabaseLeesTransport(uitvoerder, { audit, klok: () => 10 });

    await expect(transport.haalMeerdereOpIds?.('off_market_brieven', [' brief-2 ', 'brief-1', 'brief-2']))
      .resolves.toEqual([{ id: 'brief-2' }, { id: 'brief-1' }]);
    expect(uitvoerder.voerUit).not.toHaveBeenCalled();
    expect(uitvoerder.voerBulkUit).toHaveBeenCalledWith(expect.objectContaining({
      tabel: 'off_market_brieven', filterKolom: 'id', filterWaarden: ['brief-2', 'brief-1'],
      maximaalAantalRecords: 1000,
    }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      query: 'haal_brieven_op_ids', uitkomst: 'lijst', aantalRecords: 2,
    }));
    expect(JSON.stringify(audit.mock.calls)).not.toContain('brief-1');
  });

  it('faalt gesloten wanneer geen bulk-uitvoerder is aangesloten', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = { voerUit: vi.fn(async () => null) };
    const transport = maakProductiekernSupabaseLeesTransport(uitvoerder);
    await expect(transport.haalMeerdereOpIds?.('off_market_brieven', ['brief-1']))
      .rejects.toThrow('Bulk-uitvoerder voor haal_brieven_op_ids is niet aangesloten.');
    expect(uitvoerder.voerUit).not.toHaveBeenCalled();
  });

  it('weigert onbekende tabellen, afwijkende filters en sortering vóór uitvoering', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = { voerUit: vi.fn(async () => []) };
    const transport = maakProductiekernSupabaseLeesTransport(uitvoerder);
    await expect(transport.haalEen('klanten', { id: '1' })).rejects.toThrow('Niet-toegestane productiekernleestabel');
    await expect(transport.haalEen('off_market_brieven', { brief_id: '1' })).rejects.toThrow('Filtercontract voor haal_brief wijkt af.');
    await expect(transport.haalMeerdere('off_market_brief_versies', { brief_id: '1' }, { kolom: 'created_at', oplopend: false }))
      .rejects.toThrow('Volgordecontract voor haal_briefversies wijkt af.');
    await expect(transport.haalMeerdereOpIds?.('klanten' as 'off_market_brieven', ['1']))
      .rejects.toThrow('Niet-toegestane productiekern-bulkleestabel');
    expect(uitvoerder.voerUit).not.toHaveBeenCalled();
  });

  it('normaliseert transportfouten en lekt geen ruwe foutdetails', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => { throw { status: 503, message: 'select * from geheime_tabel' }; }),
    };
    const audit = vi.fn();
    const transport = maakProductiekernSupabaseLeesTransport(uitvoerder, { audit, klok: () => 10 });
    const fout = await transport.haalEen('off_market_brieven', { id: 'brief-1' }).then(() => null, (error) => error);
    expect(fout).toBeInstanceOf(ProductiekernLeesTransportError);
    expect(fout).toMatchObject({ code: 'transport_tijdelijk_onbeschikbaar', herstelbaar: true });
    expect(JSON.stringify(fout)).not.toContain('geheime_tabel');
  });

  it('bewaakt nul-of-een, lijst en maximumcardinaliteit na uitvoering', async () => {
    const enkelAlsLijst: ProductiekernSupabaseQueryUitvoerder = { voerUit: vi.fn(async () => []) };
    await expect(maakProductiekernSupabaseLeesTransport(enkelAlsLijst).haalEen('off_market_brieven', { id: 'brief-1' }))
      .rejects.toThrow('Cardinaliteitscontract voor haal_brief wijkt af.');

    const teVeel: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => Array.from({ length: 101 }, (_, index) => ({ id: `versie-${index}` }))),
    };
    await expect(maakProductiekernSupabaseLeesTransport(teVeel).haalMeerdere(
      'off_market_brief_versies', { brief_id: 'brief-1' }, { kolom: 'versienummer', oplopend: true },
    )).rejects.toMatchObject({ code: 'record_niet_uniek', herstelbaar: false });
  });
});
