import { describe, expect, it } from 'vitest';
import { isIsolatedPreviewSandbox, PROTECTED_CRM_PROJECT_REFS } from '@/lib/auth/previewSandbox';

const previewOrigin = 'https://bitovastgoed-8xywl0ats-bitovastgoed.vercel.app';
const sandboxRef = 'abcdefghijklmnopqrst';
const sandboxUrl = `https://${sandboxRef}.supabase.co`;

function enabled(overrides: Record<string, string | undefined> = {}) {
  return isIsolatedPreviewSandbox({
    origin: previewOrigin,
    enabled: 'true',
    supabaseUrl: sandboxUrl,
    sandboxProjectRef: sandboxRef,
    ...overrides,
  });
}

describe('isolated preview sandbox', () => {
  it('maakt de sandbox alleen in expliciet aangewezen previews beschikbaar', () => {
    expect(enabled()).toBe(true);
    expect(enabled({ enabled: 'false' })).toBe(false);
    expect(enabled({ enabled: undefined })).toBe(false);
    expect(enabled({ origin: 'https://bitovastgoed.vercel.app' })).toBe(false);
    expect(enabled({ origin: 'https://evil.example' })).toBe(false);
    expect(enabled({ origin: 'http://bitovastgoed-8xywl0ats-bitovastgoed.vercel.app' })).toBe(false);
    expect(enabled({ origin: 'https://bitovastgoed-8xywl0ats-bitovastgoed.vercel.app.evil.example' })).toBe(false);
  });

  it('weigert elke bekende productiedatabase, ook wanneer de featureflag aanstaat', () => {
    for (const ref of PROTECTED_CRM_PROJECT_REFS) {
      expect(enabled({
        sandboxProjectRef: ref,
        supabaseUrl: `https://${ref}.supabase.co`,
      })).toBe(false);
    }
  });

  it('weigert onjuiste of onduidelijke Supabase-configuratie', () => {
    expect(enabled({ sandboxProjectRef: undefined })).toBe(false);
    expect(enabled({ sandboxProjectRef: 'invalid' })).toBe(false);
    expect(enabled({ supabaseUrl: 'https://other.supabase.co' })).toBe(false);
    expect(enabled({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co.evil.example' })).toBe(false);
    expect(enabled({ supabaseUrl: 'http://abcdefghijklmnopqrst.supabase.co' })).toBe(false);
    expect(enabled({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co/extra' })).toBe(false);
  });
});
