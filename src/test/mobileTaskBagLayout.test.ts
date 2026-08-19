import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const taken = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');
const bag = readFileSync(resolve(process.cwd(), 'src/components/offmarket/bag/BagMatchResolver.tsx'), 'utf8');

describe('mobiele CRM-layout', () => {
  it('zet taakinhoud en badges op mobiel in aparte grid-rijen', () => {
    expect(taken).toContain('grid grid-cols-[auto,minmax(0,1fr)]');
    expect(taken).toContain('col-start-2 row-start-2 flex min-w-0 flex-wrap');
    expect(taken).toContain('data-testid="taken-lijstregel"');
  });

  it('stapelt BAG-match inhoud en acties op mobiel', () => {
    expect(bag).toContain('flex flex-col sm:flex-row');
    expect(bag).toContain('w-full sm:w-auto');
    expect(bag).toContain('[overflow-wrap:anywhere]');
    expect(bag).toContain('overflow-hidden');
  });
});
