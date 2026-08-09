import { describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const moduleUrl = pathToFileURL(path.resolve(process.cwd(), 'scripts/migratie/check-crm-target.mjs')).href;
const { valideerCrmDoel, CRM_DOELPROJECT } = await import(moduleUrl) as {
  valideerCrmDoel: (projectId?: string | null) => { ok: boolean; code: string; reden: string };
  CRM_DOELPROJECT: string;
};

describe('CRM migratie doelguard', () => {
  it('staat uitsluitend het eigen CRM-doelproject toe', () => {
    expect(CRM_DOELPROJECT).toBe('vyjocdlwfxrblusfngfq');
    expect(valideerCrmDoel(CRM_DOELPROJECT)).toMatchObject({ ok: true, code: 'doel_bevestigd' });
  });

  it.each([
    'ljudxyrqoifhfikueric',
    'wzkhmjuasyuvzhhycnym',
    'xfygspvpeugxowxbcvnm',
  ])('blokkeert beschermd project %s', (projectId) => {
    expect(valideerCrmDoel(projectId)).toMatchObject({ ok: false, code: 'doel_verboden' });
  });

  it('faalt gesloten bij ontbrekend of onbekend doel', () => {
    expect(valideerCrmDoel()).toMatchObject({ ok: false, code: 'doel_ontbreekt' });
    expect(valideerCrmDoel('ander-project')).toMatchObject({ ok: false, code: 'doel_onbekend' });
  });
});
