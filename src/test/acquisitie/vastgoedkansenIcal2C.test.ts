import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const bron = fs.readFileSync(path.join(root, 'supabase/functions/bito-ical-feed/index.ts'), 'utf8');

describe('BUILD 2.0C — Vastgoedkansen in iCal', () => {
  it('leest alleen gedateerde Vastgoedkans-acties uit de bestaande iCal-feed', () => {
    expect(bron).toContain(".from('vastgoedkansen')");
    expect(bron).toContain('volgende_actie_datum');
    expect(bron).toContain('opvolgdatum');
    expect(bron).toContain('.or(`volgende_actie_datum.gte.${vanafDate},opvolgdatum.gte.${vanafDate}`)');
    expect(bron).toContain("const CLOSED_VASTGOEDKANS_STATUSES = new Set(['afgevallen', 'gepromoveerd'])");
    expect(bron).not.toContain(".is('archived_at', null)");
    expect(bron).not.toContain('workflowReadModel');
    expect(bron).not.toContain('bouwVastgoedkansWorkflowReadModel');
  });

  it('geeft de expliciete commerciële actiedatum voorrang op legacy opvolging', () => {
    expect(bron).toContain('if (CLOSED_VASTGOEDKANS_STATUSES.has(k.status)) continue');
    expect(bron).toContain('const explicieteDatum = k.volgende_actie_datum ?? null');
    expect(bron).toContain('const legacyDatum = !explicieteDatum ? (k.opvolgdatum ?? null) : null');
    expect(bron).toContain('const actieDatum = explicieteDatum ?? legacyDatum');
  });

  it('laat de canonieke centrale taak winnen van Vastgoedkans-fallbacks', () => {
    expect(bron).toContain('deal_id, vastgoedkans_id, source_kind, source_id, source_slot');
    expect(bron).toContain('const canonicalSourceSlots = new Set');
    expect(bron).toContain("hasCanonical('vastgoedkans', k.id, 'volgende_actie')");
    expect(bron).toContain('(taken as any[]).some((t) => t.vastgoedkans_id === k.id && t.deadline === actieDatum)');
  });

  it('maakt een stabiel all-day event dat teruglinkt naar het Vastgoedkans-dossier', () => {
    expect(bron).toContain("makeUid('vastgoedkans-actie', k.id)");
    expect(bron).toContain('`${APP_BASE_URL}/vastgoedkansen/${k.id}`');
    expect(bron).toContain('startDate: actieDatum');
    expect(bron).toContain('endDate: addOneDay(actieDatum)');
    expect(bron).toContain('📌');
  });

  it('gebruikt Vercel als veilige fallback voor alle teruglinks en geen Lovable-runtime', () => {
    expect(bron).toContain("Deno.env.get('APP_BASE_URL') ?? 'https://bitovastgoed.vercel.app'");
    expect(bron).not.toContain('bitovastgoed.lovable.app');
  });
});
