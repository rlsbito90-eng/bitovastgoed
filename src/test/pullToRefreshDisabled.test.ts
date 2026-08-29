import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/PullToRefresh.tsx'),
  'utf8',
);

describe('PullToRefresh legacy wrapper', () => {
  it('registreert geen mobiele pull-to-refresh gesture of banner meer', () => {
    expect(source).not.toContain('touchstart');
    expect(source).not.toContain('touchmove');
    expect(source).not.toContain('useAppRefresh');
    expect(source).not.toContain('Trek omlaag om te vernieuwen');
    expect(source).not.toContain('Loslaten om te vernieuwen');
  });

  it('laat de bestaande app-layout zonder gedragswijziging door', () => {
    expect(source).toContain('return <>{children}</>;');
  });
});
