import { EXTRA_VOORWAARDEN_LABELS, KOSTEN_LABELS, VOORBEHOUD_LABELS, type Bieding, type ExtraVoorwaarde } from './types';
import { fmtDate, fmtEur } from './format';

export type ConditionComparison = {
  label: string;
  before: string;
  after: string;
  status: 'gelijk' | 'verschillend' | 'onbekend';
};

const unknown = 'Niet vastgelegd';
const normalize = (value?: string | null) => value?.trim() || null;
const date = (value?: string | null) => value ? fmtDate(value) : null;
const textOf = (v: ExtraVoorwaarde) => [
  EXTRA_VOORWAARDEN_LABELS[v.type] ?? v.type,
  v.karakter === 'voorbehoud' ? 'Voorbehoud' : v.karakter === 'transactiebepaling' ? 'Transactiebepaling' : 'Karakter onbekend',
  normalize(v.toelichting),
  v.deadline ? 'Uiterlijk ' + fmtDate(v.deadline) : null,
].filter(Boolean).join(' · ');
const conditionList = (values?: ExtraVoorwaarde[] | null) => values == null
  ? null : values.length === 0 ? 'Geen aanvullende gestructureerde voorwaarden' : values.map(textOf).sort().join('\n');

export function compareConditions(before: Bieding, after: Bieding): ConditionComparison[] {
  const rows: ConditionComparison[] = [];
  const add = (label: string, a: string | null, b: string | null, uncertain = false) => {
    rows.push({label, before: a ?? unknown, after: b ?? unknown,
      status: uncertain || a === null || b === null ? 'onbekend' : a === b ? 'gelijk' : 'verschillend'});
  };
  const reserved = (value: Bieding['financieringsvoorbehoud']) => value ? VOORBEHOUD_LABELS[value] ?? null : null;
  add('Financiering', reserved(before.financieringsvoorbehoud), reserved(after.financieringsvoorbehoud),
    !['ja','geen'].includes(before.financieringsvoorbehoud) || !['ja','geen'].includes(after.financieringsvoorbehoud));
  add('Due diligence', reserved(before.ddVoorbehoud), reserved(after.ddVoorbehoud),
    !['ja','geen'].includes(before.ddVoorbehoud) || !['ja','geen'].includes(after.ddVoorbehoud));
  for (const [key,label] of [['financiering','Financiering'],['dd','Due diligence']] as const) {
    const a = before.voorbehoudDetails?.[key];
    const b = after.voorbehoudDetails?.[key];
    const hasA = (key === 'financiering' ? before.financieringsvoorbehoud : before.ddVoorbehoud) === 'ja';
    const hasB = (key === 'financiering' ? after.financieringsvoorbehoud : after.ddVoorbehoud) === 'ja';
    if (hasA || hasB) {
      if (a?.deadline || b?.deadline) add(label+' · deadline', hasA ? date(a?.deadline) : null, hasB ? date(b?.deadline) : null);
      if (a?.toelichting || b?.toelichting) add(label+' · toelichting', hasA ? normalize(a?.toelichting) : null, hasB ? normalize(b?.toelichting) : null);
    }
  }
  add('Aanvullende voorwaarden', conditionList(before.extraVoorwaarden), conditionList(after.extraVoorwaarden));
  add('Vrije tekstvoorwaarden', normalize(before.voorwaarden), normalize(after.voorwaarden));
  add('Kosten', before.kostenType ? KOSTEN_LABELS[before.kostenType] : null, after.kostenType ? KOSTEN_LABELS[after.kostenType] : null);
  const delivery = (b: Bieding) => [date(b.gewensteLevering),normalize(b.gewensteLeveringTekst)].filter(Boolean).join(' · ') || null;
  add('Levering', delivery(before), delivery(after));
  const deposit = (b: Bieding) => [b.waarborgsomBedrag == null ? null : fmtEur(b.waarborgsomBedrag), b.waarborgsomPct == null ? null : b.waarborgsomPct.toLocaleString('nl-NL') + '%'].filter(Boolean).join(' · ') || null;
  add('Waarborgsom', deposit(before), deposit(after));
  add('Geldigheid voorstel', date(before.geldigTot), date(after.geldigTot));
  return rows;
}
