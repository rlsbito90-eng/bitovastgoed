import { describe, expect, it } from 'vitest';
import {
  haalProjectIdUitSupabaseUrl,
  valideerCrmFrontendEnv,
} from '../../../scripts/migratie/check-crm-frontend-env.mjs';

const DOEL = 'vyjocdlwfxrblusfngfq';

describe('CRM frontend cutover preflight', () => {
  it('haalt de projectref alleen uit een geldige Supabase URL', () => {
    expect(haalProjectIdUitSupabaseUrl(`https://${DOEL}.supabase.co`)).toBe(DOEL);
    expect(haalProjectIdUitSupabaseUrl('http://vyjocdlwfxrblusfngfq.supabase.co')).toBeNull();
    expect(haalProjectIdUitSupabaseUrl('https://example.com')).toBeNull();
  });

  it('accepteert alleen een consistente doelconfig met publishable key', () => {
    expect(valideerCrmFrontendEnv({
      projectId: DOEL,
      supabaseUrl: `https://${DOEL}.supabase.co`,
      publishableKey: 'test-publishable-key',
    })).toMatchObject({ ok: true, code: 'frontend_env_bevestigd' });
  });

  it('blokkeert wanneer URL en doelproject niet overeenkomen', () => {
    expect(valideerCrmFrontendEnv({
      projectId: DOEL,
      supabaseUrl: 'https://ljudxyrqoifhfikueric.supabase.co',
      publishableKey: 'test-publishable-key',
    })).toMatchObject({ ok: false, code: 'frontend_url_verkeerd_doel' });
  });

  it('blokkeert een ontbrekende publishable key', () => {
    expect(valideerCrmFrontendEnv({
      projectId: DOEL,
      supabaseUrl: `https://${DOEL}.supabase.co`,
      publishableKey: '',
    })).toMatchObject({ ok: false, code: 'frontend_key_ontbreekt' });
  });
});
