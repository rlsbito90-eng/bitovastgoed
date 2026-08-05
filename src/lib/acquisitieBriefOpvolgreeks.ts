export type AcquisitieBriefNummer = 1 | 2 | 3;

export type AcquisitieBriefStapStatus =
  | 'niet_beschikbaar'
  | 'voorbereiden'
  | 'klaar_voor_verzending'
  | 'verzonden'
  | 'reactie_ontvangen'
  | 'overgeslagen';

export interface AcquisitieBriefStapBron {
  briefNummer: AcquisitieBriefNummer;
  status?: string | null;
  verzondenOp?: string | null;
  opvolgdatum?: string | null;
  reactieOntvangenOp?: string | null;
  overgeslagen?: boolean | null;
}

export interface AcquisitieBriefOpvolgreeksBron {
  relatieGekoppeld: boolean;
  geadresseerdeGecontroleerd: boolean;
  reactieAfgerond?: boolean;
  stappen?: AcquisitieBriefStapBron[] | null;
}

export interface AcquisitieBriefStapReadModel {
  briefNummer: AcquisitieBriefNummer;
  label: string;
  status: AcquisitieBriefStapStatus;
  statusLabel: string;
  verzondenOp: string | null;
  opvolgdatum: string | null;
  reactieOntvangenOp: string | null;
  isActief: boolean;
  magVoorbereiden: boolean;
  magVerzendingRegistreren: boolean;
  magOverslaan: boolean;
}

export interface AcquisitieBriefOpvolgreeksReadModel {
  stappen: AcquisitieBriefStapReadModel[];
  actieveBrief: AcquisitieBriefNummer | null;
  afgerond: boolean;
  veiligheidsmelding: string;
}

const STATUS_LABELS: Record<AcquisitieBriefStapStatus, string> = {
  niet_beschikbaar: 'Nog niet beschikbaar',
  voorbereiden: 'Voorbereiden',
  klaar_voor_verzending: 'Klaar voor verzending',
  verzonden: 'Verzonden',
  reactie_ontvangen: 'Reactie ontvangen',
  overgeslagen: 'Overgeslagen',
};

const schoon = (waarde?: string | null): string | null => {
  const resultaat = waarde?.trim();
  return resultaat ? resultaat : null;
};

const normaliseerStatus = (stap: AcquisitieBriefStapBron | undefined): AcquisitieBriefStapStatus => {
  if (!stap) return 'niet_beschikbaar';
  if (stap.overgeslagen) return 'overgeslagen';
  if (schoon(stap.reactieOntvangenOp)) return 'reactie_ontvangen';
  if (schoon(stap.verzondenOp)) return 'verzonden';
  const status = schoon(stap.status)?.toLowerCase();
  if (status === 'klaar' || status === 'klaar_voor_verzending') return 'klaar_voor_verzending';
  if (status === 'voorbereiden' || status === 'concept') return 'voorbereiden';
  if (status === 'verzonden') return 'verzonden';
  if (status === 'reactie_ontvangen') return 'reactie_ontvangen';
  return 'niet_beschikbaar';
};

export function bouwAcquisitieBriefOpvolgreeks(
  bron: AcquisitieBriefOpvolgreeksBron,
): AcquisitieBriefOpvolgreeksReadModel {
  const basisGereed = bron.relatieGekoppeld && bron.geadresseerdeGecontroleerd;
  const bronPerNummer = new Map((bron.stappen ?? []).map((stap) => [stap.briefNummer, stap]));
  let vorigeAfgerond = basisGereed;
  let actieveBrief: AcquisitieBriefNummer | null = null;

  const stappen = ([1, 2, 3] as const).map((briefNummer): AcquisitieBriefStapReadModel => {
    const stapBron = bronPerNummer.get(briefNummer);
    let status = normaliseerStatus(stapBron);

    const beschikbaar = briefNummer === 1 ? basisGereed : vorigeAfgerond;
    if (!beschikbaar && status === 'niet_beschikbaar') status = 'niet_beschikbaar';
    if (beschikbaar && status === 'niet_beschikbaar') status = 'voorbereiden';

    const stapAfgerond = ['verzonden', 'reactie_ontvangen', 'overgeslagen'].includes(status);
    const isActief = !bron.reactieAfgerond && actieveBrief === null && beschikbaar && !stapAfgerond;
    if (isActief) actieveBrief = briefNummer;

    const readModel: AcquisitieBriefStapReadModel = {
      briefNummer,
      label: `Brief ${briefNummer}`,
      status,
      statusLabel: STATUS_LABELS[status],
      verzondenOp: schoon(stapBron?.verzondenOp),
      opvolgdatum: schoon(stapBron?.opvolgdatum),
      reactieOntvangenOp: schoon(stapBron?.reactieOntvangenOp),
      isActief,
      magVoorbereiden: isActief && status === 'voorbereiden',
      magVerzendingRegistreren: isActief && status === 'klaar_voor_verzending',
      magOverslaan: isActief && briefNummer > 1,
    };

    vorigeAfgerond = vorigeAfgerond && stapAfgerond;
    return readModel;
  });

  const afgerond = Boolean(bron.reactieAfgerond) || stappen.every((stap) =>
    ['verzonden', 'reactie_ontvangen', 'overgeslagen'].includes(stap.status),
  );

  return {
    stappen,
    actieveBrief: afgerond ? null : actieveBrief,
    afgerond,
    veiligheidsmelding: 'Elke brief vereist een expliciete voorbereiding en verzendregistratie; de reeks verstuurt niets automatisch.',
  };
}
