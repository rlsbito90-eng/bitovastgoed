import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page=fs.readFileSync(path.join(process.cwd(),'src/pages/ObjectDetailPage.tsx'),'utf8');

describe('Commerciële objectcockpit gebruikt één bron voor fase en opvolging',()=>{
  it('toont één fase uit de Object Pipeline en gebruikt taken van de echte Deal',()=>{
    expect(page).toContain('bepaalCockpitOpvolging(');
    expect(page).toContain('leadDeal ? store.getTakenByDeal(leadDeal.id) : []');
    expect(page).toContain('cockpitIsActief(object,currentTrajectoryStage)');
    expect(page.match(/TrajectoryStageBadge objectId=\{object\.id\}/g)).toHaveLength(1);
    expect(page).toContain('hasTransactionPosition && activeDealRecords.length === 1');
    expect(page).not.toContain('.filter(t => t.status === \'open\')');
  });
  it('behoudt deep links voor cockpit, opvolging en snelle acties',()=>{
    const follow=page.indexOf('id="next-action"');
    const transaction=page.indexOf('id="deal-cockpit"');
    const actions=page.indexOf('id="quick-actions"');
    expect(follow).toBeGreaterThan(0);
    expect(transaction).toBeGreaterThan(follow);
    expect(actions).toBeGreaterThan(transaction);
    expect(page).toContain("'deal-cockpit': 'cockpit'");
    expect(page).toContain("'next-action': 'cockpit'");
    expect(page).toContain("'quick-actions': 'cockpit'");
  });
  it('toont geen niet-concrete Deal en biedt geen extra kunstmatige status',()=>{
    expect(page).toContain('{leadDeal && (');
    expect(page).toContain('Concrete transactie');
    expect(page).toContain('cockpitOpvolging.wachtend.length > 0');
    expect(page).toContain('cockpitOpvolging.teLaat');
    expect(page).toContain('Traject afgesloten. Geen nieuwe opvolging vereist.');
  });
  it('houdt de twee primaire acties zichtbaar en alle overige acties toegankelijk',()=>{
    expect(page).toContain('Kandidaat toevoegen');
    expect(page).toContain('Aanbieding openen');
    expect(page).toContain('Meer acties');
    expect(page).toContain('Notitie toevoegen');
    expect(page).toContain('Document uploaden');
    expect(page).toContain('Vastgoedrekenen openen');
  });
});