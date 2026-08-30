import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('Radar — bundeling bij partij is uitlegbaar', () => {
  it('toont bij een gebundeld dossier concrete partij- en campagnecontext', () => {
    const rij = fs.readFileSync(path.join(root, 'src/components/offmarket/acquisitie/AcquisitieDossierRij.tsx'), 'utf8');
    const uitleg = fs.readFileSync(path.join(root, 'src/components/offmarket/acquisitie/RadarBundelingUitleg.tsx'), 'utf8');

    expect(rij).toContain("werkvoorraadLabel === 'Gebundeld bij partij'");
    expect(rij).toContain('RadarDossierRouteringsUitleg');
    expect(uitleg).toContain('Gebundeld bij bestaande campagne');
    expect(uitleg).toContain('Partij:');
    expect(uitleg).toContain('Status:');
    expect(uitleg).toContain('Stap:');
    expect(uitleg).toContain('Hoofdobject:');
    expect(uitleg).toContain('Partijmatch gevonden, maar geen concrete actieve campagne gekoppeld.');
  });

  it('leest campagne-id, status, stap en hoofdobject uit dezelfde partijcontext', () => {
    const hook = fs.readFileSync(path.join(root, 'src/hooks/useRadarPartyCampaignContext.tsx'), 'utf8');
    expect(hook).toContain('campagneStatus');
    expect(hook).toContain('huidigeStap');
    expect(hook).toContain('primarySignaalId');
    expect(hook).toContain('primaryObjectAdres');
  });
});
