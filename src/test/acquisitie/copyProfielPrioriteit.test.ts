import { describe, expect, it } from 'vitest';
import { bepaalPostCopyProfiel } from '@/lib/acquisitie/copyExperimenten';

describe('Radar copyprofiel prioriteit', () => {
  it('laat woonvorming winnen van een stale Splitsingspotentie-strategie', () => {
    expect(bepaalPostCopyProfiel({
      vergunningtype: 'woonvorming',
      potentiele_strategie: 'Splitsingspotentie',
      assettype: 'wonen',
      titel: 'Aanvraag woonvormingsvergunning Ceintuurbaan 314-2 1072GL Amsterdam',
      omschrijving: 'het vormen van 1 zelfstandige woonruimte op de zolderverdieping',
    })).toBe('woonvorming');
  });

  it('laat sterke woonvormingstekst winnen van een stale splitsstrategie als vergunningtype niet specifiek is', () => {
    expect(bepaalPostCopyProfiel({
      vergunningtype: 'overig',
      potentiele_strategie: 'Splitsingspotentie',
      assettype: 'wonen',
      titel: 'Aanvraag woonvormingsvergunning Voorbeeldstraat 10 Amsterdam',
      omschrijving: 'Vergunning voor woningvormen',
    })).toBe('woonvorming');
  });

  it('houdt een echte splitsing op splitsingspotentie', () => {
    expect(bepaalPostCopyProfiel({
      vergunningtype: 'splitsing',
      potentiele_strategie: null,
      assettype: 'wonen',
      titel: 'Aanvraag splitsingsvergunning Voorbeeldstraat 11 Amsterdam',
      omschrijving: 'het bouwkundig splitsen van de woning',
    })).toBe('splitsingspotentie');
  });

  it('routeert een verkeerd opgeslagen ontwikkeling met duidelijke splitstekst alsnog naar splitsing', () => {
    expect(bepaalPostCopyProfiel({
      vergunningtype: 'ontwikkeling',
      potentiele_strategie: null,
      assettype: 'wonen',
      titel: 'Omgevingsvergunning Voorbeeldstraat 12 Amsterdam',
      omschrijving: 'het splitsen van een appartement naar drie appartementen',
    })).toBe('splitsingspotentie');
  });

  it('houdt omzetting op kamerverhuur ondanks andere afgeleide velden', () => {
    expect(bepaalPostCopyProfiel({
      vergunningtype: 'omzetting',
      potentiele_strategie: 'Splitsingspotentie',
      assettype: 'wonen',
      titel: 'Aanvraag omzettingsvergunning Voorbeeldstraat 13 Amsterdam',
      omschrijving: 'omzetten naar onzelfstandige woonruimte',
    })).toBe('kamerverhuur_verhuur_exploitatieoptimalisatie');
  });

  it('houdt functiewijziging op transformatie/herontwikkeling', () => {
    expect(bepaalPostCopyProfiel({
      vergunningtype: 'functiewijziging',
      potentiele_strategie: 'Splitsingspotentie',
      assettype: 'transformatieobject',
      titel: 'Functiewijziging kantoor naar wonen',
      omschrijving: 'wijzigen van het gebruik',
    })).toBe('transformatie_herontwikkeling');
  });
});
