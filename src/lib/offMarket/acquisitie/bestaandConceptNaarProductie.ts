import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type {
  BriefContract,
  BriefversieContract,
  GeadresseerdeSnapshot,
  InhoudSnapshot,
} from './productiekernContract';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import type { BestaandConceptBridgeRepository } from './bestaandConceptBridgeSupabaseRepository';
import type {
  AcquisitieProductieTransactieRepository,
  BriefDefinitiefResultaat,
} from './productieTransactieRepository';

export interface BestaandConceptProductieInput {
  selectieId: string;
  signaalId: string;
  brief: OffMarketBrief;
  actorId: string;
  uitgevoerdOp?: string;
}

export interface BestaandConceptProductieResultaat extends BriefDefinitiefResultaat {
  briefVersieId: string;
  versienummer: number;
}

function vereist(waarde: string | null | undefined, melding: string): string {
  const v = waarde?.trim();
  if (!v) throw new Error(melding);
  return v;
}

/**
 * Zet het legacy multiline verzendadres om naar het formele snapshotcontract.
 * Fail-closed: alleen `straat/huisnummer` + een expliciete NL-postcode/plaats
 * worden geaccepteerd; onvolledige of exotische vormen worden niet geraden.
 */
export function parseProductiekernVerzendadres(verzendadres: string | null | undefined): {
  straatHuisnummer: string;
  postcode: string;
  plaats: string;
  land: string;
} {
  const regels = String(verzendadres ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((regel) => regel.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (regels.length < 2) {
    throw new Error('Volledig verzendadres is verplicht voordat de brief definitief kan worden gemaakt.');
  }

  const postcodeIndex = regels.findIndex((regel) => /^\d{4}\s?[A-Za-z]{2}\s+.+$/.test(regel));
  if (postcodeIndex < 1) {
    throw new Error('Verzendadres mist een herkenbare postcode en plaats.');
  }

  const match = regels[postcodeIndex].match(/^(\d{4})\s?([A-Za-z]{2})\s+(.+)$/);
  if (!match) throw new Error('Verzendadres mist een herkenbare postcode en plaats.');

  const straatHuisnummer = regels.slice(0, postcodeIndex).join(', ').trim();
  if (!/\d/.test(straatHuisnummer)) {
    throw new Error('Verzendadres mist straat en huisnummer.');
  }

  const explicietLand = regels.slice(postcodeIndex + 1).join(' ').trim();
  const land = explicietLand || 'Nederland';

  return {
    straatHuisnummer,
    postcode: `${match[1]} ${match[2].toUpperCase()}`,
    plaats: match[3].trim(),
    land,
  };
}

export function bouwProductiekernSnapshotsUitLegacyBrief(brief: OffMarketBrief): {
  inhoud: InhoudSnapshot;
  geadresseerde: GeadresseerdeSnapshot;
} {
  if ((brief.kanaal ?? 'post') !== 'post') {
    throw new Error('Alleen fysieke postbrieven kunnen naar de printproductiekern.');
  }
  if (brief.status !== 'concept') {
    throw new Error('Alleen een conceptbrief kan definitief worden gemaakt.');
  }
  if (!brief.eigenaar_naam?.trim() && !brief.eigenaar_bedrijfsnaam?.trim()) {
    throw new Error('Geadresseerde naam of bedrijfsnaam is verplicht.');
  }

  const adres = parseProductiekernVerzendadres(brief.verzendadres);
  const brieftekst = vereist(brief.brieftekst, 'Brieftekst is verplicht.');

  return {
    inhoud: {
      onderwerp: brief.onderwerp?.trim() || null,
      brieftekst,
      objectadres: brief.objectadres?.trim() || null,
      objectomschrijving: brief.objectomschrijving?.trim() || null,
      templateId: null,
      templateVersie: null,
    },
    geadresseerde: {
      naam: brief.eigenaar_naam?.trim() || null,
      bedrijfsnaam: brief.eigenaar_bedrijfsnaam?.trim() || null,
      aanhef: brief.aanhef?.trim() || null,
      straatHuisnummer: adres.straatHuisnummer,
      postcode: adres.postcode,
      plaats: adres.plaats,
      land: adres.land,
      bron: 'legacy_concept',
      verificatiestatus: 'onbekend',
      relatieId: null,
    },
  };
}

function vindActieveVersie(
  versies: BriefversieContract[],
  verwachtId: string,
  verwachtNummer: number,
): BriefversieContract {
  const versie = versies.find((v) =>
    v.id === verwachtId
    && v.versienummer === verwachtNummer
    && v.status === 'actief',
  );
  if (!versie) {
    throw new Error('De zojuist gekoppelde actieve briefversie kon niet veilig worden teruggelezen.');
  }
  return versie;
}

function bewaakFormeleBrief(
  brief: BriefContract | null,
  input: BestaandConceptProductieInput,
): BriefContract {
  if (!brief) throw new Error('De formele Productiekern-brief kon niet worden teruggelezen.');
  if (brief.id !== input.brief.id || brief.signaalId !== input.signaalId) {
    throw new Error('Productiekern-brief wijkt af van het gevraagde dossier.');
  }
  if (brief.selectieId !== input.selectieId) {
    throw new Error('Productiekern-brief is aan een andere acquisitieselectie gekoppeld.');
  }
  if (brief.status !== 'concept' || brief.briefnummer) {
    throw new Error('De brief is niet langer een nummerloos formeel concept.');
  }
  return brief;
}

/**
 * Expliciete, fail-closed overgang:
 * legacy concept -> eerste immutable Productiekern-versie -> definitief BR-nummer.
 *
 * De bridge en definitief-transactie hebben elk een deterministische operation
 * key. Daardoor is een veilige retry idempotent, terwijl drift naar een andere
 * selectie/versie door de databasegrenzen wordt geweigerd.
 */
export async function maakBestaandConceptDefinitief(input: BestaandConceptProductieInput, deps: {
  bridge: BestaandConceptBridgeRepository;
  lezen: Pick<AcquisitieProductiekernRepository, 'haalBrief' | 'haalBriefversies'>;
  transacties: AcquisitieProductieTransactieRepository;
}): Promise<BestaandConceptProductieResultaat> {
  const snapshots = bouwProductiekernSnapshotsUitLegacyBrief(input.brief);
  const uitgevoerdOp = input.uitgevoerdOp ?? new Date().toISOString();

  const gekoppeld = await deps.bridge.koppelBestaandConcept({
    selectieId: input.selectieId,
    signaalId: input.signaalId,
    briefId: input.brief.id,
    actorId: input.actorId,
    operationKey: `legacy-bridge:${input.brief.id}`,
    inhoudSnapshot: snapshots.inhoud,
    geadresseerdeSnapshot: snapshots.geadresseerde,
  });

  const [formeleBriefRuw, versies] = await Promise.all([
    deps.lezen.haalBrief(input.brief.id),
    deps.lezen.haalBriefversies(input.brief.id),
  ]);
  const formeleBrief = bewaakFormeleBrief(formeleBriefRuw, input);
  const actieveVersie = vindActieveVersie(
    versies,
    gekoppeld.briefVersieId,
    gekoppeld.versienummer,
  );

  const definitief = await deps.transacties.maakBriefDefinitief({
    actie: 'brief_definitief_maken',
    brief: formeleBrief,
    actieveVersie,
    actorId: input.actorId,
    operationKey: `brief-definitief:${input.brief.id}:v${actieveVersie.versienummer}`,
    verwachtVersienummer: actieveVersie.versienummer,
    uitgevoerdOp,
    jaar: new Date(uitgevoerdOp).getUTCFullYear(),
  });

  return {
    ...definitief,
    briefVersieId: actieveVersie.id,
    versienummer: actieveVersie.versienummer,
  };
}
