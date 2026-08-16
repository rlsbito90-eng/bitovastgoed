import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type {
  BriefContract,
  BriefversieContract,
  GeadresseerdeSnapshot,
  InhoudSnapshot,
} from './productiekernContract';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import type { BestaandConceptBridgeRepository } from './bestaandConceptBridgeSupabaseRepository';
import type { VroegeProductieWriteRepository } from './vroegeProductieSupabaseRepository';
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

function normaliseerSnapshotWaarde(waarde: unknown): unknown {
  if (Array.isArray(waarde)) return waarde.map(normaliseerSnapshotWaarde);
  if (waarde && typeof waarde === 'object') {
    return Object.fromEntries(
      Object.entries(waarde as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normaliseerSnapshotWaarde(v)]),
    );
  }
  return waarde;
}

function snapshotsGelijk(a: unknown, b: unknown): boolean {
  return JSON.stringify(normaliseerSnapshotWaarde(a)) === JSON.stringify(normaliseerSnapshotWaarde(b));
}

function actieveVersie(versies: BriefversieContract[]): BriefversieContract | null {
  const actief = versies.filter((versie) => versie.status === 'actief');
  if (actief.length > 1) {
    throw new Error('Productiekern bevat meer dan één actieve briefversie; definitief maken is geblokkeerd.');
  }
  return actief[0] ?? null;
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

async function zorgVoorActueleFormeleVersie(input: BestaandConceptProductieInput, deps: {
  bridge: BestaandConceptBridgeRepository;
  vroeg: VroegeProductieWriteRepository;
  lezen: Pick<AcquisitieProductiekernRepository, 'haalBrief' | 'haalBriefversies'>;
}, snapshots: { inhoud: InhoudSnapshot; geadresseerde: GeadresseerdeSnapshot }): Promise<{
  brief: BriefContract;
  versie: BriefversieContract;
}> {
  const bestaandFormeel = await deps.lezen.haalBrief(input.brief.id);

  // Eerste overgang vanuit het bestaande CRM-concept: transactionele bridge.
  if (!bestaandFormeel) {
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
    return {
      brief: bewaakFormeleBrief(formeleBriefRuw, input),
      versie: vindActieveVersie(versies, gekoppeld.briefVersieId, gekoppeld.versienummer),
    };
  }

  const formeleBrief = bewaakFormeleBrief(bestaandFormeel, input);
  const versies = await deps.lezen.haalBriefversies(input.brief.id);
  const huidig = actieveVersie(versies);
  if (!huidig) {
    throw new Error('Formele conceptbrief mist een actieve briefversie.');
  }
  if (formeleBrief.actieveVersie !== huidig.versienummer) {
    throw new Error('Actieve versie op de brief wijkt af van de actieve immutable versie.');
  }

  if (
    snapshotsGelijk(huidig.inhoud, snapshots.inhoud)
    && snapshotsGelijk(huidig.geadresseerde, snapshots.geadresseerde)
  ) {
    return { brief: formeleBrief, versie: huidig };
  }

  // Het legacy concept is sinds de vorige formele snapshot gewijzigd. Maak
  // atomair een nieuwe immutable versie via de bestaande Productiekern-RPC;
  // deze zet de vorige actieve versie in dezelfde transactie op `vervallen`.
  const vernieuwd = await deps.vroeg.maakBriefversie({
    briefId: input.brief.id,
    actorId: input.actorId,
    operationKey: `briefversie:${input.brief.id}:na-v${huidig.versienummer}`,
    inhoudSnapshot: snapshots.inhoud,
    geadresseerdeSnapshot: snapshots.geadresseerde,
  });

  if (vernieuwd.versienummer !== huidig.versienummer + 1) {
    throw new Error('Nieuwe briefversie sloot niet aan op de verwachte versiereeks.');
  }
  return { brief: { ...formeleBrief, actieveVersie: vernieuwd.versienummer }, versie: vernieuwd };
}

/**
 * Expliciete, fail-closed overgang:
 * legacy concept -> immutable Productiekern-versie -> definitief BR-nummer.
 *
 * Bij een reeds formeel concept wordt de huidige immutable snapshot hergebruikt
 * als de inhoud gelijk is. Is het opgeslagen CRM-concept gewijzigd, dan maakt
 * de bestaande Productiekern-RPC eerst atomair een volgende versie en laat de
 * vorige versie vervallen. Definitieve/vergrendelde brieven worden nooit
 * gewijzigd of opnieuw genummerd.
 */
export async function maakBestaandConceptDefinitief(input: BestaandConceptProductieInput, deps: {
  bridge: BestaandConceptBridgeRepository;
  vroeg: VroegeProductieWriteRepository;
  lezen: Pick<AcquisitieProductiekernRepository, 'haalBrief' | 'haalBriefversies'>;
  transacties: AcquisitieProductieTransactieRepository;
}): Promise<BestaandConceptProductieResultaat> {
  const snapshots = bouwProductiekernSnapshotsUitLegacyBrief(input.brief);
  const uitgevoerdOp = input.uitgevoerdOp ?? new Date().toISOString();
  const actueel = await zorgVoorActueleFormeleVersie(input, deps, snapshots);

  const definitief = await deps.transacties.maakBriefDefinitief({
    actie: 'brief_definitief_maken',
    brief: actueel.brief,
    actieveVersie: actueel.versie,
    actorId: input.actorId,
    operationKey: `brief-definitief:${input.brief.id}:v${actueel.versie.versienummer}`,
    verwachtVersienummer: actueel.versie.versienummer,
    uitgevoerdOp,
    jaar: new Date(uitgevoerdOp).getUTCFullYear(),
  });

  return {
    ...definitief,
    briefVersieId: actueel.versie.id,
    versienummer: actueel.versie.versienummer,
  };
}
