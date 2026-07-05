// Fase 2C-2b Slice B1 — ObjectDetailPage gebruikt assetclass-afhankelijke
// m²-bron via `getBerekenM2Bron(object, object.type)`.
//
// Deze test verifieert het contract dat ObjectDetailPage gebruikt om de
// m²-bron te kiezen en het bijbehorende hint-label op te bouwen, zonder de
// zware pagina zelf te renderen. De page code past dezelfde helper en
// dezelfde hint-regels toe (zie ObjectDetailPage.tsx: `m2BronHint`).

import { describe, it, expect } from 'vitest';
import { getBerekenM2Bron } from '@/lib/derivations/financial';

// Kopie van de hint-builder zoals in ObjectDetailPage. Wijzigt de UI de regels,
// dan moet deze test mee-updaten — dat is exact het contract dat we bewaken.
function buildM2BronHint(
  object: { type?: string | null; oppervlakteVvo?: number | null; oppervlakteGbo?: number | null; oppervlakte?: number | null; oppervlakteBvo?: number | null },
): string | undefined {
  const res = getBerekenM2Bron(object, object.type ?? null);
  if (res.bron === 'none') return undefined;
  const parts: string[] = [res.label];
  if (res.fallback) parts.push('primaire bron ontbreekt, fallback gebruikt');
  if (object.type === 'zorgvastgoed') parts.push('marktstandaard varieert');
  else if (object.type === 'mixed_use') parts.push('mixed-use, componentsplitsing volgt');
  return parts.join(' · ');
}

describe('ObjectDetailPage — assetclass-afhankelijke m²-bron', () => {
  it('wonen met GBO én VVO kiest bewust GBO', () => {
    const obj = { type: 'wonen', oppervlakteGbo: 90, oppervlakteVvo: 100 };
    expect(getBerekenM2Bron(obj, obj.type).m2).toBe(90);
    expect(buildM2BronHint(obj)).toBe('GBO gebruikt');
  });

  it('wonen zonder GBO valt terug op VVO met fallback-label', () => {
    const obj = { type: 'wonen', oppervlakteVvo: 100 };
    const res = getBerekenM2Bron(obj, obj.type);
    expect(res.m2).toBe(100);
    expect(res.bron).toBe('vvo');
    expect(buildM2BronHint(obj)).toContain('VVO gebruikt');
    expect(buildM2BronHint(obj)).toContain('primaire bron ontbreekt');
  });

  it('kantoren gebruikt VVO — commercieel object blijft inhoudelijk gelijk aan pre-B1', () => {
    const obj = { type: 'kantoren', oppervlakteVvo: 500, oppervlakteGbo: 480 };
    expect(getBerekenM2Bron(obj, obj.type).m2).toBe(500);
    expect(buildM2BronHint(obj)).toBe('VVO gebruikt');
  });

  it('winkels zonder VVO maar met GBO valt terug op GBO', () => {
    const obj = { type: 'winkels', oppervlakteGbo: 220 };
    const res = getBerekenM2Bron(obj, obj.type);
    expect(res.m2).toBe(220);
    expect(res.bron).toBe('gbo');
    expect(buildM2BronHint(obj)).toContain('GBO gebruikt');
    expect(buildM2BronHint(obj)).toContain('primaire bron ontbreekt');
  });

  it('alleen BVO → geen berekende m² en geen hint (BVO is uitgesloten)', () => {
    const obj = { type: 'kantoren', oppervlakteBvo: 800 };
    // BVO staat bewust NIET in M2Object en telt in geen enkele fallback.
    expect(getBerekenM2Bron({}, obj.type).m2).toBeNull();
    expect(buildM2BronHint(obj)).toBeUndefined();
  });

  it('ontwikkellocatie toont geen m² en geen berekende €/m² of huur/m²', () => {
    const obj = { type: 'ontwikkellocatie', oppervlakteVvo: 1000, oppervlakteGbo: 900, oppervlakte: 800 };
    const res = getBerekenM2Bron(obj, obj.type);
    expect(res.m2).toBeNull();
    expect(res.bron).toBe('none');
    expect(buildM2BronHint(obj)).toBeUndefined();
  });

  it('zorgvastgoed toont marktstandaard-kanttekening bij bronlabel', () => {
    const obj = { type: 'zorgvastgoed', oppervlakteVvo: 600 };
    expect(buildM2BronHint(obj)).toBe('VVO gebruikt · marktstandaard varieert');
  });

  it('mixed_use toont componentsplitsing-kanttekening bij bronlabel', () => {
    const obj = { type: 'mixed_use', oppervlakteVvo: 700 };
    expect(buildM2BronHint(obj)).toBe('VVO gebruikt · mixed-use, componentsplitsing volgt');
  });

  it('onbekende/lege type valt terug op Fase 2A default (VVO-first) — backwards compatible', () => {
    const obj = { type: null, oppervlakteVvo: 500, oppervlakteGbo: 400 };
    expect(getBerekenM2Bron(obj, obj.type).m2).toBe(500);
  });
});
