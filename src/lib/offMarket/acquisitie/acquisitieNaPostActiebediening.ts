import type {
  AcquisitieNaPostActie,
  AcquisitieNaPostActiestatus,
} from './acquisitieNaPostActiestatus';

export type AcquisitieNaPostActievariant = 'primair' | 'secundair' | 'verborgen';

export interface AcquisitieNaPostActiebediening {
  actie: AcquisitieNaPostActie;
  label: string;
  variant: AcquisitieNaPostActievariant;
  zichtbaar: boolean;
  uitgeschakeld: boolean;
  bevestigingNodig: boolean;
  operationKey: string | null;
  blokkeertVervolg: boolean;
}

const LABELS: Record<Exclude<AcquisitieNaPostActie, 'geen'>, string> = {
  postregistratie_herstellen: 'Postregistratie herstellen',
  opvolging_herstellen: 'Opvolgtaken herstellen',
  dossierbijwerking_herstellen: 'Dossierstatus herstellen',
  audit_herstellen: 'Auditregistratie herstellen',
};

/**
 * Vertaalt één gebruikersgerichte actiestatus naar een declaratief UI-contract.
 * Deze projectie voert zelf niets uit en bevat geen persoonsgegevens of vrije
 * fouttekst. Bedrijfsherstel is primair en vereist bevestiging; een auditretry
 * is secundair en blokkeert het verdere acquisitieproces niet.
 */
export function projecteerAcquisitieNaPostActiebediening(
  status: AcquisitieNaPostActiestatus,
): AcquisitieNaPostActiebediening {
  if (status.actie === 'geen') {
    return Object.freeze({
      actie: 'geen',
      label: '',
      variant: 'verborgen',
      zichtbaar: false,
      uitgeschakeld: true,
      bevestigingNodig: false,
      operationKey: null,
      blokkeertVervolg: false,
    });
  }

  const heeftOperationKeyNodig = status.actie === 'dossierbijwerking_herstellen'
    || status.actie === 'audit_herstellen';
  if (heeftOperationKeyNodig && !status.operationKey?.trim()) {
    throw new Error('Herstelbediening mist de vereiste operation key.');
  }
  if (!heeftOperationKeyNodig && status.operationKey !== null) {
    throw new Error('Herstelbediening bevat een onverwachte operation key.');
  }

  const isAudit = status.actie === 'audit_herstellen';
  return Object.freeze({
    actie: status.actie,
    label: LABELS[status.actie],
    variant: isAudit ? 'secundair' : 'primair',
    zichtbaar: true,
    uitgeschakeld: false,
    bevestigingNodig: !isAudit,
    operationKey: status.operationKey,
    blokkeertVervolg: status.blokkeertVervolg,
  });
}
