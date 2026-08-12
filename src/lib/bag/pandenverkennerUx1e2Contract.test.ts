import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const pandenverkenner = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const kansen = fs.readFileSync('src/pages/VastgoedkansenPage.tsx', 'utf8');

describe('Pandenverkenner UX 1E.2 contract', () => {
  it('scheidt zoeken/lijst en kaart in twee weergaven', () => {
    expect(pandenverkenner).toContain("useState<'zoeken' | 'kaart'>('zoeken')");
    expect(pandenverkenner).toContain('Zoeken & lijst');
    expect(pandenverkenner).toContain('>Kaart');
    expect(pandenverkenner).toContain("weergave === 'kaart' && <BagPandenKaart");
  });

  it('houdt uitgebreide filters standaard compact', () => {
    expect(pandenverkenner).toContain('const [toonMeerFilters, setToonMeerFilters] = useState(false)');
    expect(pandenverkenner).toContain('Pandstatus, wijk/buurt, GBO/VBO en gebruiksfunctie.');
    expect(pandenverkenner).toContain('{toonMeerFilters && <>');
  });

  it('maakt Panden vinden de primaire rechteractie op Vastgoedkansen', () => {
    const nieuweKans = kansen.indexOf('>Nieuwe kans</Button>');
    const pandenVinden = kansen.indexOf('>Panden vinden</Link></Button>');
    expect(nieuweKans).toBeGreaterThan(-1);
    expect(pandenVinden).toBeGreaterThan(nieuweKans);
    expect(kansen).toContain('<Button asChild><Link to="/vastgoedkansen/vinden">');
  });
});
