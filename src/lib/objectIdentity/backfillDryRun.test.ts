import { describe, expect, it } from 'vitest';
import {
  normaliseerAdresSleutel,
  voerObjectBackfillDryRunUit,
  type BestaandeObjectregistratie,
  type ObjectBackfillBronrecord,
} from './backfillDryRun';

const registraties: BestaandeObjectregistratie[] = [
  {
    id: 'obj-vbo',
    adresSleutel: normaliseerAdresSleutel('Ceresplein 23', '9401CW', 'Assen'),
    bagPandId: '0106100000000001',
    bagVerblijfsobjectId: '0106010000000001',
    status: 'actief',
  },
  {
    id: 'obj-adres-a',
    adresSleutel: normaliseerAdresSleutel('Markt 1', '1012JS', 'Amsterdam'),
    status: 'actief',
  },
  {
    id: 'obj-adres-b',
    adresSleutel: normaliseerAdresSleutel('Markt 1', '1012JS', 'Amsterdam'),
    status: 'actief',
  },
];

describe('centrale Object-ID backfill dry-run', () => {
  it('geeft BAG-verblijfsobject-ID voorrang boven pand en adres', () => {
    const bronrecords: ObjectBackfillBronrecord[] = [
      {
        bronType: 'vastgoedkans',
        bronId: 'kans-1',
        adres: 'Ander label 99',
        postcode: '0000AA',
        plaats: 'Test',
        bagPandId: '0106100000000001',
        bagVerblijfsobjectId: '0106010000000001',
      },
    ];

    const resultaat = voerObjectBackfillDryRunUit(bronrecords, registraties);
    expect(resultaat.besluiten).toEqual([
      {
        status: 'koppelen',
        bronType: 'vastgoedkans',
        bronId: 'kans-1',
        objectregistratieId: 'obj-vbo',
        koppelwijze: 'bag_verblijfsobject',
      },
    ]);
  });

  it('blokkeert tegenstrijdige BAG-identificaties', () => {
    const resultaat = voerObjectBackfillDryRunUit(
      [
        {
          bronType: 'object',
          bronId: 'object-1',
          adres: 'Ceresplein 23',
          bagPandId: '9999100000000001',
          bagVerblijfsobjectId: '0106010000000001',
        },
      ],
      registraties,
    );

    expect(resultaat.besluiten[0]).toMatchObject({
      status: 'handmatige_beoordeling',
      reden: 'tegenstrijdige_bag_ids',
    });
  });

  it('maakt bij meerdere adresmatches nooit automatisch een koppeling', () => {
    const resultaat = voerObjectBackfillDryRunUit(
      [
        {
          bronType: 'off_market_signaal',
          bronId: 'signaal-1',
          adres: 'Markt 1',
          postcode: '1012 JS',
          plaats: 'Amsterdam',
        },
      ],
      registraties,
    );

    expect(resultaat.besluiten[0]).toEqual({
      status: 'handmatige_beoordeling',
      bronType: 'off_market_signaal',
      bronId: 'signaal-1',
      reden: 'meerdere_adres_matches',
      kandidaatObjectregistratieIds: ['obj-adres-a', 'obj-adres-b'],
    });
  });

  it('stelt een nieuw object voor zonder iets naar de database te schrijven', () => {
    const resultaat = voerObjectBackfillDryRunUit(
      [
        {
          bronType: 'deal',
          bronId: 'deal-1',
          adres: 'Kalverstraat 10',
          postcode: '1012NX',
          plaats: 'Amsterdam',
          bagPandId: '0363100000000010',
        },
      ],
      registraties,
    );

    expect(resultaat.tellingen).toEqual({
      totaal: 1,
      koppelen: 0,
      nieuwObjectVoorstellen: 1,
      handmatigeBeoordeling: 0,
    });
    expect(resultaat.databaseWriteUitgevoerd).toBe(false);
    expect(resultaat.automatischeSamenvoegingUitgevoerd).toBe(false);
  });
});
