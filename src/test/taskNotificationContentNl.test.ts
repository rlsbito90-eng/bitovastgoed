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
    expect(pushBron).toContain('signaalLabel(context.signaal) || objectLabel(context.object)');
  });

  it('gebruikt de taaknaam als pushkop in plaats van de generieke Taakherinnering-kop', () => {
    expect(pushBron).toContain("const title = schoon(task?.titel) || schoon(event?.title) || 'Taak';");
    expect(pushBron).toContain('title: pushTitle');
    expect(pushBron).toContain('body: pushBody');
  });

  it('presenteert timing in natuurlijk Nederlands zonder technisch deadline-label', () => {
    expect(pushBron).toContain('Vandaag om ${tijd}');
    expect(pushBron).toContain('Morgen om ${tijd}');
    expect(pushBron).toContain('Gisteren sinds ${tijd} te laat');
    expect(pushBron).toContain('Sinds ${datumLabel} ${tijd} te laat');
    expect(pushBron).not.toContain("pushBody = `${task.titel} · deadline");
  });

  it('geeft nieuwe briefopvolgtaken direct eigenaarcontext en bewaart het pand in de taakcontext', () => {
    expect(briefBron).toContain('useOffMarketSignaal(signaalId)');
    expect(briefBron).toContain("const pandLabel = [signaal?.adres, signaal?.plaats].filter(Boolean).join(' · ');");
    expect(briefBron).toContain('Brief 2 voorbereiden / opvolgen — ${geadresseerdeLabel}');
    expect(briefBron).toContain('offMarketSignaalId: signaalId');
  });
});
