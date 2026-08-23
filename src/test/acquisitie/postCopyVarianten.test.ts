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

  it('bouwt Splitsingspotentie Brief 3 als gecontroleerde afsluiting met ruimte voor nurture', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'splitsingspotentie',
        variantKey: 'splitsingspotentie:post:brief_3:A',
        variantCode: 'A',
      },
    });

    expect(template.onderwerp).toBe('Over uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Ik neem nog één keer kort contact met u op');
    expect(template.brieftekst).toContain('mogelijke splitsings- of uitpondingspotentie');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('laat ik het voor nu hierbij');
    expect(template.brieftekst).toContain('Mocht dat in de toekomst veranderen');
    expect(template.brieftekst).not.toContain('nooit meer');
    expect(template.brieftekst).not.toContain('definitief');
  });

  it('bouwt de goedgekeurde compacte Splitsingspotentie Brief 3 challenger B', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'splitsingspotentie',
        variantKey: 'splitsingspotentie:post:brief_3:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toBe([
      'Geachte heer/mevrouw,',
      '',
      'Nog één keer kort over Voorbeeldstraat 10 te Amsterdam, gezien de mogelijke splitsings- of uitpondingspotentie ervan.',
      '',
      'Speelt verkoop van dit pand, ander vastgoed of een bredere portefeuille nu of op termijn, dan kom ik graag vrijblijvend met u in contact.',
      '',
      'Speelt dit op dit moment niet, dan laat ik het voor nu rusten. Verandert dat op een later moment, dan weet u mij te vinden.',
      '',
      'Interesse? Een kort telefoongesprek of e-mail is voldoende.',
      '',
      'Met vriendelijke groet,',
      '',
      'Ramysh Bito',
      'Eigenaar & Vastgoedadviseur',
      'Bito Vastgoed',
      '',
      'T: +31 6 16 98 76 06',
      'E: info@bitovastgoed.nl',
      'W: www.bitovastgoed.nl',
    ].join('\n'));
    expect(template.brieftekst).not.toContain('denk ik graag vrijblijvend met u mee');
    expect(template.brieftekst).not.toContain('laat ik het hier rusten');
  });

  it('bouwt Woonvorming Brief 1 controle A met expliciete context en relativering', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'woonvorming',
        variantKey: 'woonvorming:post:brief_1:A',
        variantCode: 'A',
      },
    });

    expect(template.onderwerp).toBe('Interesse in uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('woonvormingsontwikkeling of -vergunning gesignaleerd');
    expect(template.brieftekst).toContain('Dat hoeft uiteraard niets te zeggen over eventuele verkoopplannen');
    expect(template.brieftekst).toContain('bredere vastgoedbeslissing of herpositionering');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('kom eventueel op een later moment nog eens bij u terug');
  });

  it('bouwt Woonvorming Brief 1 challenger B als kortere objectgerichte variant', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'woonvorming',
        variantKey: 'woonvorming:post:brief_1:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Rond Voorbeeldstraat 10 te Amsterdam is een woonvormingsontwikkeling of -vergunning gesignaleerd');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
    expect(template.brieftekst).not.toContain('bredere vastgoedbeslissing of herpositionering');
    expect(template.brieftekst).not.toContain('denk ik graag vrijblijvend met u mee');
  });

  it('bouwt Woonvorming Brief 2 controle A als herkenbare follow-up met korte context', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'woonvorming',
        variantKey: 'woonvorming:post:brief_2:A',
        variantCode: 'A',
      },
    });

    expect(template.onderwerp).toBe('Nogmaals over uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Enige tijd geleden schreef ik u over Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('woonvormingsontwikkeling of -vergunning rond het object');
    expect(template.brieftekst).toContain('daarom neem ik kort opnieuw contact met u op');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).not.toContain('laatste keer');
  });

  it('bouwt de goedgekeurde compacte Woonvorming Brief 2 challenger B', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'woonvorming',
        variantKey: 'woonvorming:post:brief_2:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Enige tijd geleden schreef ik u over Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('voor het geval mijn eerdere brief op een minder geschikt moment kwam');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('kom ik graag vrijblijvend met u in contact');
    expect(template.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
    expect(template.brieftekst).not.toContain('woonvormingsontwikkeling of -vergunning rond het object');
    expect(template.brieftekst).not.toContain('mijn brief u destijds niet bereikte');
    expect(template.brieftekst).not.toContain('denk ik graag vrijblijvend met u mee');
    expect(template.brieftekst).not.toContain('laatste keer');
  });

  it('bouwt Woonvorming Brief 3 controle A als rustige sequence-afsluiting met context', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'woonvorming',
        variantKey: 'woonvorming:post:brief_3:A',
        variantCode: 'A',
      },
    });

    expect(template.onderwerp).toBe('Over uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Ik neem nog één keer kort contact met u op over Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('woonvormingsontwikkeling of -vergunning rond het object');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('laat ik het voor nu hierbij');
    expect(template.brieftekst).toContain('Mocht dat in de toekomst veranderen');
    expect(template.brieftekst).not.toContain('nooit meer');
  });

  it('bouwt de goedgekeurde Woonvorming Brief 3 challenger B met natuurlijke opening', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'woonvorming',
        variantKey: 'woonvorming:post:brief_3:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Ik kom nog even terug op Voorbeeldstraat 10 te Amsterdam, waarover ik u eerder schreef.');
    expect(template.brieftekst).toContain('kom ik graag vrijblijvend met u in contact');
    expect(template.brieftekst).toContain('laat ik het voor nu rusten');
    expect(template.brieftekst).toContain('Verandert dat op een later moment, dan weet u mij te vinden');
    expect(template.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
    expect(template.brieftekst).not.toContain('Nog één keer kort');
    expect(template.brieftekst).not.toContain('woonvormingsontwikkeling of -vergunning rond het object');
    expect(template.brieftekst).not.toContain('denk ik graag vrijblijvend met u mee');
  });

  it('bouwt Transformatie Brief 1 controle A met expliciete context en relativering', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'transformatie_herontwikkeling',
        variantKey: 'transformatie_herontwikkeling:post:brief_1:A',
        variantCode: 'A',
      },
    });

    expect(template.onderwerp).toBe('Interesse in uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('ontwikkeling of vergunning gesignaleerd die betrekking heeft op transformatie, functiewijziging of herontwikkeling');
    expect(template.brieftekst).toContain('Dat hoeft uiteraard niets te zeggen over eventuele verkoopplannen');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('kom eventueel op een later moment nog eens bij u terug');
  });

  it('bouwt Transformatie Brief 1 challenger B als directere commerciële opening', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'transformatie_herontwikkeling',
        variantKey: 'transformatie_herontwikkeling:post:brief_1:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Voorbeeldstraat 10 te Amsterdam — vraag over de mogelijkheden');
    expect(template.brieftekst).toContain('Rond Voorbeeldstraat 10 te Amsterdam is een ontwikkeling of vergunning gesignaleerd met betrekking tot transformatie, functiewijziging of herontwikkeling');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
    expect(template.brieftekst).not.toContain('Dat hoeft uiteraard niets te zeggen over eventuele verkoopplannen');
    expect(template.brieftekst).not.toContain('bredere vastgoedbeslissing of herpositionering');
    expect(template.brieftekst).not.toContain('denk ik graag vrijblijvend met u mee');
  });

  it('bouwt Transformatie Brief 2 controle A als herkenbare follow-up met signaalcontext', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'transformatie_herontwikkeling',
        variantKey: 'transformatie_herontwikkeling:post:brief_2:A',
        variantCode: 'A',
      },
    });

    expect(template.onderwerp).toBe('Nogmaals over uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Enige tijd geleden schreef ik u over Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('ontwikkeling of vergunning rond transformatie, functiewijziging of herontwikkeling');
    expect(template.brieftekst).toContain('daarom neem ik kort opnieuw contact met u op');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).not.toContain('laatste keer');
  });

  it('bouwt Transformatie Brief 2 challenger B zonder herhaling van het signaal', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'transformatie_herontwikkeling',
        variantKey: 'transformatie_herontwikkeling:post:brief_2:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Enige tijd geleden schreef ik u over Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('voor het geval mijn eerdere brief op een minder geschikt moment kwam');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
    expect(template.brieftekst).not.toContain('transformatie, functiewijziging of herontwikkeling');
    expect(template.brieftekst).not.toContain('mijn brief u destijds niet bereikte');
    expect(template.brieftekst).not.toContain('Kort nogmaals —');
  });

  it('bouwt Transformatie Brief 3 controle A als rustige afsluiting met context', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'transformatie_herontwikkeling',
        variantKey: 'transformatie_herontwikkeling:post:brief_3:A',
        variantCode: 'A',
      },
    });

    expect(template.onderwerp).toBe('Over uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Ik neem nog één keer kort contact met u op over Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('transformatie, functiewijziging of herontwikkeling');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('laat ik het voor nu hierbij');
    expect(template.brieftekst).toContain('Mocht dat in de toekomst veranderen');
    expect(template.brieftekst).not.toContain('nooit meer');
  });

  it('bouwt Transformatie Brief 3 challenger B met natuurlijke opening en rustige afronding', () => {
    const template = bouwPostVariantTemplate({
      ...basis,
      toewijzing: {
        profiel: 'transformatie_herontwikkeling',
        variantKey: 'transformatie_herontwikkeling:post:brief_3:B',
        variantCode: 'B',
      },
    });

    expect(template.onderwerp).toBe('Uw pand aan Voorbeeldstraat 10 te Amsterdam');
    expect(template.brieftekst).toContain('Ik kom nog even terug op Voorbeeldstraat 10 te Amsterdam, waarover ik u eerder schreef.');
    expect(template.brieftekst).toContain('ander vastgoed of een bredere portefeuille');
    expect(template.brieftekst).toContain('laat ik het hierbij voor nu rusten');
    expect(template.brieftekst).toContain('Verandert dat op een later moment, dan weet u mij te vinden');
    expect(template.brieftekst).toContain('Een kort telefoongesprek of e-mail is voldoende');
    expect(template.brieftekst).not.toContain('transformatie, functiewijziging of herontwikkeling');
    expect(template.brieftekst).not.toContain('Ik kom graag nog eenmaal terug');
    expect(template.brieftekst).not.toContain('Nog één keer kort');
  });
});
