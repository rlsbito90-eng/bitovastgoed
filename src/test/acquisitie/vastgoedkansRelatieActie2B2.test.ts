import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const bron = fs.readFileSync(path.join(process.cwd(), 'src/pages/VastgoedkansDetailPage.tsx'), 'utf8');

describe('BUILD 2.0B.2 — werkstroomactie relatie koppelen', () => {
  it('scrollt naar het echte CRM-relatiepaneel', () => {
    expect(bron).toContain("const openRelatieKoppelen = () => scrollNaar('vastgoedkans-relatiekoppeling');");
    expect(bron).toContain('onOpenRelatieKoppelen={openRelatieKoppelen}');
  });

  it('toont niet meer de oude volgende-tranche-melding', () => {
    expect(bron).not.toContain('De gedeelde CRM-relatiekoppeling wordt in een volgende tranche aangesloten.');
  });
});
