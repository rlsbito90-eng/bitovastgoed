import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const relatieBron = fs.readFileSync(path.join(root, 'src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');
const crmHook = fs.readFileSync(path.join(root, 'src/hooks/useEigenaarCrmKoppeling.tsx'), 'utf8');
const kadasterBron = fs.readFileSync(path.join(root, 'src/components/acquisitie/VastgoedkansKadasterKaart.tsx'), 'utf8');

describe('BUILD 2.0B.2 — eigenaar naar CRM-relatie', () => {
  it('gebruikt eigenaar.crm_relatie_id als primair CRM-contract', () => {
    expect(relatieBron).toContain('useEigenaarCrmKoppeling');
    expect(relatieBron).toContain('eigenaar.crm_relatie_id');
    expect(crmHook).toContain(".from('eigenaren')");
    expect(crmHook).toContain('.update({ crm_relatie_id: relatieId })');
  });

  it('maakt of koppelt nooit automatisch vanuit Kadaster-eigenaarsdata', () => {
    expect(relatieBron).toContain('Kadaster-eigenaren blijven acquisitiedata');
    expect(relatieBron).toContain('nooit automatisch als nieuwe CRM-relatie aangemaakt');
    expect(relatieBron).not.toContain('useEffect(');
    expect(relatieBron).not.toContain('addRelatie(');
    expect(relatieBron).not.toContain('updateKans(');
  });

  it('vereist een expliciete klik en een specifieke eigenaar voor bestaande CRM-relaties', () => {
    expect(relatieBron).toContain('onClick={() => koppel(eigenaar, match.relatie)}');
    expect(relatieBron).toContain('onClick={() => koppel(zoekEigenaar, relatie)}');
    expect(relatieBron).toContain('onClick={() => ontkoppel(eigenaar)}');
    expect(relatieBron).toContain('placeholder="Zoek bestaande relatie op naam of bedrijf…"');
    expect(relatieBron).toContain('Koppel aan eigenaar');
  });

  it('houdt nieuwe Kadaster-eigenaren buiten Relaties en gebruikt eigenaarvoorstellen als acquisitiedata', () => {
    expect(relatieBron).toContain('bouwKadasterEigenaarVoorstellen');
    expect(relatieBron).toContain('vindCrmMatches');
    expect(relatieBron).toContain('Eigenaarvoorstellen uit Kadaster');
    expect(relatieBron).toContain('Voorgestelde bestaande CRM-match');
    expect(relatieBron).not.toContain('<QuickCreateRelationDialog');
    expect(relatieBron).not.toContain('Nieuwe relatie aanmaken');
  });

  it('blijft onderdeel van de Vastgoedkans Kadaster/eigenaar-werkplek zonder Kadaster-call te starten', () => {
    expect(kadasterBron).toContain("import VastgoedkansEigenaarRelatieKaart from '@/components/acquisitie/VastgoedkansEigenaarRelatieKaart';");
    expect(kadasterBron).toContain('<VastgoedkansEigenaarRelatieKaart vastgoedkansId={vastgoedkansId} />');
    expect(relatieBron).not.toContain('useKadasterObjectinformatie');
  });

  it('houdt legacy dossierkoppelingen alleen als expliciete migratieroute', () => {
    expect(relatieBron).toContain('Oude dossierniveau CRM-koppeling');
    expect(relatieBron).toContain('await updateEigenaarRelatie(vastgoedkansId, null)');
    expect(relatieBron).not.toContain('await updateEigenaarRelatie(vastgoedkansId, relatie.id)');
  });
});
