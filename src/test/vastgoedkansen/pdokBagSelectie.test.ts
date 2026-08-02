import { describe, expect, it } from 'vitest';
import { bboxUitGeometrie, puntInGemeente } from '@/lib/pdokBagSelectie';

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

describe('puntInGemeente', () => {
  const contour: [number, number][][] = [[[4, 52], [5, 52], [5, 53], [4, 53], [4, 52]]];

  it('laat een pand binnen de gemeentecontour door', () => {
    expect(puntInGemeente([4.5, 52.5], contour)).toBe(true);
  });

  it('sluit een pand buiten de gemeentecontour uit, ook als het binnen de bounding box-selectie van een buurgebied zat', () => {
    expect(puntInGemeente([5.2, 52.5], contour)).toBe(false);
  });

  it('respecteert een gat in een contour via de even-odd-regel', () => {
    const metGat: [number, number][][] = [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ];
    expect(puntInGemeente([5, 5], metGat)).toBe(false);
    expect(puntInGemeente([2, 2], metGat)).toBe(true);
  });
});
