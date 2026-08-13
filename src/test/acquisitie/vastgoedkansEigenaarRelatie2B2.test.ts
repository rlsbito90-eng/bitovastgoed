import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const relatieBron = fs.readFileSync(path.join(root, 'src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');
const kadasterBron = fs.readFileSync(path.join(root, 'src/components/acquisitie/VastgoedkansKadasterKaart.tsx'), 'utf8');
const kansenHook = fs.readFileSync(path.join(root, 'src/hooks/useVastgoedkansen.tsx'), 'utf8');
const compacteKansenHook = kansenHook.replace(/\s+/g, '');

describe('BUILD 2.0B.2 — eigenaar naar CRM-relatie', () => {
  it('gebruikt het bestaande Vastgoedkans-relatiecontract', () => {
    expect(relatieBron).toContain('updateEigenaarRelatie');
    expect(relatieBron).toContain('await updateEigenaarRelatie(vastgoedkansId, relatie.id)');
    expect(relatieBron).toContain('await updateEigenaarRelatie(vastgoedkansId, null)');
    expect(compacteKansenHook).toContain('.update({eigenaar_relatie_id:relatieId})');
  });

  it('maakt of koppelt nooit automatisch vanuit Kadaster-eigenaarsdata', () => {
    expect(relatieBron).toContain('Kadaster-eigenaren blijven acquisitiedata');
    expect(relatieBron).toContain('wordt niet automatisch aan Relaties toegevoegd');
    expect(relatieBron).not.toContain('useEffect(');
    expect(relatieBron).not.toContain('addRelatie(');
    expect(relatieBron).not.toContain('updateKans(');
  });

  it('vereist een expliciete klik voor bestaande CRM-relaties', () => {
    expect(relatieBron).toContain('onClick={() => koppel(match.relatie)}');
    expect(relatieBron).toContain('onClick={() => koppel(r)}');
    expect(relatieBron).toContain('onClick={ontkoppel}');
    expect(relatieBron).toContain('placeholder="Zoek bestaande relatie op naam of bedrijf…"');
  });

  it('houdt nieuwe Kadaster-eigenaren buiten Relaties en gebruikt eigenaarvoorstellen als acquisitiedata', () => {
    expect(relatieBron).toContain('bouwKadasterEigenaarVoorstellen');
    expect(relatieBron).toContain('vindCrmMatches');
    expect(relatieBron).toContain('Eigenaarvoorstellen uit Kadaster');
    expect(relatieBron).toContain('Bestaande CRM-match gevonden');
    expect(relatieBron).not.toContain('<QuickCreateRelationDialog');
    expect(relatieBron).not.toContain('Nieuwe relatie aanmaken');
  });

  it('blijft onderdeel van de Vastgoedkans Kadaster/eigenaar-werkplek zonder Kadaster-call te starten', () => {
    expect(kadasterBron).toContain("import VastgoedkansEigenaarRelatieKaart from '@/components/acquisitie/VastgoedkansEigenaarRelatieKaart';");
    expect(kadasterBron).toContain('<VastgoedkansEigenaarRelatieKaart vastgoedkansId={vastgoedkansId} />');
    expect(relatieBron).not.toContain('useKadasterObjectinformatie');
    expect(relatieBron).not.toContain('mutateAsync');
  });
});
