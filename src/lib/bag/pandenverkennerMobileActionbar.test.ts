import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const component = readFileSync(
  resolve(process.cwd(), 'src/components/bag/BagServicePandenlijst.tsx'),
  'utf8',
);

describe('BAG Pandenverkenner mobiele selectie-actiebalk', () => {
  it('stapelt selectie-acties op smalle schermen en houdt desktop compact', () => {
    expect(component).toContain('flex flex-col gap-3 border-b p-4 sm:flex-row');
    expect(component).toContain('grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap');
    expect(component).toContain('className="w-full sm:w-auto"');
    expect(component).toContain('Controleer selectie');
  });
});
