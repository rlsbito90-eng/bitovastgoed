export type ObjectBronType =
  | 'vastgoedkans'
  | 'object'
  | 'off_market_signaal'
  | 'deal'
  | 'acquisitie_target';

export interface ObjectBackfillBronrecord {
  bronType: ObjectBronType;
  bronId: string;
  adres: string;
  postcode?: string | null;
  plaats?: string | null;
  bagPandId?: string | null;
  bagVerblijfsobjectId?: string | null;
}

export interface BestaandeObjectregistratie {
  id: string;
  adresSleutel: string;
  bagPandId?: string | null;
  bagVerblijfsobjectId?: string | null;
  status: 'actief' | 'samengevoegd' | 'vervallen';
}

export type ObjectBackfillBesluit =
  | {
      status: 'koppelen';
      bronType: ObjectBronType;
      bronId: string;
      objectregistratieId: string;
      koppelwijze: 'bag_verblijfsobject' | 'bag_pand' | 'adres';
    }
  | {
      status: 'nieuw_object_voorstellen';
      bronType: ObjectBronType;
      bronId: string;
      adresSleutel: string;
      bagPandId: string | null;
      bagVerblijfsobjectId: string | null;
    }
  | {
      status: 'handmatige_beoordeling';
      bronType: ObjectBronType;
      bronId: string;
      reden:
        | 'meerdere_bag_verblijfsobject_matches'
        | 'meerdere_bag_pand_matches'
        | 'meerdere_adres_matches'
        | 'tegenstrijdige_bag_ids'
        | 'onvoldoende_adresgegevens';
      kandidaatObjectregistratieIds: string[];
    };

export interface ObjectBackfillDryRunResultaat {
  besluiten: ObjectBackfillBesluit[];
  tellingen: {
    totaal: number;
    koppelen: number;
    nieuwObjectVoorstellen: number;
    handmatigeBeoordeling: number;
  };
  databaseWriteUitgevoerd: false;
  automatischeSamenvoegingUitgevoerd: false;
}

const normaliseerAdresdeel = (waarde?: string | null): string =>
  (waarde ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normaliseerPostcode = (waarde?: string | null): string =>
  (waarde ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export function normaliseerAdresSleutel(
  adres: string,
  postcode?: string | null,
  plaats?: string | null,
): string {
  return [
    normaliseerAdresdeel(adres),
    normaliseerPostcode(postcode),
    normaliseerAdresdeel(plaats),
  ].join('|');
}

function uniekeActieveMatches(
  registraties: BestaandeObjectregistratie[],
  predicate: (registratie: BestaandeObjectregistratie) => boolean,
): BestaandeObjectregistratie[] {
  const matches = registraties.filter(
    registratie => registratie.status === 'actief' && predicate(registratie),
  );
  return [...new Map(matches.map(match => [match.id, match])).values()];
}

export function voerObjectBackfillDryRunUit(
  bronrecords: ObjectBackfillBronrecord[],
  bestaandeRegistraties: BestaandeObjectregistratie[],
): ObjectBackfillDryRunResultaat {
  const besluiten: ObjectBackfillBesluit[] = bronrecords.map(record => {
    const adresSleutel = normaliseerAdresSleutel(record.adres, record.postcode, record.plaats);
    if (!adresSleutel || adresSleutel === '||') {
      return {
        status: 'handmatige_beoordeling',
        bronType: record.bronType,
        bronId: record.bronId,
        reden: 'onvoldoende_adresgegevens',
        kandidaatObjectregistratieIds: [],
      };
    }

    const vboMatches = record.bagVerblijfsobjectId
      ? uniekeActieveMatches(
          bestaandeRegistraties,
          registratie => registratie.bagVerblijfsobjectId === record.bagVerblijfsobjectId,
        )
      : [];
    if (vboMatches.length > 1) {
      return {
        status: 'handmatige_beoordeling',
        bronType: record.bronType,
        bronId: record.bronId,
        reden: 'meerdere_bag_verblijfsobject_matches',
        kandidaatObjectregistratieIds: vboMatches.map(match => match.id),
      };
    }
    if (vboMatches.length === 1) {
      const match = vboMatches[0];
      if (record.bagPandId && match.bagPandId && record.bagPandId !== match.bagPandId) {
        return {
          status: 'handmatige_beoordeling',
          bronType: record.bronType,
          bronId: record.bronId,
          reden: 'tegenstrijdige_bag_ids',
          kandidaatObjectregistratieIds: [match.id],
        };
      }
      return {
        status: 'koppelen',
        bronType: record.bronType,
        bronId: record.bronId,
        objectregistratieId: match.id,
        koppelwijze: 'bag_verblijfsobject',
      };
    }

    const pandMatches = record.bagPandId
      ? uniekeActieveMatches(
          bestaandeRegistraties,
          registratie => registratie.bagPandId === record.bagPandId,
        )
      : [];
    if (pandMatches.length > 1) {
      return {
        status: 'handmatige_beoordeling',
        bronType: record.bronType,
        bronId: record.bronId,
        reden: 'meerdere_bag_pand_matches',
        kandidaatObjectregistratieIds: pandMatches.map(match => match.id),
      };
    }
    if (pandMatches.length === 1) {
      return {
        status: 'koppelen',
        bronType: record.bronType,
        bronId: record.bronId,
        objectregistratieId: pandMatches[0].id,
        koppelwijze: 'bag_pand',
      };
    }

    const adresMatches = uniekeActieveMatches(
      bestaandeRegistraties,
      registratie => registratie.adresSleutel === adresSleutel,
    );
    if (adresMatches.length > 1) {
      return {
        status: 'handmatige_beoordeling',
        bronType: record.bronType,
        bronId: record.bronId,
        reden: 'meerdere_adres_matches',
        kandidaatObjectregistratieIds: adresMatches.map(match => match.id),
      };
    }
    if (adresMatches.length === 1) {
      return {
        status: 'koppelen',
        bronType: record.bronType,
        bronId: record.bronId,
        objectregistratieId: adresMatches[0].id,
        koppelwijze: 'adres',
      };
    }

    return {
      status: 'nieuw_object_voorstellen',
      bronType: record.bronType,
      bronId: record.bronId,
      adresSleutel,
      bagPandId: record.bagPandId ?? null,
      bagVerblijfsobjectId: record.bagVerblijfsobjectId ?? null,
    };
  });

  return {
    besluiten,
    tellingen: {
      totaal: besluiten.length,
      koppelen: besluiten.filter(besluit => besluit.status === 'koppelen').length,
      nieuwObjectVoorstellen: besluiten.filter(
        besluit => besluit.status === 'nieuw_object_voorstellen',
      ).length,
      handmatigeBeoordeling: besluiten.filter(
        besluit => besluit.status === 'handmatige_beoordeling',
      ).length,
    },
    databaseWriteUitgevoerd: false,
    automatischeSamenvoegingUitgevoerd: false,
  };
}
