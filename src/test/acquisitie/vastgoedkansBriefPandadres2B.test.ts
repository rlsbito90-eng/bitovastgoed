import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = fs.readFileSync(
  path.join(process.cwd(), 'src/components/acquisitie/VastgoedkansConceptbriefKaart.tsx'),
  'utf8',
);

describe('BUILD 2.0B — pandadres en eigenaaradres blijven gescheiden', () => {
  it('gebruikt bij BAG-pandniveau zonder vaste VBO het pandadres voor onderwerp en brieftekst', () => {
    expect(bron).toContain('function pandAdresVoorBrief');
    expect(bron).toContain("replace(/-(?:H|[1-4])$/i, '')");
    expect(bron).toContain('Boolean(kans?.bagPandId)');
    expect(bron).toContain('Boolean(kans?.bagVerblijfsobjectId)');
    expect(bron).toContain('bepaalOnderwerp(objectomschrijving)');
    expect(bron).toContain('bouwBriefTekst({ aanhef, objectadres: objectomschrijving })');
  });

  it('houdt het correspondentieadres uitsluitend in de geadresseerdevelden', () => {
    expect(bron).toContain('const verzendadres = [eigenaar.adres?.trim(), plaatsregel]');
    expect(bron).toContain('setVerzendadres(velden.verzendadres)');
    expect(bron).not.toContain('bepaalOnderwerp(velden.verzendadres)');
  });

  it('formatteert Nederlandse postcode en plaats leesbaar voor de brief', () => {
    expect(bron).toContain('function formatteerPostcode');
    expect(bron).toContain("`${compact.slice(0, 4)} ${compact.slice(4)}`");
    expect(bron).toContain('function formatteerPlaats');
  });

  it('toont de textarea-placeholder als echte regelovergang', () => {
    expect(bron).toContain("placeholder={'Straat en huisnummer\\nPostcode en plaats'}");
  });
});
