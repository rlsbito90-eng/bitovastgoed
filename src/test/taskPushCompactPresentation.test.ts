import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notification-push-send/index.ts'),
  'utf8',
);

describe('notification-push-send — compacte taakpresentatie', () => {
  it('gebruikt korte semantische koppen en toont bij iedere categorie de echte taakomschrijving', () => {
    expect(source).toContain("return 'Brief opvolgen'");
    expect(source).toContain("return 'Brief voorbereiden'");
    expect(source).toContain("return 'Bellen'");
    expect(source).toContain("return 'Opvolging'");
    expect(source).toContain("return 'Taak'");
    expect(source).toContain('const regels = [verkortPushRegel(bronTitel, 96)]');
    expect(source).not.toContain('if (!isSpecialeCategorie)');
  });

  it('geeft object/signaal voorrang en voegt de primaire relatie toe als maximaal één contextregel', () => {
    expect(source).toContain(".select('id, titel, type_taak, deadline, deadline_tijd, relatie_id, object_id, off_market_signaal_id')");
    expect(source).toContain('task?.type_taak');
    expect(source).toContain('const pand = objectLabel(context.object) || signaalLabel(context.signaal)');
    expect(source).toContain('const relatie = relatieLabel(context.relatie, context.primaireContactNaam)');
    expect(source).toContain(".from('relatie_contactpersonen')");
    expect(source).toContain(".select('relatie_id, naam, is_primair')");
    expect(source).toContain(".order('is_primair', { ascending: false })");
    expect(source).toContain('primaireContactNaam: task.relatie_id ? primaireContactMap.get(task.relatie_id) : null');
    expect(source).toContain("regels.push(verkortPushRegel(contextParts.join(' · '), 96))");
    expect(source).not.toContain("regels.push(verkortPushRegel(briefNummer");
  });

  it('zet waarom de melding verschijnt bij de kop, niet als een fictieve afspraak in de taak', () => {
    expect(source).toContain('const timing = taakTimingLabel(event, task, timeZone)');
    expect(source).toContain('const title = timing ? `${categorie} · ${timing}` : categorie');
    expect(source).toContain("if (type === 'task_plan_reminder')");
    expect(source).toContain('const date = schoon(event?.metadata?.plan_datum)');
    expect(source).toContain("return 'Vandaag gepland'");
    expect(source).toContain("return 'Morgen gepland'");
    expect(source).toContain("return 'Deadline vandaag'");
    expect(source).toContain("return 'Deadline verstreken'");
    expect(source).not.toContain('const tijdLabel = taakTijdLabel(task, event, timeZone)');
  });

  it('behoudt notificatie-actie, deep-link en bestaande pushbezorging', () => {
    expect(source).toContain('href: event.href ||');
    expect(source).toContain('pushTitle = presentatie.title');
    expect(source).toContain('pushBody = presentatie.body');
    expect(source).toContain("body: regels.filter(Boolean).join('\\n')");
  });
});
