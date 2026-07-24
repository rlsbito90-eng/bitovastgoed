from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


tab_path = Path('src/components/vastgoedrekenen/VastgoedrekenenTab.tsx')
replace_once(
    tab_path,
    """        <QuickscanDetail
          calculationId={active}""",
    """        <QuickscanDetail
          key={active}
          calculationId={active}""",
)

hook_path = Path('src/hooks/useVastgoedrekenen.tsx')
replace_once(
    hook_path,
    "import { useCallback, useEffect, useState } from 'react';",
    "import { useCallback, useEffect, useRef, useState } from 'react';",
)
replace_once(
    hook_path,
    """  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!calculationId) return;
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      supabase.from('real_estate_calculations').select('*').eq('id', calculationId).maybeSingle(),
      supabase.from('calculation_scenarios').select('*').eq('calculation_id', calculationId).order('created_at', { ascending: true }),
    ]);
    if (cRes.error) toast.error('Kon quickscan niet laden');
    setCalculation((cRes.data as Calculation) ?? null);
    setScenarios((sRes.data ?? []) as Scenario[]);
    setLoading(false);
  }, [calculationId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);""",
    """  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!calculationId) {
      if (requestId !== requestIdRef.current) return;
      setCalculation(null);
      setScenarios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      supabase.from('real_estate_calculations').select('*').eq('id', calculationId).maybeSingle(),
      supabase.from('calculation_scenarios').select('*').eq('calculation_id', calculationId).order('created_at', { ascending: true }),
    ]);
    if (requestId !== requestIdRef.current) return;
    if (cRes.error) toast.error('Kon quickscan niet laden');
    setCalculation((cRes.data as Calculation) ?? null);
    setScenarios((sRes.data ?? []) as Scenario[]);
    setLoading(false);
  }, [calculationId]);

  useEffect(() => {
    setCalculation(null);
    setScenarios([]);
    setLoading(true);
    fetchAll();
    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchAll]);""",
)

test_path = Path('src/test/ui/quickscanSelectionSync.test.ts')
test_path.write_text("""import { readFileSync } from 'node:fs';
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
""", encoding='utf-8')
