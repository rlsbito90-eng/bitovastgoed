export type ProductieNummerType = 'brief' | 'batch';

const ALFANUMERIEK = /[^A-Z0-9]/g;
const BRIEF_PATTERN = /^BR(\d{4})(\d{6})$/;
const BATCH_PATTERN = /^BAT(\d{4})(\d{2})(\d{2})(\d{2})$/;

export interface BriefnummerDelen {
  type: 'brief';
  jaar: number;
  volgnummer: number;
  nummer: string;
}

export interface BatchnummerDelen {
  type: 'batch';
  jaar: number;
  maand: number;
  dag: number;
  dagvolgnummer: number;
  nummer: string;
}

export type ProductieNummerDelen = BriefnummerDelen | BatchnummerDelen;

/**
 * Normaliseert invoer voor zoeken en vergelijken. De gebruiker mag een nummer
 * met spaties of leestekens plakken; de canonieke waarde blijft uitsluitend
 * uit hoofdletters en cijfers bestaan.
 */
export function normaliseerProductieZoekterm(waarde: string): string {
  return waarde.trim().toUpperCase().replace(ALFANUMERIEK, '');
}

export function maakBriefnummer(jaar: number, volgnummer: number): string {
  valideerJaar(jaar);
  if (!Number.isInteger(volgnummer) || volgnummer < 1 || volgnummer > 999999) {
    throw new Error('Briefvolgnummer moet een geheel getal tussen 1 en 999999 zijn.');
  }
  return `BR${jaar}${String(volgnummer).padStart(6, '0')}`;
}

export function maakBatchnummer(
  datum: Pick<Date, 'getFullYear' | 'getMonth' | 'getDate'>,
  dagvolgnummer: number,
): string {
  const jaar = datum.getFullYear();
  const maand = datum.getMonth() + 1;
  const dag = datum.getDate();
  valideerJaar(jaar);
  if (!Number.isInteger(dagvolgnummer) || dagvolgnummer < 1 || dagvolgnummer > 99) {
    throw new Error('Batchvolgnummer moet een geheel getal tussen 1 en 99 zijn.');
  }
  return `BAT${jaar}${String(maand).padStart(2, '0')}${String(dag).padStart(2, '0')}${String(dagvolgnummer).padStart(2, '0')}`;
}

export function parseProductieNummer(waarde: string): ProductieNummerDelen | null {
  const nummer = normaliseerProductieZoekterm(waarde);
  const brief = nummer.match(BRIEF_PATTERN);
  if (brief) {
    return {
      type: 'brief',
      jaar: Number(brief[1]),
      volgnummer: Number(brief[2]),
      nummer,
    };
  }

  const batch = nummer.match(BATCH_PATTERN);
  if (!batch) return null;
  const jaar = Number(batch[1]);
  const maand = Number(batch[2]);
  const dag = Number(batch[3]);
  const dagvolgnummer = Number(batch[4]);
  if (!geldigeDatum(jaar, maand, dag) || dagvolgnummer < 1) return null;
  return { type: 'batch', jaar, maand, dag, dagvolgnummer, nummer };
}

/** Compacte weergave in de CRM, bijvoorbeeld BR2026000482 · v2. */
export function formatteerBriefversie(briefnummer: string, versie: number): string {
  const parsed = parseProductieNummer(briefnummer);
  if (!parsed || parsed.type !== 'brief') throw new Error('Ongeldig briefnummer.');
  if (!Number.isInteger(versie) || versie < 1) throw new Error('Briefversie moet minimaal 1 zijn.');
  return `${parsed.nummer} · v${versie}`;
}

/** Bestandsveilige suffix voor batchdocumenten, bijvoorbeeld BAT2026080601_v2. */
export function formatteerBatchdocumentVersie(batchnummer: string, versie: number): string {
  const parsed = parseProductieNummer(batchnummer);
  if (!parsed || parsed.type !== 'batch') throw new Error('Ongeldig batchnummer.');
  if (!Number.isInteger(versie) || versie < 1) throw new Error('Documentversie moet minimaal 1 zijn.');
  return `${parsed.nummer}_v${versie}`;
}

/**
 * Zoekmatch voor volledig of gedeeltelijk brief- en batchnummer. Zowel de
 * zoekterm als de opgeslagen waarde worden zonder streepjes/spaties vergeleken.
 */
export function matchtProductieNummer(opgeslagenNummer: string | null | undefined, zoekterm: string): boolean {
  const q = normaliseerProductieZoekterm(zoekterm);
  if (!q) return true;
  if (!opgeslagenNummer) return false;
  return normaliseerProductieZoekterm(opgeslagenNummer).includes(q);
}

function valideerJaar(jaar: number): void {
  if (!Number.isInteger(jaar) || jaar < 2000 || jaar > 9999) {
    throw new Error('Jaar moet een viercijferig getal vanaf 2000 zijn.');
  }
}

function geldigeDatum(jaar: number, maand: number, dag: number): boolean {
  const datum = new Date(Date.UTC(jaar, maand - 1, dag));
  return datum.getUTCFullYear() === jaar
    && datum.getUTCMonth() === maand - 1
    && datum.getUTCDate() === dag;
}
