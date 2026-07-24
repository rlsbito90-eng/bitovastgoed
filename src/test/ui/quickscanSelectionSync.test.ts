import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('quickscan selection synchronization', () => {
  it('isoleert detailstate per geselecteerde quickscan en negeert vertraagde responses', () => {
    const tabCode = readFileSync(
      resolve(process.cwd(), 'src/components/vastgoedrekenen/VastgoedrekenenTab.tsx'),
      'utf8',
    );
    const hookCode = readFileSync(
      resolve(process.cwd(), 'src/hooks/useVastgoedrekenen.tsx'),
      'utf8',
    );

    expect(tabCode).toContain('key={active}');
    expect(tabCode).toContain('calculationId={active}');
    expect(hookCode).toContain('const requestIdRef = useRef(0)');
    expect(hookCode).toContain('if (requestId !== requestIdRef.current) return;');
    expect(hookCode).toContain('setCalculation(null);');
    expect(hookCode).toContain('setScenarios([]);');
    expect(hookCode).toContain('requestIdRef.current += 1;');
  });
});
