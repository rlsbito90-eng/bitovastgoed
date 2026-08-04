import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const component = readFileSync(
  resolve(process.cwd(), 'src/components/bag/BagServicePandenlijst.tsx'),
  'utf8',
);

describe('private BAG Google Maps-actie', () => {
  it('opent Google Maps op het leesbare BAG-adres', () => {
    expect(component).toContain('bouwGoogleMapsAdresUrl');
    expect(component).toContain('adres: pand.adres');
    expect(component).toContain('postcode: pand.postcode');
    expect(component).toContain('plaats: pand.plaats');
    expect(component).toContain('Open adres in Google Maps');
    expect(component).toContain('target="_blank"');
    expect(component).toContain('rel="noreferrer"');
  });
});
