import { describe, expect, it } from 'vitest';
import { bepaalPostCopyProfiel, kiesCopyVariant, type CopyVariantDefinitie } from '@/lib/acquisitie/copyExperimenten';

const basisSignaal = {
  vergunningtype: null,
  potentiele_strategie: null,
  assettype: 'wonen',
} as any;

describe('acquisitie copy-experimenten', () => {
  it('leidt operationele profielen af uit het signaal', () => {
    expect(bepaalPostCopyProfiel({ ...basisSignaal, vergunningtype: 'splitsing' })).toBe('splitsingspotentie');
    expect(bepaalPostCopyProfiel({ ...basisSignaal, vergunningtype: 'woonvorming' })).toBe('woonvorming');
    expect(bepaalPostCopyProfiel({ ...basisSignaal, vergunningtype: 'transformatie' })).toBe('transformatie_herontwikkeling');
    expect(bepaalPostCopyProfiel({ ...basisSignaal, assettype: 'kantoor' })).toBe('commercieel_vastgoed');
  });

  it('houdt niet-geactiveerde experimenten op controlevariant A', () => {
    const keuze = kiesCopyVariant({
      profiel: 'transformatie_herontwikkeling', kanaal: 'post', campagneStap: 'brief_1', signaalId: 'signaal-1', geadresseerdeKey: 'eigenaar-1',
    });
    expect(keuze.variantCode).toBe('A');
    expect(keuze.variantKey).toBe('transformatie_herontwikkeling:post:brief_1:A');
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

  it.each(['brief_1', 'brief_2'])('verdeelt Woonvorming Post %s stabiel over A en B', (campagneStap) => {
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
