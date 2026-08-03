import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/VastgoedkansenVindenPage.tsx'), 'utf8');
const component = readFileSync(resolve(process.cwd(), 'src/components/bag/BagServicePandenlijst.tsx'), 'utf8');

describe('BAG 2A.10 lijst-/filterinterface', () => {
  it('is standaard uit en vereist een expliciete niet-geheime featureflag', () => {
    expect(page).toContain("VITE_BAG_QUERY_SERVICE_ENABLED === 'true'");
    expect(page).toContain('<BagServicePandenlijst scopeCode={BAG_SERVICE_SCOPE} />');
    expect(page).not.toContain('service_role');
  });

  it('gebruikt alleen de geauthenticeerde transportadapter', () => {
    expect(component).toContain("from '@/lib/bag/queryTransport'");
    expect(component).toContain('zoekPandenViaService');
    expect(component).not.toContain('createClient');
    expect(component).not.toContain('fetch(');
    expect(component).not.toContain('DATABASE_URL');
  });

  it('bouwt een begrensde lijst zonder kaart of automatische opslag', () => {
    expect(component).toContain('const PAGE_SIZE = 100');
    expect(component).toContain('Volgende 100 laden');
    expect(component).toContain('Geen kaart en geen automatische opslag.');
    expect(component).not.toMatch(/maplibre|react-map|google\.com\/maps/i);
    expect(component).not.toContain('addKans');
  });
});
