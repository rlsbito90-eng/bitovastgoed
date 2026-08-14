import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const hook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useAcquisitieBrieven.tsx'), 'utf8');
const kaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/VastgoedkansConceptbriefKaart.tsx'), 'utf8');
const statuskaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/AcquisitieBrievenStatusKaart.tsx'), 'utf8');
const eigenaarHook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useVastgoedkansEigenaren.tsx'), 'utf8');

describe('BUILD 2.0C.2 — Vastgoedkans conceptbrief', () => {
  it('leest brieven uitsluitend op vastgoedkans_id', () => {
    expect(hook).toContain("queryKey: ['off_market_brieven', 'vastgoedkans', vastgoedkansId]");
    expect(hook).toContain(".eq('vastgoedkans_id', vastgoedkansId)");
  });

  it('schrijft een Vastgoedkans-concept zonder fake signaal', () => {
    expect(hook).toContain('signaal_id: null');
    expect(hook).toContain('vastgoedkans_id: vastgoedkansId');
    expect(hook).toContain("status: 'concept'");
    expect(hook).toContain("event_type: 'concept_created'");
  });

  it('kan alleen een concept van hetzelfde Vastgoedkans-dossier bijwerken', () => {
    expect(hook).toContain(".eq('id', input.id)");
    expect(hook).toContain(".eq('vastgoedkans_id', vastgoedkansId)");
    expect(hook).toContain(".eq('status', 'concept')");
  });

  it('houdt Off-Market-verzending en automatische Vastgoedkans-mutatie buiten deze flow', () => {
    expect(hook).not.toContain('useMarkBriefVerstuurd');
    expect(hook).not.toContain('updateKans');
    expect(kaart).not.toContain('useMarkBriefVerstuurd');
    expect(kaart).not.toContain('updateKans');
  });

  it('laat een Vastgoedkans-eigenaar uit het Eigenaarsregister toe zonder CRM-relatie', () => {
    expect(statuskaart).toContain("model.dossier.bronType === 'vastgoedkans'");
    expect(statuskaart).toContain('useVastgoedkansEigenaren');
    expect(statuskaart).toContain('enabled={model.eigenaarBekend || eigenaarInRegister}');
    expect(statuskaart).toContain('CRM-relatie gekoppeld (optioneel)');
    expect(statuskaart).toContain('eigenaren={eigenaarOpties}');
    expect(eigenaarHook).toContain("from('eigenaar_koppelingen')");
    expect(eigenaarHook).toContain('eigenaar:eigenaren(*)');
  });

  it('vult één eigenaar automatisch in en vereist bij meerdere eigenaren een bewuste keuze', () => {
    expect(kaart).toContain('eigenaren.length === 1');
    expect(kaart).toContain('eigenaren.length > 1');
    expect(kaart).toContain('Kies bewust een geadresseerde');
    expect(kaart).toContain('Bij meerdere rechthebbenden wordt nooit automatisch gekozen');
    expect(kaart).toContain('eigenaarVelden(eigenaren[0])');
    expect(kaart).toContain("[eigenaar.adres, plaatsregel].filter(Boolean).join('\\n')");
    expect(kaart).not.toContain('Koppel eerst bewust de eigenaar aan een CRM-relatie');
  });
});
