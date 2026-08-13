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

  it('maakt of koppelt nooit automatisch vanuit de Kadasternaam', () => {
    expect(relatieBron).toContain('Gebruik als zoekterm');
    expect(relatieBron).toContain('wordt nooit automatisch gekoppeld of aangemaakt');
    expect(relatieBron).not.toContain('useEffect(');
    expect(relatieBron).not.toContain('addRelatie(');
    expect(relatieBron).not.toContain('updateKans(');
  });

  it('vereist een expliciete klik voor bestaande relaties', () => {
    expect(relatieBron).toContain('onClick={() => koppel(relatie)}');
    expect(relatieBron).toContain("onClick={ontkoppel}");
    expect(relatieBron).toContain("placeholder=\"Zoek bestaande relatie op naam of bedrijf…\"");
  });

  it('hergebruikt QuickCreate en laat de gebruiker de Kadasternaam eerst beoordelen', () => {
    expect(relatieBron).toContain('<QuickCreateRelationDialog');
    expect(relatieBron).toContain('context="verkoper"');
    expect(relatieBron).toContain("defaultValues={{ naam: kadasterNaam || effectieveZoekterm, type: 'eigenaar' }}");
    expect(relatieBron).toContain('Nieuwe relatie aanmaken');
  });

  it('blijft onderdeel van de Vastgoedkans Kadaster/eigenaar-werkplek zonder Kadaster-call te starten', () => {
    expect(kadasterBron).toContain("import VastgoedkansEigenaarRelatieKaart from '@/components/acquisitie/VastgoedkansEigenaarRelatieKaart';");
    expect(kadasterBron).toContain('<VastgoedkansEigenaarRelatieKaart vastgoedkansId={vastgoedkansId} />');
    expect(relatieBron).not.toContain('useKadasterObjectinformatie');
    expect(relatieBron).not.toContain('mutateAsync');
  });
});
