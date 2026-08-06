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

    await expect(transport.haalEen(
      'off_market_acquisitie_dossiers',
      { selectie_id: 'selectie-1' },
    )).resolves.toEqual({ selectie_id: 'selectie-1' });

    expect(uitvoerder.voerUit).toHaveBeenCalledWith({
      tabel: 'off_market_acquisitie_dossiers',
      selectKolommen: expect.arrayContaining(['selectie_id', 'primaire_werkbak']),
      filterKolom: 'selectie_id',
      filterWaarde: 'selectie-1',
      cardinaliteit: 'nul_of_een',
      volgorde: undefined,
    });
    expect(audit).toHaveBeenCalledWith({
      query: 'haal_dossier',
      uitkomst: 'gevonden',
      duurMs: 12,
      aantalRecords: 1,
      foutcode: null,
      bevatPersoonsgegevens: false,
      bevatFilterwaarde: false,
    });
    expect(JSON.stringify(audit.mock.calls)).not.toContain('selectie-1');
  });

  it('weigert onbekende tabellen, afwijkende filters en sortering vóór uitvoering', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => []),
    };
    const transport = maakProductiekernSupabaseLeesTransport(uitvoerder);

    await expect(transport.haalEen('klanten', { id: '1' }))
      .rejects.toThrow('Niet-toegestane productiekernleestabel: klanten.');
    await expect(transport.haalEen('off_market_brieven', { brief_id: '1' }))
      .rejects.toThrow('Filtercontract voor haal_brief wijkt af.');
    await expect(transport.haalMeerdere(
      'off_market_brief_versies',
      { brief_id: '1' },
      { kolom: 'created_at', oplopend: false },
    )).rejects.toThrow('Volgordecontract voor haal_briefversies wijkt af.');
    expect(uitvoerder.voerUit).not.toHaveBeenCalled();
  });

  it('normaliseert transportfouten en lekt geen ruwe foutdetails', async () => {
    const uitvoerder: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => {
        throw { status: 503, message: 'select * from geheime_tabel' };
      }),
    };
    const audit = vi.fn();
    const transport = maakProductiekernSupabaseLeesTransport(uitvoerder, {
      audit,
      klok: () => 10,
    });

    const fout = await transport.haalEen('off_market_brieven', { id: 'brief-1' })
      .then(() => null, (error) => error);

    expect(fout).toBeInstanceOf(ProductiekernLeesTransportError);
    expect(fout).toMatchObject({
      code: 'transport_tijdelijk_onbeschikbaar',
      herstelbaar: true,
      message: 'De productiekern-read is tijdelijk niet beschikbaar.',
    });
    expect(JSON.stringify(fout)).not.toContain('geheime_tabel');
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      query: 'haal_brief',
      uitkomst: 'fout',
      foutcode: 'transport_tijdelijk_onbeschikbaar',
    }));
  });

  it('bewaakt nul-of-een en lijst-cardinaliteit na uitvoering', async () => {
    const enkelAlsLijst: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => []),
    };
    await expect(maakProductiekernSupabaseLeesTransport(enkelAlsLijst).haalEen(
      'off_market_brieven',
      { id: 'brief-1' },
    )).rejects.toThrow('Cardinaliteitscontract voor haal_brief wijkt af.');

    const lijstAlsEnkel: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => ({ id: 'versie-1' })),
    };
    await expect(maakProductiekernSupabaseLeesTransport(lijstAlsEnkel).haalMeerdere(
      'off_market_brief_versies',
      { brief_id: 'brief-1' },
      { kolom: 'versienummer', oplopend: true },
    )).rejects.toThrow('Cardinaliteitscontract voor haal_briefversies wijkt af.');
  });
});
