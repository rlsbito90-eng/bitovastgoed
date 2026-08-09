import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bron = readFileSync(
  resolve(process.cwd(), 'src/integrations/lovable/index.ts'),
  'utf8',
);

describe('social OAuth runtimecontract', () => {
  it('gebruikt native Supabase signInWithOAuth', () => {
    expect(bron).toContain('supabase.auth.signInWithOAuth');
    expect(bron).toContain('redirectTo: opts.redirect_uri');
    expect(bron).toContain('queryParams: opts.extraParams');
  });

  it('ondersteunt uitsluitend de social providers die de AuthPage aanbiedt', () => {
    expect(bron).toContain("type OndersteundeProvider = 'google' | 'apple'");
  });

  it('initialiseert geen Lovable authclient meer', () => {
    expect(bron).not.toContain('createLovableAuth');
    expect(bron).not.toContain('@lovable.dev/cloud-auth-js');
    expect(bron).not.toContain('setSession(result.tokens)');
  });
});
