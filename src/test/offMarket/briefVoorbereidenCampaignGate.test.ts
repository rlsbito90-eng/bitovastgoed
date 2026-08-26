import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/BriefVoorbereidenKnop.tsx'),
  'utf8',
);

describe('losse Brief voorbereiden-route — campagnegate', () => {
  it('raadpleegt dezelfde canonieke partij/campagnerouter', () => {
    expect(bron).toContain('useRadarPartyCampaignContext([signaal])');
    expect(bron).toContain('partyContext.route(signaal, kandidaten[0])');
  });

  it('laat alleen een echte eerste koude Brief 1 als nieuw concept starten', () => {
    expect(bron).toContain("routing.outcome === 'nieuwe_campagne_brief_1'");
    expect(bron).toContain("routing.geadviseerdeStap === 'brief_1'");
    expect(bron).toContain('routing.magAutomatischBriefMaken');
  });

  it('verwijst bestaande campagne of onzekere partij naar Radar-brieven', () => {
    expect(bron).toContain('Gebruik Radar-brieven om de bestaande campagne, juiste vervolgstap of context te verwerken.');
    expect(bron).toContain('Meerdere geadresseerden/rechthebbenden gevonden. Gebruik Radar-brieven');
  });

  it('laat bestaande briefrecords wel openen en wijzigen', () => {
    expect(bron).toContain('if (initialBrief) return null;');
  });
});
