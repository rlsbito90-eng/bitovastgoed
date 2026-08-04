export type BagImportStapStatus = 'open' | 'bezig' | 'geslaagd' | 'mislukt' | 'teruggedraaid';

export interface BagImportStap {
  sleutel: string;
  volgorde: number;
  status: BagImportStapStatus;
  gestartOp?: string;
  afgerondOp?: string;
  foutmelding?: string;
}

export interface BagShadowImportRun {
  runId: string;
  scopeCode: string;
  datasetVersie: string;
  doelProjectRef: string;
  gestartOp: string;
  stappen: BagImportStap[];
  clientAllowlistActief: boolean;
  serverAllowlistActief: boolean;
  rollbackMarkerAanwezig: boolean;
}

export const AMSTERDAM_IMPORT_STAPPEN = [
  'bronpakket_valideren',
  'capaciteit_controleren',
  'rollbackmarker_vastleggen',
  'staging_legen',
  'objecten_importeren',
  'voorkomens_importeren',
  'relaties_importeren',
  'geometrieen_importeren',
  'integriteit_valideren',
  'queryservice_rooktest',
  'publicatiebesluit_vastleggen',
] as const;

export function maakBagShadowImportRun(input: {
  runId: string;
  scopeCode: string;
  datasetVersie: string;
  doelProjectRef: string;
  gestartOp: string;
}): BagShadowImportRun {
  if (!/^\d{4}$/.test(input.scopeCode)) throw new TypeError('Scopecode moet vier cijfers bevatten.');
  if (!input.runId.trim() || !input.datasetVersie.trim() || !input.doelProjectRef.trim()) {
    throw new TypeError('Run-ID, datasetversie en doelproject zijn verplicht.');
  }

  return {
    ...input,
    stappen: AMSTERDAM_IMPORT_STAPPEN.map((sleutel, index) => ({ sleutel, volgorde: index + 1, status: 'open' })),
    clientAllowlistActief: false,
    serverAllowlistActief: false,
    rollbackMarkerAanwezig: false,
  };
}

export function bepaalVolgendeImportStap(run: BagShadowImportRun): BagImportStap | null {
  const mislukt = run.stappen.find(stap => stap.status === 'mislukt');
  if (mislukt) return mislukt;
  return run.stappen.find(stap => stap.status === 'open' || stap.status === 'bezig') ?? null;
}

export function beoordeelImportRunVeiligheid(run: BagShadowImportRun): { veilig: boolean; blokkades: string[] } {
  const blokkades: string[] = [];
  if (run.scopeCode !== '0363') blokkades.push('Deze uitvoerbuild is uitsluitend voor Amsterdam scope 0363.');
  if (run.clientAllowlistActief || run.serverAllowlistActief) blokkades.push('Amsterdam mag tijdens de import niet querybaar zijn.');
  const rollbackStap = run.stappen.find(stap => stap.sleutel === 'rollbackmarker_vastleggen');
  const destructieveStapGestart = run.stappen.some(stap => stap.volgorde >= 4 && stap.status !== 'open');
  if (destructieveStapGestart && (!run.rollbackMarkerAanwezig || rollbackStap?.status !== 'geslaagd')) {
    blokkades.push('Destructieve importstappen vereisen een geslaagde rollbackmarker.');
  }
  const tegelijkBezig = run.stappen.filter(stap => stap.status === 'bezig');
  if (tegelijkBezig.length > 1) blokkades.push('Er mag maximaal één importstap tegelijk bezig zijn.');
  return { veilig: blokkades.length === 0, blokkades };
}

export function kanPublicerenNaImport(run: BagShadowImportRun): boolean {
  const verplichtGeslaagd = [
    'bronpakket_valideren',
    'capaciteit_controleren',
    'rollbackmarker_vastleggen',
    'objecten_importeren',
    'voorkomens_importeren',
    'relaties_importeren',
    'geometrieen_importeren',
    'integriteit_valideren',
    'queryservice_rooktest',
  ];
  return beoordeelImportRunVeiligheid(run).veilig
    && verplichtGeslaagd.every(sleutel => run.stappen.find(stap => stap.sleutel === sleutel)?.status === 'geslaagd');
}
