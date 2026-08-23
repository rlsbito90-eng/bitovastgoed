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
      profiel: 'woonvorming', kanaal: 'post', campagneStap: 'brief_1', signaalId: 'signaal-1', geadresseerdeKey: 'eigenaar-1',
    });
    expect(keuze.variantCode).toBe('A');
    expect(keuze.variantKey).toBe('woonvorming:post:brief_1:A');
    expect(keuze.hypothese).toContain('controlevariant');
  });

  it('verdeelt Splitsingspotentie Post Brief 1 stabiel over A en B', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const keuze = kiesCopyVariant({
        profiel: 'splitsingspotentie',
        kanaal: 'post',
        campagneStap: 'brief_1',
        signaalId: `signaal-${i}`,
        geadresseerdeKey: `eigenaar-${i}`,
      });
      codes.add(keuze.variantCode);
      expect(keuze).toEqual(kiesCopyVariant({
        profiel: 'splitsingspotentie',
        kanaal: 'post',
        campagneStap: 'brief_1',
        signaalId: `signaal-${i}`,
        geadresseerdeKey: `eigenaar-${i}`,
      }));
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
