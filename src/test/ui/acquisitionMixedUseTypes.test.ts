import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACQUISITION_COMPONENT_TYPE_LABELS } from '@/lib/vastgoedrekenen/acquisition';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('beschrijvende mixed-use verkrijgingstypen', () => {
  it('biedt woon-winkelpand en gangbare gecombineerde huidige typen aan', () => {
    expect(ACQUISITION_COMPONENT_TYPE_LABELS.woon_winkelpand).toBe('Woon-winkelpand');
    expect(ACQUISITION_COMPONENT_TYPE_LABELS.woon_kantoorpand).toBe('Woon-kantoorpand');
    expect(ACQUISITION_COMPONENT_TYPE_LABELS.woon_bedrijfspand).toBe('Woon-bedrijfspand');
    expect(ACQUISITION_COMPONENT_TYPE_LABELS.mixed_use).toContain('Mixed-use');
  });

  it('gebruikt de verkrijgingstypen alleen in de verkrijgingsinterface', () => {
    const table = source('src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx');
    expect(table).toContain('ACQUISITION_COMPONENT_TYPE_LABELS');
    expect(table).not.toContain('Object.entries(VR_COMPONENT_LABELS)');
  });

  it('houdt huidig type en fiscale OVB-classificatie als afzonderlijke velden', () => {
    const table = source('src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx');
    expect(table).toContain('Field label="Huidig type"');
    expect(table).toContain('Field label="OVB-classificatie"');
  });
});
