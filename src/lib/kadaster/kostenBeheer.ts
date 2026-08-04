export type KadasterProductCode =
  | 'algemene_objectinformatie'
  | 'contractloos'
  | 'rechten'
  | 'koopsom'
  | 'omgeving'
  | 'woz';

export type KadasterKostenStatus =
  | 'geraamd'
  | 'bevestigd'
  | 'geleverd'
  | 'gedeeltelijk_geleverd'
  | 'niet_geleverd'
  | 'mislukt';

export interface KadasterProduct {
  code: KadasterProductCode;
  naam: string;
  tariefPerEenheid: number;
  valuta: 'EUR';
  betaald: boolean;
  actief: boolean;
  explicieteBevestigingVereist: boolean;
}

export interface KadasterBudgetbeleid {
  daglimietGebruiker: number | null;
  maandlimietGebruiker: number | null;
  maandbudgetBedrijf: number | null;
  extraBevestigingVanaf: number | null;
  hardeBlokkadeActief: boolean;
  beheerderMagOverschrijven: boolean;
  waarschuwingPercentages: number[];
}

export interface KadasterKostenEvent {
  id: string;
  productCode: KadasterProductCode;
  aantalEenheden: number;
  geraamdeKosten: number;
  werkelijkeKosten: number | null;
  status: KadasterKostenStatus;
  gebruikerId: string;
  crmObjectId?: string;
  vastgoedkansId?: string;
  campagneId?: string;
  adres?: string;
  bagPandId?: string;
  kadastraleAanduiding?: string;
  aangevraagdOp: string;
  geleverdOp?: string;
  requestId?: string;
  hergebruikteBestaandeData: boolean;
}

export interface KadasterBudgetContext {
  isBeheerder: boolean;
  gebruikerId: string;
  nu: Date;
  events: KadasterKostenEvent[];
  beleid: KadasterBudgetbeleid;
}

export interface KadasterBudgetBeoordeling {
  toegestaan: boolean;
  beheerderKanOverschrijven: boolean;
  extraBevestigingVereist: boolean;
  waarschuwingen: string[];
  blokkades: string[];
  geraamdeNieuweKosten: number;
  besteedVandaag: number;
  besteedDezeMaandGebruiker: number;
  besteedDezeMaandBedrijf: number;
}

export interface KadasterKostenSamenvatting {
  van: string;
  tot: string;
  aantalAanvragen: number;
  aantalEenheden: number;
  geraamdeKosten: number;
  werkelijkeKosten: number;
  perProduct: Array<{
    productCode: KadasterProductCode;
    aantalAanvragen: number;
    aantalEenheden: number;
    werkelijkeKosten: number;
  }>;
}

export const STANDAARD_KADASTER_PRODUCTEN: KadasterProduct[] = [
  { code: 'algemene_objectinformatie', naam: 'Algemene objectinformatie', tariefPerEenheid: 0, valuta: 'EUR', betaald: false, actief: true, explicieteBevestigingVereist: false },
  { code: 'contractloos', naam: 'Contractloos eigenaaronderzoek', tariefPerEenheid: 0, valuta: 'EUR', betaald: true, actief: false, explicieteBevestigingVereist: true },
  { code: 'rechten', naam: 'Rechteninformatie', tariefPerEenheid: 0, valuta: 'EUR', betaald: true, actief: false, explicieteBevestigingVereist: true },
  { code: 'koopsom', naam: 'Koopsom', tariefPerEenheid: 0, valuta: 'EUR', betaald: true, actief: false, explicieteBevestigingVereist: true },
  { code: 'omgeving', naam: 'Omgevingsinformatie', tariefPerEenheid: 0, valuta: 'EUR', betaald: true, actief: false, explicieteBevestigingVereist: true },
  { code: 'woz', naam: 'WOZ-informatie', tariefPerEenheid: 0, valuta: 'EUR', betaald: true, actief: false, explicieteBevestigingVereist: true },
];

export const STANDAARD_KADASTER_BUDGETBELEID: KadasterBudgetbeleid = {
  daglimietGebruiker: 50,
  maandlimietGebruiker: 250,
  maandbudgetBedrijf: 300,
  extraBevestigingVanaf: 10,
  hardeBlokkadeActief: false,
  beheerderMagOverschrijven: true,
  waarschuwingPercentages: [70, 85, 100],
};

const werkelijkOfGeraamd = (event: KadasterKostenEvent) =>
  event.werkelijkeKosten ?? event.geraamdeKosten;

const zelfdeDag = (waarde: string, datum: Date) => {
  const eventDatum = new Date(waarde);
  return eventDatum.getFullYear() === datum.getFullYear()
    && eventDatum.getMonth() === datum.getMonth()
    && eventDatum.getDate() === datum.getDate();
};

const zelfdeMaand = (waarde: string, datum: Date) => {
  const eventDatum = new Date(waarde);
  return eventDatum.getFullYear() === datum.getFullYear()
    && eventDatum.getMonth() === datum.getMonth();
};

export function berekenKadasterAanvraagKosten(product: KadasterProduct, aantalEenheden: number): number {
  if (!Number.isInteger(aantalEenheden) || aantalEenheden <= 0) {
    throw new Error('Aantal eenheden moet een positief geheel getal zijn.');
  }
  if (!Number.isFinite(product.tariefPerEenheid) || product.tariefPerEenheid < 0) {
    throw new Error('Kadastertarief moet een geldig niet-negatief bedrag zijn.');
  }
  return Math.round(product.tariefPerEenheid * aantalEenheden * 100) / 100;
}

