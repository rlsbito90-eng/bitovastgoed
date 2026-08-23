import { describe, expect, it } from 'vitest';
import { bouwPostVariantTemplate } from '@/lib/acquisitie/postCopyVarianten';

const basis = {
  aanhef: 'Geachte heer/mevrouw,',
  objectomschrijving: 'Voorbeeldstraat 10 te Amsterdam',
};

describe('post copyvarianten', () => {
  it('bouwt de goedgekeurde splitsingspotentie Brief 1 challenger B', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'splitsingspotentie',
        variantKey: 'splitsingspotentie:post:brief_1:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Interesse in het vastgoed aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('mogelijke splitsings- of uitpondingspotentie');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('kom eventueel op een later moment nog eens bij u terug');
    expect(template.brieftekst).not.toContain('als niet verzonden beschouwen');
    expect(template.brieftekst).not.toContain('kosteloos');
  });

  it('valt voor controle A terug op de bestaande standaardbrief', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'splitsingspotentie',
        variantKey: 'splitsingspotentie:post:brief_1:A',
        variantCode: 'A',
      },
    });

    expect(template.brieftekst).toContain('professionele beleggers, ontwikkelaars en vastgoedondernemers');
    expect(template.brieftekst).toContain('als niet verzonden beschouwen');
  });
});
