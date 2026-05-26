// Markdown-export van een AuditReport voor externe beoordeling.

import type { AuditReport, AuditCheck } from './types';
import { CATEGORY_LABELS } from './types';

const statusLabel = (s: AuditCheck['status']) =>
  s === 'ok' ? 'OK' : s === 'warning' ? 'Waarschuwing' : s === 'error' ? 'Fout' : 'N.v.t.';

export function exportAuditMarkdown(r: AuditReport): string {
  const lines: string[] = [];
  lines.push(`# Auditrapport Vastgoedrekenen — ${r.scenarioName}`);
  lines.push('');
  lines.push(`_Gegenereerd: ${new Date(r.generatedAt).toLocaleString('nl-NL')}_`);
  lines.push('');
  lines.push('## 1. Scenario-informatie');
  lines.push(`- Scenario-id: \`${r.scenarioId}\``);
  lines.push(`- Naam: ${r.scenarioName}`);
  lines.push('');
  lines.push('## 2. Samenvatting');
  lines.push(`- OK: ${r.summary.ok}`);
  lines.push(`- Waarschuwingen: ${r.summary.warning}`);
  lines.push(`- Fouten: ${r.summary.error}`);
  lines.push(`- N.v.t.: ${r.summary.na}`);
  lines.push('');
  lines.push(`**Conclusie:** ${r.conclusion}`);
  lines.push('');

  lines.push('## 3. Databronnen (Bron van waarheid)');
  lines.push('');
  lines.push('| Onderdeel | Actieve bron | Alternatieve bron | Risico | Toelichting |');
  lines.push('|---|---|---|---|---|');
  for (const row of r.sourcesOfTruth) {
    lines.push(`| ${row.onderdeel} | ${row.actieveBron} | ${row.alternatieveBron ?? '—'} | ${row.risico} | ${row.toelichting ?? '—'} |`);
  }
  lines.push('');

  lines.push('## 4. Berekeningsstappen — Maximale bieding');
  lines.push('');
  lines.push('| Stap | Waarde | Formule / toelichting |');
  lines.push('|---|---|---|');
  for (const s of r.maxBidExplain) {
    const v = typeof s.value === 'number' ? s.value.toLocaleString('nl-NL') : (s.value ?? '—');
    lines.push(`| ${s.label} | ${v} | ${s.formula ?? s.note ?? ''} |`);
  }
  lines.push('');

  // Checks per categorie
  lines.push('## 5. Controles per categorie');
  const grouped = new Map<string, AuditCheck[]>();
  for (const c of r.checks) {
    const k = CATEGORY_LABELS[c.category];
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(c);
  }
  for (const [cat, list] of grouped) {
    lines.push('');
    lines.push(`### ${cat}`);
    lines.push('');
    lines.push('| Status | Sectie | Record | Probleem | Advies | Technisch |');
    lines.push('|---|---|---|---|---|---|');
    for (const c of list) {
      lines.push(`| ${statusLabel(c.status)} | ${c.section} | ${c.record ?? '—'} | ${c.problem} | ${c.advice ?? '—'} | ${c.technical ?? '—'} |`);
    }
  }
  lines.push('');
  lines.push('## 6. Actiepunten');
  const acties = r.checks.filter((c) => c.status === 'error' || c.status === 'warning');
  if (acties.length === 0) {
    lines.push('Geen openstaande actiepunten.');
  } else {
    for (const a of acties) {
      lines.push(`- **[${statusLabel(a.status)}] ${a.section}${a.record ? ` · ${a.record}` : ''}** — ${a.problem}${a.advice ? ` _Advies:_ ${a.advice}` : ''}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
