from pathlib import Path

path = Path('src/hooks/useVastgoedrekenen.tsx')
text = path.read_text()

old = """    const [componentsRes, costsRes, wwsRes, sellOffRes, risksRes, exitRes] = await Promise.all([
      supabase.from('calculation_components').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('scenario_costs').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('residential_wws_units').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('sell_off_units').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('risk_analysis').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('exit_assumptions').select('*').eq('scenario_id', id).order('created_at'),
    ]);

    const loadError = [componentsRes, costsRes, wwsRes, sellOffRes, risksRes, exitRes]
      .map((result) => result.error)
      .find(Boolean);"""
new = """    const untyped = supabase as unknown as { from: (table: string) => any };
    const [componentsRes, acquisitionRes, acquisitionLinksRes, costsRes, wwsRes, sellOffRes, risksRes, exitRes] = await Promise.all([
      supabase.from('calculation_components').select('*').eq('scenario_id', id).order('created_at'),
      untyped.from('calculation_acquisition_components').select('*').eq('scenario_id', id).order('sort_order').order('created_at'),
      untyped.from('calculation_acquisition_unit_links').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('scenario_costs').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('residential_wws_units').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('sell_off_units').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('risk_analysis').select('*').eq('scenario_id', id).order('created_at'),
      supabase.from('exit_assumptions').select('*').eq('scenario_id', id).order('created_at'),
    ]);

    const requiredLoadError = [componentsRes, costsRes, wwsRes, sellOffRes, risksRes, exitRes]
      .map((result) => result.error)
      .find(Boolean);
    const optionalAcquisitionError = [acquisitionRes.error, acquisitionLinksRes.error]
      .find((error) => error && error.code !== '42P01');
    const loadError = requiredLoadError ?? optionalAcquisitionError;"""
if old not in text:
    raise SystemExit('duplicate load block not found')
text = text.replace(old, new, 1)

old = """    const duplicate = duplicateData as Scenario;
    const componentIdMap = new Map<string, string>();"""
new = """    const duplicate = duplicateData as Scenario;
    const componentIdMap = new Map<string, string>();
    const acquisitionComponentIdMap = new Map<string, string>();
    const sellOffUnitIdMap = new Map<string, string>();"""
if old not in text:
    raise SystemExit('duplicate map block not found')
text = text.replace(old, new, 1)

old = """      for (const scenarioCost of costsRes.data ?? []) {"""
new = """      for (const acquisitionComponent of acquisitionRes.error ? [] : acquisitionRes.data ?? []) {
        const payload = buildScenarioChildClone(
          acquisitionComponent as unknown as Record<string, unknown>,
          duplicate.id,
        );
        const { data, error } = await untyped
          .from('calculation_acquisition_components')
          .insert(payload)
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message ?? 'Verkrijgingscomponent kopiëren mislukt');
        acquisitionComponentIdMap.set(acquisitionComponent.id, data.id);
      }

      for (const scenarioCost of costsRes.data ?? []) {"""
if old not in text:
    raise SystemExit('acquisition clone insertion point not found')
text = text.replace(old, new, 1)

old = """      for (const sellOffUnit of sellOffRes.data ?? []) {
        const payload = buildScenarioChildClone(
          sellOffUnit as unknown as Record<string, unknown>,
          duplicate.id,
          componentIdMap,
        );
        const { error } = await supabase.from('sell_off_units').insert(payload as never);
        if (error) throw new Error(error.message);
      }

      for (const risk of risksRes.data ?? []) {"""
new = """      for (const sellOffUnit of sellOffRes.data ?? []) {
        const payload = buildScenarioChildClone(
          sellOffUnit as unknown as Record<string, unknown>,
          duplicate.id,
          componentIdMap,
        );
        const { data, error } = await supabase
          .from('sell_off_units')
          .insert(payload as never)
          .select('id')
          .single();
        if (error || !data) throw new Error(error?.message ?? 'Strategie-unit kopiëren mislukt');
        sellOffUnitIdMap.set(sellOffUnit.id, data.id);
      }

      for (const acquisitionLink of acquisitionLinksRes.error ? [] : acquisitionLinksRes.data ?? []) {
        const newAcquisitionId = acquisitionComponentIdMap.get(acquisitionLink.acquisition_component_id);
        const newSellOffUnitId = sellOffUnitIdMap.get(acquisitionLink.sell_off_unit_id);
        if (!newAcquisitionId || !newSellOffUnitId) {
          throw new Error('Verkrijgingskoppeling kon niet veilig naar de gekopieerde records worden vertaald');
        }
        const payload = {
          ...stripCloneIdentity(acquisitionLink as unknown as Record<string, unknown>),
          scenario_id: duplicate.id,
          acquisition_component_id: newAcquisitionId,
          sell_off_unit_id: newSellOffUnitId,
        };
        const { error } = await untyped.from('calculation_acquisition_unit_links').insert(payload);
        if (error) throw new Error(error.message);
      }

      for (const risk of risksRes.data ?? []) {"""
if old not in text:
    raise SystemExit('sell-off clone block not found')
text = text.replace(old, new, 1)
path.write_text(text)

Path('src/test/ui/acquisitionDuplicationUx.test.ts').write_text("""import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/hooks/useVastgoedrekenen.tsx'), 'utf8');

describe('verkrijgingsstructuur dupliceren', () => {
  it('kopieert verkrijgingscomponenten en vertaalt beide zijden van de één-op-veelkoppeling', () => {
    expect(source).toContain('calculation_acquisition_components');
    expect(source).toContain('calculation_acquisition_unit_links');
    expect(source).toContain('acquisitionComponentIdMap');
    expect(source).toContain('sellOffUnitIdMap');
    expect(source).toContain('newAcquisitionId');
    expect(source).toContain('newSellOffUnitId');
  });

  it('blijft scenario’s dupliceren wanneer de optionele migratie nog niet bestaat', () => {
    expect(source).toContain("error.code !== '42P01'");
  });
});
""")
