import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const eventsBron = fs.readFileSync(path.resolve('src/lib/offMarket/brieven/events.ts'), 'utf8');
const engineBron = fs.readFileSync(path.resolve('src/lib/workflow/acquisitieWorkflowEngine.ts'), 'utf8');
const detailBron = fs.readFileSync(path.resolve('src/pages/VastgoedkansDetailPage.tsx'), 'utf8');

describe('BUILD 2.0E — safety boundaries', () => {
  it('houdt workflowprojectie append-only in het bestaande eventlog', () => {
    expect(eventsBron).toContain("from('off_market_brief_events').insert(payload)");
    expect(eventsBron).toContain('volgende_actie: workflow.volgendeActie');
    expect(eventsBron).toContain('volgende_actie_op: workflow.volgendeActieOp');
    expect(eventsBron).not.toContain("from('taken')");
    expect(eventsBron).not.toContain("from('vastgoedkansen').update");
    expect(eventsBron).not.toContain('fetch(');
  });

  it('modelleert automatische uitvoering, voorstel en bevestiging expliciet', () => {
    expect(engineBron).toContain("'automatic' | 'proposal' | 'confirmation'");
    expect(engineBron).toContain("id: 'response.geen-interesse'");
    expect(engineBron).toContain("'Beoordeel afsluiten of archiveren', 'confirmation'");
    expect(engineBron).toContain("id: 'owner.kadaster-uniek'");
    expect(engineBron).toContain("'Bevestig voorgestelde eigenaar', 'proposal'");
  });

  it('neemt bij deal-sluiting en archief oude afgeleide acties weg', () => {
    expect(engineBron).toContain("lifecycle: 'deal_closed', nextAction: null");
    expect(engineBron).toContain("lifecycle: 'archived', nextAction: null");
  });
});

describe('BUILD 2.0F — Amsterdam workflow acceptance', () => {
  it('toont het centrale workflowadvies in het Vastgoedkans-overzicht', () => {
    expect(detailBron).toContain('bouwVastgoedkansWorkflowReadModel');
    expect(detailBron).toContain("workflowReadModel?.nextAction?.label ?? 'Geen open workflowactie'");
    expect(detailBron).toContain('Commerciële statuswijzigingen en externe acties blijven expliciete gebruikersbeslissingen.');
  });

  it('laat de responsdropdown niet zelfstandig naar een commerciële eindstatus springen', () => {
    const start = detailBron.indexOf('const setReactie =');
    const einde = detailBron.indexOf('const scrollNaar', start);
    const handler = detailBron.slice(start, einde);
    expect(handler).not.toContain("'afgevallen'");
    expect(handler).not.toContain('status:');
  });
});
