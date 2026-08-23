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

  it('valt voor Brief 1 controle A terug op de bestaande standaardbrief met open opvolglogica', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'splitsingspotentie',
        variantKey: 'splitsingspotentie:post:brief_1:A',
        variantCode: 'A',
      },
    });

    expect(template.brieftekst).toContain('professionele beleggers, ontwikkelaars en vastgoedondernemers');
    expect(template.brieftekst).toContain('kom eventueel op een later moment nog eens bij u terug');
    expect(template.brieftekst).not.toContain('als niet verzonden beschouwen');
  });

  it('bouwt voor Splitsingspotentie Brief 2 een echte follow-up als controle A', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'splitsingspotentie',
        variantKey: 'splitsingspotentie:post:brief_2:A',
        variantCode: 'A',
      },
    });

    expect(template.onderwerp).toBe('Nogmaals over het vastgoed aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Enige tijd geleden stuurde ik u een brief');
    expect(template.brieftekst).toContain('daarom neem ik kort opnieuw contact met u op');
    expect(template.brieftekst).toContain('mogelijke splitsings- of uitpondingspotentie');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).not.toContain('laatste keer');
    expect(template.brieftekst).not.toContain('nog eenmaal');
  });

  it('bouwt de compacte Splitsingspotentie Brief 2 challenger B met rustige objectgerichte onderwerpregel', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'splitsingspotentie',
        variantKey: 'splitsingspotentie:post:brief_2:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Enige tijd geleden schreef ik u over Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('mogelijke splitsings- of uitpondingspotentie');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
    expect(template.brieftekst).not.toContain('denk ik graag vrijblijvend met u mee');
    expect(template.brieftekst).not.toContain('laatste keer');
    expect(template.brieftekst).not.toContain('nog eenmaal');
  });
});
