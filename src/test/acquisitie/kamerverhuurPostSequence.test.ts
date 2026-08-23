import { describe, expect, it } from 'vitest';
import { bouwPostVariantTemplate } from '@/lib/acquisitie/postCopyVarianten';
import { bepaalPostCopyProfiel, kiesCopyVariant } from '@/lib/acquisitie/copyExperimenten';

const basis = {
  aanhef: 'Geachte heer/mevrouw,',
  objectomschrijving: 'Voorbeeldstraat 10 te Amsterdam',
};

const profiel = 'kamerverhuur_verhuur_exploitatieoptimalisatie';

describe('Kamerverhuur / exploitatie · Post', () => {
  it('routeert omzettings- en kamerverhuursignalen naar het juiste profiel', () => {
    const gemeen = {
      potentiele_strategie: null,
      assettype: 'wonen',
      titel: '',
      omschrijving: '',
    } as const;

    expect(bepaalPostCopyProfiel({ ...gemeen, vergunningtype: 'omzetting' })).toBe(profiel);
    expect(bepaalPostCopyProfiel({
      ...gemeen,
      vergunningtype: null,
      titel: 'Aanvraag kamerverhuurvergunning Voorbeeldstraat 10',
      omschrijving: 'kamergewijze verhuur aan onzelfstandige woonruimten',
    })).toBe(profiel);
  });

  it.each(['brief_1', 'brief_2', 'brief_3'])('verdeelt %s stabiel over A en B', (campagneStap) => {
    const identiteiten = [
      ['signaal-1', 'eigenaar-1'], ['signaal-1', 'xyz'], ['abc', 'eigenaar-1'], ['abc', 'xyz'],
      ['s1', 'jan'], ['s1', 'bedrijf'], ['signaal-a', 'a'], ['123', 'b'],
    ];
    const codes = new Set<string>();

    for (const [signaalId, geadresseerdeKey] of identiteiten) {
      const args = { profiel, kanaal: 'post' as const, campagneStap, signaalId, geadresseerdeKey };
      const keuze = kiesCopyVariant(args);
      codes.add(keuze.variantCode);
      expect(keuze).toEqual(kiesCopyVariant(args));
    }

    expect(codes).toEqual(new Set(['A', 'B']));
  });

  it('bouwt Brief 1-A met expliciete omzettings-/kamerverhuurcontext', () => {
    const t = bouwPostVariantTemplate({
      ...basis,
      toewijzing: { profiel, variantKey: `${profiel}:post:brief_1:A`, variantCode: 'A' },
    });
    expect(t.onderwerp).toBe('Interesse in uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(t.brieftekst).toContain('omzetting, kamerverhuur of woningdelen');
    expect(t.brieftekst).toContain('Dat hoeft uiteraard niets te zeggen over eventuele verkoopplannen');
    expect(t.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
  });

  it('bouwt Brief 1-B korter en directer', () => {
    const t = bouwPostVariantTemplate({
      ...basis,
      toewijzing: { profiel, variantKey: `${profiel}:post:brief_1:B`, variantCode: 'B' },
    });
    expect(t.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(t.brieftekst).toContain('omzetting, kamerverhuur of woningdelen');
    expect(t.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
    expect(t.brieftekst).not.toContain('bredere vastgoedbeslissing');
  });

  it('bouwt Brief 2-A als herkenbare follow-up en Brief 2-B zonder herhaling van vergunningcontext', () => {
    const a = bouwPostVariantTemplate({
      ...basis,
      toewijzing: { profiel, variantKey: `${profiel}:post:brief_2:A`, variantCode: 'A' },
    });
    const b = bouwPostVariantTemplate({
      ...basis,
      toewijzing: { profiel, variantKey: `${profiel}:post:brief_2:B`, variantCode: 'B' },
    });

    expect(a.onderwerp).toBe('Nogmaals over uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(a.brieftekst).toContain('omzetting, kamerverhuur of woningdelen');
    expect(a.brieftekst).toContain('daarom neem ik kort opnieuw contact met u op');

    expect(b.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(b.brieftekst).toContain('Enige tijd geleden schreef ik u over Voorbeeldstraat 10 te Amsterdam');
    expect(b.brieftekst).not.toContain('omzetting, kamerverhuur of woningdelen');
    expect(b.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
  });

  it('bouwt Brief 3-A als rustige afsluiting en Brief 3-B als compacte nurture-afsluiting', () => {
    const a = bouwPostVariantTemplate({
      ...basis,
      toewijzing: { profiel, variantKey: `${profiel}:post:brief_3:A`, variantCode: 'A' },
    });
    const b = bouwPostVariantTemplate({
      ...basis,
      toewijzing: { profiel, variantKey: `${profiel}:post:brief_3:B`, variantCode: 'B' },
    });

    expect(a.onderwerp).toBe('Over uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(a.brieftekst).toContain('omzetting, kamerverhuur of woningdelen');
    expect(a.brieftekst).toContain('laat ik het voor nu hierbij');
    expect(a.brieftekst).toContain('Mocht dat in de toekomst veranderen');

    expect(b.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(b.brieftekst).toContain('Ik kom nog even terug op Voorbeeldstraat 10 te Amsterdam');
    expect(b.brieftekst).not.toContain('omzetting, kamerverhuur of woningdelen');
    expect(b.brieftekst).toContain('laat ik het voor nu rusten');
    expect(b.brieftekst).toContain('Verandert dat op een later moment, dan weet u mij te vinden');
  });
});
