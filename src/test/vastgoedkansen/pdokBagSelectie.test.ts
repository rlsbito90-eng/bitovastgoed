import { describe, expect, it } from 'vitest';
import { bboxUitGeometrie } from '@/lib/pdokBagSelectie';

describe('bboxUitGeometrie', () => {
  it('leest WKT polygonen uit de Locatieserver', () => {
    expect(bboxUitGeometrie('POLYGON((4.7 52.2,5.1 52.2,5.1 52.5,4.7 52.5,4.7 52.2))')).toEqual([4.7, 52.2, 5.1, 52.5]);
  });

  it('leest WKT multipolygonen met SRID', () => {
    expect(bboxUitGeometrie('SRID=4326;MULTIPOLYGON(((4 52,5 52,5 53,4 53,4 52)),((6 51,7 51,7 52,6 52,6 51)))')).toEqual([4, 51, 7, 53]);
  });

  it('blijft GeoJSON ondersteunen', () => {
    expect(bboxUitGeometrie({ type: 'Polygon', coordinates: [[[4, 52], [5, 52], [5, 53], [4, 53], [4, 52]]] })).toEqual([4, 52, 5, 53]);
  });
});
