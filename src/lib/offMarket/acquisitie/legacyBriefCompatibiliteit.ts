import type {
  BriefContract,
  BriefversieContract,
  GeadresseerdeSnapshot,
  InhoudSnapshot,
} from './productiekernContract';
import { bepaalLegacyProductiestatus } from './legacyProductiestatusPariteit';

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

function legacyBriefstatus(
  rij: LegacyOffMarketBriefRij,
  postBevestigd: boolean,
): BriefContract['status'] {
  if (rij.archived_at) return 'geannuleerd';
  return postBevestigd ? 'definitief' : 'concept';
}

function legacyVersiestatus(postBevestigd: boolean): BriefversieContract['status'] {
  return postBevestigd ? 'verzonden' : 'actief';
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
 * Alleen een afzonderlijke postdatum geldt als hard bewijs van verzending.
 */
export function mapLegacyBriefNaarProductiekern(
  rij: LegacyOffMarketBriefRij,
  adres: LegacyAdresdelen,
): LegacyBriefCompatibiliteitsresultaat {
  const waarschuwingen: string[] = [];
  const productiestatus = bepaalLegacyProductiestatus(rij);
  const verzondenOp = productiestatus.postBevestigd
    ? productiestatus.verzendbewijsOp
    : null;

  if (!rij.brieftekst?.trim()) waarschuwingen.push('Legacy brieftekst ontbreekt.');
  if (!adres.straatHuisnummer.trim() || !adres.postcode.trim() || !adres.plaats.trim()) {
    waarschuwingen.push('Legacy verzendadres is niet volledig gestructureerd.');
  }
  waarschuwingen.push(...productiestatus.waarschuwingen);

  const status = legacyBriefstatus(rij, productiestatus.postBevestigd);

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
      definitiefOp: status === 'definitief' ? verzondenOp : null,
      vergrendeldOp: status === 'definitief' ? verzondenOp : null,
      annuleringsreden: status === 'geannuleerd'
        ? (rij.archived_reason?.trim() || 'Legacy brief gearchiveerd')
        : null,
    },
    versie: {
      id: `legacy:${rij.id}:v1`,
      briefId: rij.id,
      versienummer: 1,
      status: legacyVersiestatus(productiestatus.postBevestigd),
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
