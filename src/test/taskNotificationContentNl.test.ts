import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pushBron = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notification-push-send/index.ts'),
  'utf8',
);
const briefBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/brieven/MarkeerVerstuurdDialog.tsx'),
  'utf8',
);

describe('taaknotificaties met herkenbare Nederlandse context', () => {
  it('verrijkt taakpushes met gekoppeld pand/signaal en relatie', () => {
    expect(pushBron).toContain(".from('taken')");
    expect(pushBron).toContain('off_market_signaal_id');
    expect(pushBron).toContain(".from('off_market_signalen')");
    expect(pushBron).toContain(".from('relaties')");
    expect(pushBron).toContain(".from('objecten')");
    expect(pushBron).toContain('objectLabel(context.object) || signaalLabel(context.signaal)');
  });

  it('houdt semantische koppen en toont altijd de concrete taakomschrijving', () => {
    expect(pushBron).toContain('const categorie = compacteTaakCategorie(task, event);');
    expect(pushBron).toContain("return 'Brief opvolgen'");
    expect(pushBron).toContain('const regels = [verkortPushRegel(bronTitel, 96)]');
    expect(pushBron).toContain("regels.push(verkortPushRegel(contextParts.join(' · '), 96))");
    expect(pushBron).toContain('title: pushTitle');
    expect(pushBron).toContain('body: pushBody');
  });

  it('onderscheidt werkplanning van de harde deadline in de kop', () => {
    expect(pushBron).toContain("if (type === 'task_plan_reminder')");
    expect(pushBron).toContain("return 'Vandaag gepland'");
    expect(pushBron).toContain("return 'Morgen gepland'");
    expect(pushBron).toContain("if (type === 'task_reminder' || type === 'task_due_today')");
    expect(pushBron).toContain("return 'Deadline vandaag'");
    expect(pushBron).toContain("return 'Deadline verstreken'");
    expect(pushBron).not.toContain('taakTijdLabel(task, event, timeZone)');
  });

  it('maakt voor post geen persoonlijke opvolgtaak meer en behoudt e-mailtaakcontext', () => {
    expect(briefBron).toContain('Postopvolging is operationele Radar-werkvoorraad en géén persoonlijke taak.');
    expect(briefBron).toContain('if (isEmail) {');
    expect(briefBron).toContain('E-mail ${stapNr} opvolgen — ${geadresseerdeLabel}');
    expect(briefBron).toContain('offMarketSignaalId: signaalId');
    expect(briefBron).not.toContain('Brief 2 voorbereiden / opvolgen — ${geadresseerdeLabel}');
  });
});
