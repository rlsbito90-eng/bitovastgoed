import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const chipsBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/AcquisitieWerkbakChips.tsx'),
  'utf8',
);
const emailBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/BulkEmailVoorbereidenDialog.tsx'),
  'utf8',
);
const opvolgDialogBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/BulkVolgendeBriefDialog.tsx'),
  'utf8',
);
const selectieBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx'),
  'utf8',
);
const planBron = readFileSync(
  resolve(process.cwd(), 'src/lib/offMarket/acquisitie/bulkEmail.ts'),
  'utf8',
);

describe('Centrale Radar-opvolging', () => {
  it('maakt Brief 2/3 en e-mailopvolging expliciet bereikbaar vanuit Actie > Opvolgen', () => {
    expect(chipsBron).toContain("subfilter === 'opvolgen'");
    expect(chipsBron).toContain('Centrale opvolging');
    expect(chipsBron).toContain('Volgende brief');
    expect(chipsBron).toContain('E-mail opvolgen');
    expect(chipsBron).toContain('onVolgendeBrief');
  });

  it('scheidt bestaande postopvolging van de partijrouting voor nieuwe signalen', () => {
    expect(chipsBron).not.toContain('bestaandeActie.click()');
    expect(selectieBron).toContain('BulkVolgendeBriefDialog');
    expect(opvolgDialogBron).toContain('De eerder verzonden brief is bronwaarheid');
    expect(opvolgDialogBron).not.toContain('useRadarPartyCampaignContext');
    expect(opvolgDialogBron).not.toContain('usePersistRadarCampaignRouting');
  });

  it('maakt uitzonderingen zichtbaar en verzendt of print niets automatisch', () => {
    expect(opvolgDialogBron).toContain('uitzonderingen');
    expect(opvolgDialogBron).toContain('Er wordt niets automatisch geprint of verzonden');
    expect(opvolgDialogBron).toContain('Bestaande handmatig aangepaste concepten blijven ongewijzigd');
  });

  it('verstuurt e-mail nooit automatisch maar ondersteunt centrale verzendregistratie', () => {
    expect(emailBron).toContain('Er wordt niets automatisch verstuurd');
    expect(emailBron).toContain('Dit verstuurt géén e-mail');
    expect(emailBron).toContain('bulk-email-verzonden-registreren');
    expect(emailBron).toContain("kanaal: 'email'");
    expect(emailBron).not.toContain('fetch(');
  });

  it('filtert ontbrekende e-mails en gestopte sequences niet stil weg', () => {
    expect(planBron).toContain("'geen_email'");
    expect(planBron).toContain("'respons_geregistreerd'");
    expect(planBron).toContain("'reeks_compleet'");
    expect(emailBron).toContain('er wordt niets stil weggefilterd');
  });
});
