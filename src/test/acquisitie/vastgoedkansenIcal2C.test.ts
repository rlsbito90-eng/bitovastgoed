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
    expect(bron).toContain(".is('archived_at', null)");
    expect(bron).toContain('.or(`volgende_actie_datum.gte.${vanafDate},opvolgdatum.gte.${vanafDate}`)');
    expect(bron).not.toContain('workflowReadModel');
    expect(bron).not.toContain('bouwVastgoedkansWorkflowReadModel');
  });

  it('geeft de expliciete commerciële actiedatum voorrang op legacy opvolging', () => {
    expect(bron).toContain('const explicieteDatum = k.volgende_actie_datum ?? null');
    expect(bron).toContain("const isAfgesloten = k.status === 'afgevallen' || k.status === 'gepromoveerd'");
    expect(bron).toContain('const legacyDatum = !explicieteDatum && !isAfgesloten ? (k.opvolgdatum ?? null) : null');
    expect(bron).toContain('const actieDatum = explicieteDatum ?? legacyDatum');
  });

  it('voorkomt een dubbel agenda-item als dezelfde Vastgoedkans-datum al als open taak bestaat', () => {
    expect(bron).toContain('deal_id, vastgoedkans_id');
    expect(bron).toContain('const taakDeadlineSleutels = new Set');
    expect(bron).toContain('`${t.vastgoedkans_id}|${t.deadline}`');
    expect(bron).toContain('if (taakDeadlineSleutels.has(`${k.id}|${actieDatum}`)) continue');
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