export function beoordeelKadasterBudget(
  context: KadasterBudgetContext,
  nieuweKosten: number,
): KadasterBudgetBeoordeling {
  if (!Number.isFinite(nieuweKosten) || nieuweKosten < 0) {
    throw new Error('Nieuwe kosten moeten een geldig niet-negatief bedrag zijn.');
  }

  const relevanteEvents = context.events.filter(event =>
    !event.hergebruikteBestaandeData
    && !['niet_geleverd', 'mislukt'].includes(event.status));
  const gebruikerEvents = relevanteEvents.filter(event => event.gebruikerId === context.gebruikerId);

  const besteedVandaag = gebruikerEvents
    .filter(event => zelfdeDag(event.aangevraagdOp, context.nu))
    .reduce((som, event) => som + werkelijkOfGeraamd(event), 0);
  const besteedDezeMaandGebruiker = gebruikerEvents
    .filter(event => zelfdeMaand(event.aangevraagdOp, context.nu))
    .reduce((som, event) => som + werkelijkOfGeraamd(event), 0);
  const besteedDezeMaandBedrijf = relevanteEvents
    .filter(event => zelfdeMaand(event.aangevraagdOp, context.nu))
    .reduce((som, event) => som + werkelijkOfGeraamd(event), 0);

  const blokkades: string[] = [];
  const waarschuwingen: string[] = [];
  const beleid = context.beleid;

  const controleerLimiet = (label: string, besteed: number, limiet: number | null) => {
    if (limiet === null) return;
    const nieuwTotaal = besteed + nieuweKosten;
    if (nieuwTotaal > limiet) blokkades.push(`${label} wordt overschreden: € ${nieuwTotaal.toFixed(2)} van € ${limiet.toFixed(2)}.`);
    for (const percentage of [...beleid.waarschuwingPercentages].sort((a, b) => a - b)) {
      if (limiet > 0 && nieuwTotaal / limiet * 100 >= percentage) {
        waarschuwingen.push(`${label} bereikt minimaal ${percentage}% na deze aanvraag.`);
      }
    }
  };

  controleerLimiet('Daglimiet gebruiker', besteedVandaag, beleid.daglimietGebruiker);
  controleerLimiet('Maandlimiet gebruiker', besteedDezeMaandGebruiker, beleid.maandlimietGebruiker);
  controleerLimiet('Maandbudget bedrijf', besteedDezeMaandBedrijf, beleid.maandbudgetBedrijf);

  const beheerderKanOverschrijven = context.isBeheerder && beleid.beheerderMagOverschrijven;
  const hardeBlokkade = beleid.hardeBlokkadeActief && blokkades.length > 0;

  return {
    toegestaan: !hardeBlokkade || beheerderKanOverschrijven,
    beheerderKanOverschrijven,
    extraBevestigingVereist: beleid.extraBevestigingVanaf !== null
      && nieuweKosten >= beleid.extraBevestigingVanaf,
    waarschuwingen: [...new Set(waarschuwingen)],
    blokkades,
    geraamdeNieuweKosten: nieuweKosten,
    besteedVandaag: Math.round(besteedVandaag * 100) / 100,
    besteedDezeMaandGebruiker: Math.round(besteedDezeMaandGebruiker * 100) / 100,
    besteedDezeMaandBedrijf: Math.round(besteedDezeMaandBedrijf * 100) / 100,
  };
}

export function vatKadasterKostenSamen(
  events: KadasterKostenEvent[],
  van: Date,
  tot: Date,
): KadasterKostenSamenvatting {
  if (tot < van) throw new Error('Einddatum mag niet vóór begindatum liggen.');
  const binnenPeriode = events.filter(event => {
    const datum = new Date(event.aangevraagdOp);
    return datum >= van && datum <= tot;
  });
  const perProduct = new Map<KadasterProductCode, { aantalAanvragen: number; aantalEenheden: number; werkelijkeKosten: number }>();

  for (const event of binnenPeriode) {
    const bestaand = perProduct.get(event.productCode) ?? { aantalAanvragen: 0, aantalEenheden: 0, werkelijkeKosten: 0 };
    bestaand.aantalAanvragen += 1;
    bestaand.aantalEenheden += event.aantalEenheden;
    bestaand.werkelijkeKosten += event.werkelijkeKosten ?? 0;
    perProduct.set(event.productCode, bestaand);
  }

  return {
    van: van.toISOString(),
    tot: tot.toISOString(),
    aantalAanvragen: binnenPeriode.length,
    aantalEenheden: binnenPeriode.reduce((som, event) => som + event.aantalEenheden, 0),
    geraamdeKosten: Math.round(binnenPeriode.reduce((som, event) => som + event.geraamdeKosten, 0) * 100) / 100,
    werkelijkeKosten: Math.round(binnenPeriode.reduce((som, event) => som + (event.werkelijkeKosten ?? 0), 0) * 100) / 100,
    perProduct: [...perProduct.entries()].map(([productCode, waarden]) => ({
      productCode,
      aantalAanvragen: waarden.aantalAanvragen,
      aantalEenheden: waarden.aantalEenheden,
      werkelijkeKosten: Math.round(waarden.werkelijkeKosten * 100) / 100,
    })).sort((a, b) => a.productCode.localeCompare(b.productCode)),
  };
}
