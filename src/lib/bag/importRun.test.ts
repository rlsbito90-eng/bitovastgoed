import { describe, expect, it } from 'vitest';
import {
  magStatusOvergang,
  volgendeHervatbareFase,
  valideerPublicatie,
  valideerRollback,
  type BagImportRun,
} from './importRun';

function geldigeRun(): BagImportRun {
  return {
    id: 'bag-run-001',
    status: 'klaar_voor_publicatie',
    bron: {
      bestandsnaam: 'bag-tilburg-2026-08.zip',
      datasetVersie: '2026-08-08',
      peildatum: '2026-08-08',
      checksumAlgoritme: 'sha256',
      verwachteChecksum: 'abc123',
      werkelijkeChecksum: 'abc123',
      scopeType: 'gemeente',
      scopeCode: '0855',
      scopeNaam: 'Tilburg',
    },
    checkpoints: [
      'bron_verificatie',
      'uitpakken',
      'parsen',
      'staging_load',
      'validatie',
    ].map(fase => ({
      fase: fase as BagImportRun['checkpoints'][number]['fase'],
      cursor: null,
      verwerkteRecords: 1,
      geweigerdeRecords: 0,
      voltooid: true,
      bijgewerktOp: '2026-08-02T21:30:00+02:00',
    })),
    validatie: {
      checksumGeverifieerd: true,
      bronScopeGeverifieerd: true,
      tellingenSluiten: true,
      relatiesSluiten: true,
      geometrieGeldig: true,
      idempotentieGeverifieerd: true,
      stilleUitval: 0,
      afwijzingen: [],
    },
    publicatiePlan: {
      stagingDatasetVersie: '2026-08-08',
      huidigeActieveDatasetVersie: '2026-07-08',
      vorigeDatasetVersieBewaren: true,
      zoekindexOpnieuwOpbouwen: true,
      ruimtelijkeKoppelingOpnieuwOpbouwen: true,
      crmSchrijfactiesToegestaan: false,
    },
    gestartOp: '2026-08-02T21:30:00+02:00',
    afgerondOp: null,
    foutmelding: null,
  };
}

describe('BAG import-runcontract', () => {
  it('staat alleen expliciete statusovergangen toe', () => {
    expect(magStatusOvergang('aangemaakt', 'bron_geverifieerd')).toBe(true);
    expect(magStatusOvergang('aangemaakt', 'gepubliceerd')).toBe(false);
    expect(magStatusOvergang('gepubliceerd', 'teruggedraaid')).toBe(true);
  });

  it('hervat vanaf de eerste onvoltooide fase', () => {
    const run = geldigeRun();
    run.checkpoints = run.checkpoints.filter(item => item.fase !== 'staging_load');

    expect(volgendeHervatbareFase(run)).toBe('staging_load');
  });

  it('geeft null terug als alle fasen voltooid zijn', () => {
    const run = geldigeRun();
    run.checkpoints.push(
      ...['publicatie', 'zoekindex', 'ruimtelijke_koppeling'].map(fase => ({
        fase: fase as BagImportRun['checkpoints'][number]['fase'],
        cursor: null,
        verwerkteRecords: 1,
        geweigerdeRecords: 0,
        voltooid: true,
        bijgewerktOp: '2026-08-02T21:30:00+02:00',
      })),
    );

    expect(volgendeHervatbareFase(run)).toBeNull();
  });

  it('accepteert alleen een volledig gevalideerde publicatie', () => {
    const besluit = valideerPublicatie(geldigeRun());

    expect(besluit.toegestaan).toBe(true);
    expect(besluit.fouten).toEqual([]);
  });

  it('blokkeert publicatie bij stille uitval of ontbrekende rollbackversie', () => {
    const run = geldigeRun();
    run.validatie!.stilleUitval = 2;
    run.publicatiePlan!.vorigeDatasetVersieBewaren = false;

    const besluit = valideerPublicatie(run);

    expect(besluit.toegestaan).toBe(false);
    expect(besluit.fouten).toEqual(expect.arrayContaining([
      'Stille uitval is niet toegestaan.',
      'De vorige datasetversie moet voor rollback bewaard blijven.',
    ]));
  });

  it('vereist een verklaring voor iedere afgewezen bronregel', () => {
    const run = geldigeRun();
    run.validatie!.afwijzingen = [{
      objectType: 'pand',
      bronIdentificatie: 'pand-1',
      redenCode: 'ongeldige_geometrie',
      toelichting: '   ',
    }];

    const besluit = valideerPublicatie(run);

    expect(besluit.toegestaan).toBe(false);
    expect(besluit.fouten).toContain('Iedere afgewezen bronregel moet een toelichting hebben.');
  });

  it('staat rollback alleen toe vanaf een gepubliceerde versie met voorganger', () => {
    const run = geldigeRun();
    run.status = 'gepubliceerd';

    expect(valideerRollback(run).toegestaan).toBe(true);

    run.publicatiePlan!.huidigeActieveDatasetVersie = null;
    const geblokkeerd = valideerRollback(run);
    expect(geblokkeerd.toegestaan).toBe(false);
    expect(geblokkeerd.fouten).toContain('Er is geen vorige actieve datasetversie beschikbaar voor rollback.');
  });
});
