import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const events = readFileSync('src/lib/offMarket/brieven/events.ts', 'utf8');
const afrondenDialog = readFileSync('src/components/forms/TaakAfrondenDialog.tsx', 'utf8');
const responsDialog = readFileSync('src/components/offmarket/brieven/RegistreerResponsDialog.tsx', 'utf8');

describe('TRACK-7A follow-up completion meetcontract', () => {
  it('heeft een fail-soft en idempotente projector op gekoppelde brief en taak', () => {
    expect(events).toContain('export async function logFollowUpCompletedVoorTaak');
    expect(events).toContain(".eq('gekoppelde_taak_id', normalizedTaakId)");
    expect(events).toContain(".eq('event_type', 'follow_up_completed')");
    expect(events).toContain("event_type: 'follow_up_completed'");
    expect(events).toContain("bron: 'centrale_taakstatus'");
    expect(events).toContain('brieven.length !== 1');
  });

  it('meet de normale handmatige taakafrondflow', () => {
    expect(afrondenDialog).toContain("await updateTaak(taak.id, { status: 'afgerond' });");
    expect(afrondenDialog).toContain('await logFollowUpCompletedVoorTaak(taak.id);');
  });

  it('meet ook automatische afronding wanneer een respons de standaardopvolging vervangt', () => {
    expect(responsDialog).toContain("status: 'afgerond'");
    expect(responsDialog).toContain('await logFollowUpCompletedVoorTaak(taak.id);');
  });

  it('wijzigt voor de meetprojectie geen brief- of taakstatus', () => {
    const helper = events.slice(events.indexOf('export async function logFollowUpCompletedVoorTaak'));
    expect(helper).not.toContain(".update(");
    expect(helper).not.toContain(".delete(");
    expect(helper).toContain('await logBriefEvent({');
  });
});
