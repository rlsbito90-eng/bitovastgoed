import { describe, expect, it, vi } from 'vitest';

import type { BriefContract, BriefversieContract, PrintbatchBriefContract, PrintbatchContract } from './productiekernContract';
import { laadProductiekernProductiepakket } from './productiekernProductiepakketLader';

const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026080801', status: 'concept', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: null, verzenddatum: null,
  geannuleerdOp: null, annuleringsreden: null,
};

function brief(index: number): BriefContract {
  return {
    id: `brief-${index}`, briefnummer: `BR2026${String(index).padStart(6, '0')}`,
    signaalId: `signaal-${index}`, selectieId: `selectie-${index}`, objectId: null,
    relatieId: null, actieveVersie: 1, status: 'definitief', vervangingVanBriefId: null,
    definitiefOp: '2026-08-08T12:00:00Z', vergrendeldOp: null, annuleringsreden: null,
  };
}

function versie(index: number): BriefversieContract {
  return {
    id: `versie-${index}`, briefId: `brief-${index}`, versienummer: 1, status: 'actief',
    inhoud: {
      onderwerp: 'Onderwerp', brieftekst: `Brief ${index}`, objectadres: `Straat ${index}`,
      objectomschrijving: null, templateId: null, templateVersie: null,
    },
    geadresseerde: {
      naam: `Eigenaar ${index}`, bedrijfsnaam: null, aanhef: 'Geachte heer/mevrouw',
      straatHuisnummer: `Straat ${index}`, postcode: '1011 AA', plaats: 'Amsterdam',
      land: 'Nederland', bron: 'handmatig', verificatiestatus: 'geverifieerd', relatieId: null,
    },
    bestandReferentie: `brief-${index}.pdf`, createdAt: '2026-08-08T12:00:00Z',
    vervallenOp: null, verzondenOp: null,
  };
}

function koppeling(index: number): PrintbatchBriefContract {
  return {
    id: `koppeling-${index}`, batchId: 'batch-1', briefId: `brief-${index}`,
    briefVersieId: `versie-${index}`, verwijderdOp: null,
    afwijkingsstatus: null, afwijkingsreden: null,
  };
}

describe('laadProductiekernProductiepakket', () => {
  it('bouwt 100 brieven met exact vier repositoryreads en zonder N+1', async () => {
    const koppelingen = Array.from({ length: 100 }, (_, index) => koppeling(index + 1));
    const haalPrintbatch = vi.fn(async () => batch);
    const haalPrintbatchBrieven = vi.fn(async () => koppelingen);
    const haalBrievenOpIds = vi.fn(async () => Array.from({ length: 100 }, (_, index) => brief(index + 1)));
    const haalBriefversiesOpIds = vi.fn(async () => Array.from({ length: 100 }, (_, index) => versie(index + 1)));

    const pakket = await laadProductiekernProductiepakket('batch-1', {
      repository: { haalPrintbatch, haalPrintbatchBrieven },
      bulkRepository: { haalBrievenOpIds, haalBriefversiesOpIds },
    });

    expect(pakket?.manifest.briefAantal).toBe(100);
    expect(pakket?.brieven).toHaveLength(100);
    expect(haalPrintbatch).toHaveBeenCalledTimes(1);
    expect(haalPrintbatchBrieven).toHaveBeenCalledTimes(1);
    expect(haalBrievenOpIds).toHaveBeenCalledTimes(1);
    expect(haalBriefversiesOpIds).toHaveBeenCalledTimes(1);
    expect(haalBrievenOpIds).toHaveBeenCalledWith(koppelingen.map((item) => item.briefId));
    expect(haalBriefversiesOpIds).toHaveBeenCalledWith(koppelingen.map((item) => item.briefVersieId));
  });

  it('blokkeert het hele pakket wanneer een gekoppelde formele brief ontbreekt', async () => {
    await expect(laadProductiekernProductiepakket('batch-1', {
      repository: {
        haalPrintbatch: vi.fn(async () => batch),
        haalPrintbatchBrieven: vi.fn(async () => [koppeling(1), koppeling(2)]),
      },
      bulkRepository: {
        haalBrievenOpIds: vi.fn(async () => [brief(1)]),
        haalBriefversiesOpIds: vi.fn(async () => [versie(1), versie(2)]),
      },
    })).rejects.toThrow('Formele brief ontbreekt voor batchkoppeling koppeling-2.');
  });

  it('blokkeert een koppeling naar een versie van een andere brief', async () => {
    const foutVersie = { ...versie(1), briefId: 'brief-99' };
    await expect(laadProductiekernProductiepakket('batch-1', {
      repository: {
        haalPrintbatch: vi.fn(async () => batch),
        haalPrintbatchBrieven: vi.fn(async () => [koppeling(1)]),
      },
      bulkRepository: {
        haalBrievenOpIds: vi.fn(async () => [brief(1)]),
        haalBriefversiesOpIds: vi.fn(async () => [foutVersie]),
      },
    })).rejects.toThrow('versie van een andere brief');
  });

  it('geeft null terug wanneer de printbatch niet bestaat', async () => {
    const haalPrintbatchBrieven = vi.fn();
    await expect(laadProductiekernProductiepakket('ontbreekt', {
      repository: { haalPrintbatch: vi.fn(async () => null), haalPrintbatchBrieven },
      bulkRepository: { haalBrievenOpIds: vi.fn(), haalBriefversiesOpIds: vi.fn() },
    })).resolves.toBeNull();
    expect(haalPrintbatchBrieven).not.toHaveBeenCalled();
  });
});
