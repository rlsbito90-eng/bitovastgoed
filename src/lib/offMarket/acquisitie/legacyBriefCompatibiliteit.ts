import type {
  BriefContract,
  BriefversieContract,
  GeadresseerdeSnapshot,
  InhoudSnapshot,
} from './productiekernContract';

export interface LegacyOffMarketBriefRij {
  id: string;
  signaal_id: string;
  eigenaar_naam: string | null;
  eigenaar_bedrijfsnaam: string | null;
  verzendadres: string | null;
  objectadres: string | null;
  aanhef: string | null;
  onderwerp: string | null;
  brieftekst: string | null;
  status: string | null;
  verzonden_op: string | null;
  created_at: string;
  objectomschrijving: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  geadresseerde_key: string | null;
  printdatum: string | null;
  postdatum: string | null;
  verzendstatus: string | null;
}

export interface LegacyAdresdelen {
  straatHuisnummer: string;
  postcode: string;
  plaats: string;
  land: string;
}

export interface LegacyBriefCompatibiliteitsresultaat {
  brief: BriefContract;
  versie: BriefversieContract;
  legacy: {
    geadresseerdeKey: string | null;
    printdatum: string | null;
    postdatum: string | null;
    verzendstatus: string | null;
  };
  waarschuwingen: string[];
}

function legacyBriefstatus(rij: LegacyOffMarketBriefRij): BriefContract['status'] {
  if (rij.archived_at) return 'geannuleerd';
  if (rij.status === 'verstuurd' || rij.verzonden_op || rij.postdatum) return 'definitief';
  return 'concept';
}

function legacyVersiestatus(rij: LegacyOffMarketBriefRij): BriefversieContract['status'] {
  return rij.status === 'verstuurd' || rij.verzonden_op || rij.postdatum
    ? 'verzonden'
    : 'actief';
}

function bouwGeadresseerdeSnapshot(
  rij: LegacyOffMarketBriefRij,
  adres: LegacyAdresdelen,
): GeadresseerdeSnapshot {
  return {
    naam: rij.eigenaar_naam,
    bedrijfsnaam: rij.eigenaar_bedrijfsnaam,
    aanhef: rij.aanhef,
    straatHuisnummer: adres.straatHuisnummer,
    postcode: adres.postcode,
    plaats: adres.plaats,
    land: adres.land,
    bron: 'legacy_off_market_brieven',
    verificatiestatus: 'onbekend',
    relatieId: null,
  };
}

function bouwInhoudSnapshot(rij: LegacyOffMarketBriefRij): InhoudSnapshot {
  return {
    onderwerp: rij.onderwerp,
    brieftekst: rij.brieftekst ?? '',
    objectadres: rij.objectadres,
    objectomschrijving: rij.objectomschrijving,
    templateId: null,
    templateVersie: null,
  };
}

/**
 * Maakt een read-only compatibiliteitsweergave van een bestaand briefrecord.
 *
 * Deze adapter reserveert geen BR-nummer, schrijft niets terug en beweert niet
 * dat legacy-inhoud al als onveranderlijke productieversie is opgeslagen.
 */
export function mapLegacyBriefNaarProductiekern(
  rij: LegacyOffMarketBriefRij,
  adres: LegacyAdresdelen,
): LegacyBriefCompatibiliteitsresultaat {
  const waarschuwingen: string[] = [];
  const verzondenOp = rij.postdatum ?? rij.verzonden_op;

  if (!rij.brieftekst?.trim()) waarschuwingen.push('Legacy brieftekst ontbreekt.');
  if (!adres.straatHuisnummer.trim() || !adres.postcode.trim() || !adres.plaats.trim()) {
    waarschuwingen.push('Legacy verzendadres is niet volledig gestructureerd.');
  }
  if (rij.printdatum && !rij.postdatum && rij.status === 'verstuurd') {
    waarschuwingen.push('Legacy record meldt verstuurd zonder afzonderlijke postdatum.');
  }

  const status = legacyBriefstatus(rij);

  return {
    brief: {
      id: rij.id,
      briefnummer: null,
      signaalId: rij.signaal_id,
      selectieId: null,
      objectId: null,
      relatieId: null,
      actieveVersie: 1,
      status,
      vervangingVanBriefId: null,
      definitiefOp: status === 'definitief' ? (verzondenOp ?? rij.created_at) : null,
      vergrendeldOp: status === 'definitief' ? (verzondenOp ?? rij.created_at) : null,
      annuleringsreden: status === 'geannuleerd'
        ? (rij.archived_reason?.trim() || 'Legacy brief gearchiveerd')
        : null,
    },
    versie: {
      id: `legacy:${rij.id}:v1`,
      briefId: rij.id,
      versienummer: 1,
      status: legacyVersiestatus(rij),
      inhoud: bouwInhoudSnapshot(rij),
      geadresseerde: bouwGeadresseerdeSnapshot(rij, adres),
      bestandReferentie: null,
      createdAt: rij.created_at,
      vervallenOp: null,
      verzondenOp,
    },
    legacy: {
      geadresseerdeKey: rij.geadresseerde_key,
      printdatum: rij.printdatum,
      postdatum: rij.postdatum,
      verzendstatus: rij.verzendstatus,
    },
    waarschuwingen,
  };
}
