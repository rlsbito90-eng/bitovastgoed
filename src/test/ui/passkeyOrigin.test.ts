import { describe, expect, it } from 'vitest';
import { PASSKEY_ORIGIN, isPasskeyOriginAllowed } from '@/lib/auth/passkeyOrigin';

describe('Passkey originbeperking', () => {
  it('staat uitsluitend het vaste productie-origin toe', () => {
    expect(PASSKEY_ORIGIN).toBe('https://bitovastgoed.vercel.app');
    expect(isPasskeyOriginAllowed('https://bitovastgoed.vercel.app')).toBe(true);
    expect(isPasskeyOriginAllowed('https://bitovastgoed-8yf22qytm-bitovastgoed.vercel.app')).toBe(false);
    expect(isPasskeyOriginAllowed('https://bitovastgoed.vercel.app.evil.example')).toBe(false);
    expect(isPasskeyOriginAllowed('http://bitovastgoed.vercel.app')).toBe(false);
    expect(isPasskeyOriginAllowed('https://bitovastgoed.vercel.app:8443')).toBe(false);
  });
});
