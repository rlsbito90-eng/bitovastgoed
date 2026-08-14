import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const hookBron = fs.readFileSync(path.join(root, 'src/hooks/useEigenaarsregister.tsx'), 'utf8');
const kaartBron = fs.readFileSync(path.join(root, 'src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');

describe('BUILD 2.0B — automatische sync naar centraal Eigenaarsregister', () => {
  it('schrijft Kadaster-eigenaren naar eigenaren en koppelt ze aan de Vastgoedkans', () => {
    expect(hookBron).toContain("from('eigenaren')");
    expect(hookBron).toContain("from('eigenaar_koppelingen')");
    expect(hookBron).toContain('vastgoedkans_id: vastgoedkansId');
    expect(hookBron).toContain("rol: 'rechthebbende'");
    expect(hookBron).toContain("bron: 'kadaster'");
  });

  it('vult de bestaande Vastgoedkans-eigenaarvelden automatisch uit Kadaster', () => {
    expect(hookBron).toContain("from('vastgoedkansen').update({");
    expect(hookBron).toContain('eigenaar_naam: namen.join');
    expect(hookBron).toContain("eigenaar_bron: 'Kadaster'");
    expect(hookBron).toContain('eigenaar_laatst_gecontroleerd_op: vandaag');
  });

  it('dedupliceert over dossiers alleen met sterke identiteit en nooit op naam alleen', () => {
    expect(hookBron).toContain('if (kvk) return `kvk:${kvk}`');
    expect(hookBron).toContain('if (naam && adres && postcode)');
    expect(hookBron).toContain('return null;');
    expect(hookBron).not.toContain('dedupe_sleutel: voorstel.sleutel');
  });

  it('is binnen één Vastgoedkans idempotent op hetzelfde Kadaster-record', () => {
    expect(hookBron).toContain('gekoppeldPerKadasterRecord');
    expect(hookBron).toContain('voorstel.bronRecordIds');
    expect(hookBron).toContain('bestaandeOpKadaster?.eigenaar');
    expect(hookBron).toContain('if (nieuwKadasterRecordId) gekoppeldPerKadasterRecord.set');
  });

  it('dedupliceert de teruggeschreven eigenaarnaam van de Vastgoedkans', () => {
    expect(hookBron).toContain('const namen = [...new Set(voorstellen.map(displayNaam).filter(Boolean))]');
  });

  it('maakt of koppelt geen CRM-relatie automatisch en doet geen Kadastercall', () => {
    expect(hookBron).not.toContain("from('relaties').insert");
    expect(hookBron).not.toContain('mutateAsync(');
    expect(kaartBron).toContain('Bestaande CRM-relaties worden alleen als match voorgesteld');
    expect(kaartBron).toContain('wordt niet automatisch aan Relaties toegevoegd');
  });

  it('maakt automatische centrale opslag zichtbaar en biedt herstel zonder nieuwe Kadasteraanvraag', () => {
    expect(kaartBron).toContain('Eigenaarsregister automatisch bijwerken');
    expect(kaartBron).toContain('Centraal opgeslagen');
    expect(kaartBron).toContain('Er wordt geen nieuwe Kadasteraanvraag gedaan.');
    expect(kaartBron).toContain('register.retrySync');
  });
});
