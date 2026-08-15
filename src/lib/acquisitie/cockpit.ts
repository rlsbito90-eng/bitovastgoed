export interface CockpitActuals {
  jaar: number;
  kadasterAanvragen: number;
  kadasterKostenBesteBeschikbaar: number;
  verzondenCommunicaties: number;
  reacties: number;
  positieveReacties: number;
  retourpost: number;
  opvolgingAangemaakt: number;
  opvolgingAfgerond: number;
  responspercentage: number;
  positieveResponspercentage: number;
}

export interface CockpitDoel {
  acquisitie_brieven_doel?: number | null;
  acquisitie_responspercentage_doel?: number | null;
  acquisitie_positieve_responspercentage_doel?: number | null;
  acquisitie_kadaster_aanvragen_doel?: number | null;
  acquisitie_kadaster_budget_doel?: number | null;
}

export type CockpitSeverity = 'kritiek' | 'aandacht' | 'op_schema' | 'informatie';

export interface CockpitSignaal {
  id: string;
  severity: CockpitSeverity;
  titel: string;
  toelichting: string;
}

export interface CockpitSamenvatting {
  jaarVoortgang: number;
  doelDekking: number;
  openOpvolging: number;
  signalen: CockpitSignaal[];
  status: 'kritiek' | 'aandacht' | 'op_schema';
}

export function berekenJaarVoortgang(now: Date, jaar = now.getFullYear()): number {
  if (now.getFullYear() < jaar) return 0;
  if (now.getFullYear() > jaar) return 1;

  const start = new Date(jaar, 0, 1);
  const einde = new Date(jaar + 1, 0, 1);
  const totaal = einde.getTime() - start.getTime();
  const verstreken = now.getTime() - start.getTime();
  return Math.min(1, Math.max(0, verstreken / totaal));
}

const pct = (value: number) => `${Math.round(value * 10) / 10}%`;
const euro = (value: number) => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(value);

export function bouwCockpitSamenvatting(
  actuals: CockpitActuals,
  doel: CockpitDoel | null,
  now = new Date(),
): CockpitSamenvatting {
  const jaarVoortgang = berekenJaarVoortgang(now, actuals.jaar);
  const openOpvolging = Math.max(0, actuals.opvolgingAangemaakt - actuals.opvolgingAfgerond);
  const doelvelden = doel ? [
    doel.acquisitie_brieven_doel,
    doel.acquisitie_responspercentage_doel,
    doel.acquisitie_positieve_responspercentage_doel,
    doel.acquisitie_kadaster_aanvragen_doel,
    doel.acquisitie_kadaster_budget_doel,
  ] : [];
  const doelDekking = doelvelden.filter(v => v != null).length;
  const signalen: CockpitSignaal[] = [];

  const budget = Number(doel?.acquisitie_kadaster_budget_doel ?? 0);
  if (budget > 0) {
    const gebruik = actuals.kadasterKostenBesteBeschikbaar / budget;
    if (gebruik > 1) {
      signalen.push({
        id: 'kadaster-budget-overschreden',
        severity: 'kritiek',
        titel: 'Kadasterbudget overschreden',
        toelichting: `${euro(actuals.kadasterKostenBesteBeschikbaar)} gebruikt op ${euro(budget)} jaarbudget.`,
      });
    } else if (jaarVoortgang > 0 && gebruik > jaarVoortgang + 0.1) {
      signalen.push({
        id: 'kadaster-budget-tempo',
        severity: 'aandacht',
        titel: 'Kadasterkosten lopen voor op jaartempo',
        toelichting: `${pct(gebruik * 100)} van het budget gebruikt bij ${pct(jaarVoortgang * 100)} van het jaar.`,
      });
    }
  }

  const brievenDoel = Number(doel?.acquisitie_brieven_doel ?? 0);
  if (brievenDoel > 0 && jaarVoortgang > 0) {
    const verwacht = brievenDoel * jaarVoortgang;
    const tempo = verwacht > 0 ? actuals.verzondenCommunicaties / verwacht : 1;
    if (tempo < 0.85) {
      signalen.push({
        id: 'brieven-achterstand',
        severity: 'aandacht',
        titel: 'Verzendtempo ligt achter op jaardoel',
        toelichting: `${actuals.verzondenCommunicaties} verzonden; circa ${Math.round(verwacht)} verwacht op basis van het jaartempo.`,
      });
    }
  }

  const responsDoel = doel?.acquisitie_responspercentage_doel;
  if (responsDoel != null && actuals.verzondenCommunicaties > 0 && actuals.responspercentage < Number(responsDoel)) {
    signalen.push({
      id: 'respons-onder-doel',
      severity: 'aandacht',
      titel: 'Respons ligt onder doel',
      toelichting: `${pct(actuals.responspercentage)} gerealiseerd tegenover ${pct(Number(responsDoel))} doel.`,
    });
  }

  const positiefDoel = doel?.acquisitie_positieve_responspercentage_doel;
  if (positiefDoel != null && actuals.verzondenCommunicaties > 0 && actuals.positieveResponspercentage < Number(positiefDoel)) {
    signalen.push({
      id: 'positieve-respons-onder-doel',
      severity: 'aandacht',
      titel: 'Positieve respons ligt onder doel',
      toelichting: `${pct(actuals.positieveResponspercentage)} gerealiseerd tegenover ${pct(Number(positiefDoel))} doel.`,
    });
  }

  if (openOpvolging > 0) {
    signalen.push({
      id: 'open-opvolging',
      severity: 'aandacht',
      titel: 'Opvolging vraagt aandacht',
      toelichting: `${openOpvolging} geregistreerde opvolgacties zijn nog niet als afgerond gemeten.`,
    });
  }

  if (actuals.retourpost > 0) {
    signalen.push({
      id: 'retourpost',
      severity: 'informatie',
      titel: 'Retourpost geregistreerd',
      toelichting: `${actuals.retourpost} retourstuk${actuals.retourpost === 1 ? '' : 'ken'} in ${actuals.jaar}; controleer adreskwaliteit waar nodig.`,
    });
  }

  if (doelDekking === 0) {
    signalen.push({
      id: 'geen-doelen',
      severity: 'informatie',
      titel: 'Nog geen acquisitiedoelen ingesteld',
      toelichting: 'Actuals worden wel automatisch gemeten, maar er is nog geen norm om tempo of resultaat tegen af te zetten.',
    });
  }

  if (signalen.length === 0) {
    signalen.push({
      id: 'op-schema',
      severity: 'op_schema',
      titel: 'Geen directe stuurafwijking',
      toelichting: 'De ingestelde acquisitiedoelen en gemeten opvolging geven nu geen afwijking die directe aandacht vraagt.',
    });
  }

  const status = signalen.some(s => s.severity === 'kritiek')
    ? 'kritiek'
    : signalen.some(s => s.severity === 'aandacht')
      ? 'aandacht'
      : 'op_schema';

  return { jaarVoortgang, doelDekking, openOpvolging, signalen, status };
}
