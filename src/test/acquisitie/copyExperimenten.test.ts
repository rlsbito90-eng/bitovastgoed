import { describe, expect, it } from 'vitest';
import { bepaalPostCopyProfiel, kiesCopyVariant, type CopyVariantDefinitie } from '@/lib/acquisitie/copyExperimenten';

const basisSignaal = {
  vergunningtype: null,
  potentiele_strategie: null,
  assettype: 'wonen',
  titel: '',
  omschrijving: '',
} satisfies Parameters<typeof bepaalPostCopyProfiel>[0];

describe('acquisitie copy-experimenten', () => {
  it('leidt operationele profielen af uit het signaal', () => {
    expect(bepaalPostCopyProfiel({ ...basisSignaal, vergunningtype: 'splitsing' })).toBe('splitsingspotentie');
    expect(bepaalPostCopyProfiel({ ...basisSignaal, vergunningtype: 'woonvorming' })).toBe('woonvorming');
    expect(bepaalPostCopyProfiel({ ...basisSignaal, vergunningtype: 'omzetting' })).toBe('kamerverhuur_verhuur_exploitatieoptimalisatie');
    expect(bepaalPostCopyProfiel({ ...basisSignaal, vergunningtype: 'transformatie' })).toBe('transformatie_herontwikkeling');
    expect(bepaalPostCopyProfiel({ ...basisSignaal, assettype: 'kantoor' })).toBe('commercieel_vastgoed');
  });

  it('herstelt historische splitsingssignalen die als ontwikkeling zijn opgeslagen', () => {
    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'ontwikkeling',
      titel: 'Aangevraagde omgevingsvergunning, Westersingel 30 3014GR Rotterdam',
      omschrijving: 'Het splitsen van het appartement op verdieping 1,2 en 3 naar 3 appartementen.',
    })).toBe('splitsingspotentie');

    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'ontwikkeling',
      omschrijving: 'bouwkundig splitsen van het woonappartement in twee woonappartementen',
    })).toBe('splitsingspotentie');
  });

  it('routeert herontwikkeling en transformatie vóór ontwikkeling', () => {
    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'ontwikkeling',
      assettype: 'transformatieobject',
      omschrijving: 'Herontwikkeling van het bestaande pand naar wonen',
    })).toBe('transformatie_herontwikkeling');

    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'ontwikkeling',
      omschrijving: 'Het verbouwen van een woning naar 7 appartementen',
    })).toBe('transformatie_herontwikkeling');
  });

  it('behandelt het losse woord appartement niet meer als voldoende bewijs voor ontwikkeling', () => {
    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'ontwikkeling',
      omschrijving: 'Het appartement wordt intern aangepast en de entree wordt verplaatst.',
    })).toBe('algemene_acquisitie');

    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'ontwikkeling',
      omschrijving: 'Kappen van een boom tussen de appartementencomplexen.',
    })).toBe('algemene_acquisitie');
  });

  it('houdt echte ontwikkelsignalen op Ontwikkellocatie', () => {
    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'ontwikkeling',
      omschrijving: 'Het bouwen van 23 appartementen en kantoorruimtes',
    })).toBe('ontwikkellocatie');

    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'ontwikkeling',
      omschrijving: 'Nieuwbouw van twee woongebouwen met 100 appartementen',
    })).toBe('ontwikkellocatie');
  });

  it('houdt onttrekking bewust buiten de kamerverhuurroute', () => {
    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: 'onttrekking',
      omschrijving: 'Onttrekkingsvergunning voor een tweede woning',
    })).toBe('algemene_acquisitie');
  });

  it('herkent kamerverhuurtermen ook wanneer het opgeslagen vergunningtype ontbreekt', () => {
    expect(bepaalPostCopyProfiel({
      ...basisSignaal,
      vergunningtype: null,
      omschrijving: 'Aanvraag kamerverhuurvergunning voor kamergewijze verhuur',
    })).toBe('kamerverhuur_verhuur_exploitatieoptimalisatie');
  });

  it('houdt niet-geactiveerde experimenten op controlevariant A', () => {
    const keuze = kiesCopyVariant({
      profiel: 'transformatie_herontwikkeling', kanaal: 'email', campagneStap: 'email_1', signaalId: 'signaal-1', geadresseerdeKey: 'eigenaar-1',
    });
    expect(keuze.variantCode).toBe('A');
    expect(keuze.variantKey).toBe('transformatie_herontwikkeling:email:email_1:A');
    expect(keuze.hypothese).toContain('controlevariant');
  });

  it.each(['brief_1', 'brief_2', 'brief_3'])('verdeelt Splitsingspotentie Post %s stabiel over A en B', (campagneStap) => {
    const identiteiten = [
      ['signaal-1', 'eigenaar-1'], ['signaal-1', 'xyz'], ['abc', 'eigenaar-1'], ['abc', 'xyz'],
      ['s1', 'jan'], ['s1', 'bedrijf'], ['signaal-a', 'a'], ['123', 'b'],
    ];
    const codes = new Set<string>();

    for (const [signaalId, geadresseerdeKey] of identiteiten) {
      const args = {
        profiel: 'splitsingspotentie', kanaal: 'post' as const, campagneStap, signaalId, geadresseerdeKey,
      };
      const keuze = kiesCopyVariant(args);
      codes.add(keuze.variantCode);
      expect(keuze).toEqual(kiesCopyVariant(args));
    }

    expect(codes).toEqual(new Set(['A', 'B']));
  });

  it.each(['brief_1', 'brief_2', 'brief_3'])('verdeelt Woonvorming Post %s stabiel over A en B', (campagneStap) => {
    const identiteiten = [
      ['signaal-1', 'eigenaar-1'], ['signaal-1', 'xyz'], ['abc', 'eigenaar-1'], ['abc', 'xyz'],
      ['s1', 'jan'], ['s1', 'bedrijf'], ['signaal-a', 'a'], ['123', 'b'],
    ];
    const codes = new Set<string>();

    for (const [signaalId, geadresseerdeKey] of identiteiten) {
      const args = {
        profiel: 'woonvorming', kanaal: 'post' as const, campagneStap, signaalId, geadresseerdeKey,
      };
      const keuze = kiesCopyVariant(args);
      codes.add(keuze.variantCode);
      expect(keuze).toEqual(kiesCopyVariant(args));
    }

    expect(codes).toEqual(new Set(['A', 'B']));
  });

  it.each(['brief_1', 'brief_2', 'brief_3'])('verdeelt Transformatie / herontwikkeling Post %s stabiel over A en B', (campagneStap) => {
    const identiteiten = [
      ['signaal-1', 'eigenaar-1'], ['signaal-1', 'xyz'], ['abc', 'eigenaar-1'], ['abc', 'xyz'],
      ['s1', 'jan'], ['s1', 'bedrijf'], ['signaal-a', 'a'], ['123', 'b'],
    ];
    const codes = new Set<string>();

    for (const [signaalId, geadresseerdeKey] of identiteiten) {
      const args = {
        profiel: 'transformatie_herontwikkeling', kanaal: 'post' as const, campagneStap, signaalId, geadresseerdeKey,
      };
      const keuze = kiesCopyVariant(args);
      codes.add(keuze.variantCode);
      expect(keuze).toEqual(kiesCopyVariant(args));
    }

    expect(codes).toEqual(new Set(['A', 'B']));
  });

  it('respecteert expliciet aangeleverde varianten voor toekomstige experimenten', () => {
    const varianten: CopyVariantDefinitie[] = [
      { code: 'A', naam: 'Controle', hypothese: 'controle', actief: true },
      { code: 'B', naam: 'Kort/direct', hypothese: 'kortere tekst verhoogt respons', actief: true },
    ];
    const args = {
      profiel: 'splitsingspotentie', kanaal: 'email' as const, campagneStap: 'email_1', signaalId: 'abc', geadresseerdeKey: 'xyz', varianten,
    };
    expect(kiesCopyVariant(args)).toEqual(kiesCopyVariant(args));
  });
});
