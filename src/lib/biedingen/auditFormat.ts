import { fmtEur } from './format';
import { BIEDING_STATUS_LABELS } from './types';

export interface BiedAuditEvent {
  id: string;
  bieding_id: string;
  object_id: string;
  relatie_id: string;
  deal_id: string | null;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  changed_fields: string[];
  old_snapshot: Record<string, unknown> | null;
  new_snapshot: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

const veldLabels: Record<string, string> = {
  bedrag: 'Bedrag',
  status: 'Status',
  bieddatum: 'Bieddatum',
  richting: 'Afzender',
  offer_type: 'Type bod',
  geldig_tot: 'Geldigheid',
  financieringsvoorbehoud: 'Financieringsvoorbehoud',
  dd_voorbehoud: 'DD-voorbehoud',
  gewenste_levering: 'Leverdatum',
  gewenste_levering_tekst: 'Leverafspraken',
  waarborgsom_bedrag: 'Waarborgsom',
  waarborgsom_pct: 'Waarborgsompercentage',
  kosten_type: 'Kosten',
  voorwaarden: 'Voorwaarden',
  notities: 'Notities',
  interne_notities: 'Interne notities',
  rejected_reason: 'Afwijzingsreden',
  rejected_at: 'Afwijzingsdatum',
  accepted_at: 'Acceptatiedatum',
  withdrawn_at: 'Intrekkingsdatum',
  deal_id: 'Gekoppelde deal',
  counter_offer_to_id: 'Reactie op eerder bod',
};

function toonWaarde(veld: string, waarde: unknown): string {
  if (waarde === null || waarde === undefined || waarde === '') return '—';
  if (veld === 'bedrag' || veld === 'waarborgsom_bedrag') {
    const nummer = Number(waarde);
    return Number.isFinite(nummer) ? fmtEur(nummer) : String(waarde);
  }
  if (veld === 'status') return BIEDING_STATUS_LABELS[waarde as keyof typeof BIEDING_STATUS_LABELS] ?? String(waarde);
  if (veld === 'richting') {
    return ({ van_koper: 'Koper', van_verkoper: 'Verkoper', namens_verkoper: 'Namens verkoper', intern: 'Intern' } as Record<string, string>)[String(waarde)] ?? String(waarde);
  }
  if (typeof waarde === 'boolean') return waarde ? 'Ja' : 'Nee';
  if (typeof waarde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(waarde)) {
    const [jaar, maand, dag] = waarde.split('-');
    return `${dag}-${maand}-${jaar}`;
  }
  return String(waarde);
}

/** Immutable events are logged server-side. Presentation never changes the log. */
export function biedAuditTitel(event: BiedAuditEvent): string {
  if (event.operation === 'INSERT') return 'Bieding geregistreerd';
  if (event.operation === 'DELETE') return 'Bieding verwijderd';
  if (event.changed_fields.includes('status')) {
    const s = event.new_snapshot?.status;
    if (s === 'afgewezen') return 'Bod afgewezen';
    if (s === 'geaccepteerd') return 'Bod geaccepteerd';
    if (s === 'ingetrokken') return 'Bod ingetrokken';
  }
  return 'Bieding aangepast';
}

export function biedAuditDetails(event: BiedAuditEvent): string[] {
  if (event.operation === 'INSERT') return [`Eerste registratie: ${toonWaarde('bedrag', event.new_snapshot?.bedrag)}`];
  if (event.operation === 'DELETE') return [`Verwijderd bod: ${toonWaarde('bedrag', event.old_snapshot?.bedrag)}`];

  return event.changed_fields
    .filter(veld => veld !== 'updated_at')
    .map(veld => {
      const label = veldLabels[veld] ?? 'Overig: ' + veld.replaceAll('_', ' ');
      // Privacy: note texts and free-form fields may contain sensitive contact details.
      if (['voorwaarden', 'notities', 'interne_notities', 'rejected_reason', 'gewenste_levering_tekst'].includes(veld)) {
        return label + ' gewijzigd';
      }
      // Technical references aren't useful as UUIDs in the UI.
      if (['deal_id', 'counter_offer_to_id', 'object_id', 'relatie_id', 'object_pipeline_id'].includes(veld)) {
        return label + ' aangepast';
      }
      return `${label}: ${toonWaarde(veld, event.old_snapshot?.[veld])} → ${toonWaarde(veld, event.new_snapshot?.[veld])}`;
    });
}
