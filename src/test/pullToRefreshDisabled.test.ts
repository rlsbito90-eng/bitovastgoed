import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/PullToRefresh.tsx'),
  'utf8',
);

describe('PullToRefresh legacy wrapper', () => {
  it('registreert geen mobiele pull-to-refresh gesture meer', () => {
    expect(source).not.toContain('addEventListener');
    expect(source).not.toContain('preventDefault');
    expect(source).not.toContain('useAppRefresh');
    expect(source).not.toContain('useIsMobile');
  });

  it('laat de bestaande app-layout zonder gedragswijziging door', () => {
    expect(source).toContain('return <>{children}</>;');
  });
});
