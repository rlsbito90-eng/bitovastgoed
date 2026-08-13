import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = fs.readFileSync(path.resolve('src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');

describe('BUILD 2.0B.3 — CRM-acties voor gekoppelde Vastgoedkans-eigenaar', () => {
  it('biedt bestaande CRM-dialogs aan zonder eigen taak/contact-datastore', () => {
    expect(bron).toContain("import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog'");
    expect(bron).toContain("import TaakFormDialog from '@/components/forms/TaakFormDialog'");
    expect(bron).toContain('Contactmoment loggen');
    expect(bron).toContain('Taak aanmaken');
  });

  it('prefillt uitsluitend de expliciet gekoppelde relatie en bestaand object', () => {
    expect(bron).toContain('defaultRelatieId={gekoppeld.id}');
    expect(bron).toContain('defaultObjectId={kans?.objectId ?? undefined}');
    expect(bron).toContain('{gekoppeld && (');
  });

  it('maakt geen fake Off-Market-signaal of automatische Kadastercall', () => {
    expect(bron).not.toContain('defaultOffMarketSignaalId=');
    expect(bron).not.toContain('mutateAsync(');
    expect(bron).not.toContain("from('off_market_signalen')");
    expect(bron).toContain('Er wordt geen fake Off-Market-signaal aangemaakt.');
  });

  it('gebruikt een bestaande geldige taakcategorie en bewaart Vastgoedkans-context in notities', () => {
    expect(bron).toContain('defaultType="Follow-up"');
    expect(bron).toContain('defaultNotities=');
    expect(bron).toContain('Vastgoedkans:');
  });
});
