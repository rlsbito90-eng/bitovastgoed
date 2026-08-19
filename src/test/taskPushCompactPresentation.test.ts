import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notification-push-send/index.ts'),
  'utf8',
);

describe('notification-push-send — compacte taakpresentatie', () => {
  it('gebruikt korte semantische notificatiekoppen in plaats van de volledige taaknaam', () => {
    expect(source).toContain("return 'Brief opvolgen'");
    expect(source).toContain("return 'Brief voorbereiden'");
    expect(source).toContain("return 'Bellen'");
    expect(source).toContain("return 'Opvolging'");
    expect(source).toContain("return 'Taak te laat'");
    expect(source).toContain("return 'Taak vandaag'");
    expect(source).toContain("return 'Taak morgen'");
  });

  it('haalt het echte taken.type_taak veld plus object/signaal en relatie op voor context', () => {
    expect(source).toContain(".select('id, titel, type_taak, deadline, deadline_tijd, relatie_id, object_id, off_market_signaal_id')");
    expect(source).toContain('task?.type_taak');
    expect(source).not.toContain('task?.type)');
    expect(source).toContain('const pand = signaalLabel(context.signaal) || objectLabel(context.object)');
    expect(source).toContain('const relatie = relatieLabel(context.relatie)');
  });

  it('houdt timing Nederlands en zet de lange taaknaam alleen in de body waar die waarde toevoegt', () => {
    expect(source).toContain('Vandaag om ${tijd}');
    expect(source).toContain('Sinds gisteren te laat');
    expect(source).toContain('if (!isSpecialeCategorie)');
    expect(source).toContain('regels.push(verkortPushRegel(bronTitel))');
    expect(source).toContain("body: regels.filter(Boolean).join('\\n')");
  });

  it('houdt briefnummer en pand/relatiecontext samen in de body', () => {
    expect(source).toContain('bronTitel.match(/\\bbrief\\s*(\\d+)/i)?.[1]');
    expect(source).toContain('`Brief ${briefNummer} · ${contextRegel}`');
  });
});
