import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/offmarket/bag/BagOverzichtKaart.tsx'),
  'utf8',
);

describe('Kadasterknop in BAG-overzicht', () => {
  it('communiceert dat de knop navigeert en niet automatisch ophaalt', () => {
    expect(source).toContain('Naar Kadasteronderzoek');
    expect(source).toContain('Open het handmatige Kadaster- en eigenaarsonderzoek.');
    expect(source).not.toContain('>\n            Kadaster ophalen\n          </Button>');
  });
});
