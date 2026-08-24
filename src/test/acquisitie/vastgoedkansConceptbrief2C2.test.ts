import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const hook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useAcquisitieBrieven.tsx'), 'utf8');
const pandenHook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/usePandenverkennerBrieven.ts'), 'utf8');
const kaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/VastgoedkansConceptbriefKaart.tsx'), 'utf8');
const statuskaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/AcquisitieBrievenStatusKaart.tsx'), 'utf8');
const eigenaarHook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useVastgoedkansEigenaren.tsx'), 'utf8');

describe('BUILD 2.0C.2 — Vastgoedkans conceptbrief', () => {
  it('leest brieven uitsluitend op vastgoedkans_id', () => {
    expect(hook).toContain("queryKey: ['off_market_brieven', 'vastgoedkans', vastgoedkansId]");
    expect(hook).toContain(".eq('vastgoedkans_id', vastgoedkansId)");
  });

  it('schrijft een Pandenverkenner-concept zonder fake signaal', () => {
    expect(pandenHook).toContain('signaal_id: null');
    expect(pandenHook).toContain('vastgoedkans_id: vastgoedkansId');
    expect(pandenHook).toContain("status: 'concept'");
    expect(pandenHook).toContain("event_type: 'concept_created'");
    expect(pandenHook).toContain("bron: 'pandenverkenner'");
  });

  it('kan alleen een concept van hetzelfde Vastgoedkans-dossier bijwerken', () => {
    expect(pandenHook).toContain(".eq('id', input.id)");
    expect(pandenHook).toContain(".eq('vastgoedkans_id', vastgoedkansId)");
    expect(pandenHook).toContain(".eq('status', 'concept')");
  });

  it('houdt Off-Market-verzending en automatische Vastgoedkans-mutatie buiten deze flow', () => {
    expect(pandenHook).not.toContain('useMarkBriefVerstuurd');
    expect(pandenHook).not.toContain('updateKans');
    expect(kaart).not.toContain('useMarkBriefVerstuurd');
    expect(kaart).not.toContain('updateKans');
  });

  it('laat een Vastgoedkans-eigenaar uit het Eigenaarsregister toe zonder CRM-relatie', () => {
    expect(statuskaart).toContain("model.dossier.bronType === 'vastgoedkans'");
    expect(statuskaart).toContain('useVastgoedkansEigenaren');
    expect(statuskaart).toContain('CRM-relatie gekoppeld (optioneel)');
    expect(statuskaart).toContain('eigenaren={eigenaarOpties}');
    expect(eigenaarHook).toContain("from('eigenaar_koppelingen')");
    expect(eigenaarHook).toContain('eigenaar:eigenaren(*)');
  });

  it('vult één eigenaar automatisch in, laat bij meerdere bewust kiezen en ondersteunt algemene eigenaarspost', () => {
    expect(kaart).toContain('eigenaren.length === 1');
    expect(kaart).toContain('eigenaren.length > 1');
    expect(kaart).toContain('Kies een bevestigde eigenaar');
    expect(kaart).toContain('Of adresseer algemeen aan de eigenaar van het object');
    expect(kaart).toContain('zetBekendeEigenaar(stap, eigenaren[0])');
    expect(kaart).toContain("[eigenaar.adres?.trim(), plaatsregel].filter(Boolean).join('\\n')");
    expect(kaart).toContain("const ALGEMENE_EIGENAAR_LABEL = 'Aan de eigenaar van'");
    expect(kaart).toContain("adresseerwijze === 'eigenaar_objectadres'");
  });
});
