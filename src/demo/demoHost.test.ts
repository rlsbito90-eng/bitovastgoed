import { describe, expect, it } from 'vitest';
import { isCrmSandboxHost } from './demoHost';

describe('Isolatie van het vaste crm-test-adres', () => {
  it('activeert de losstaande sandbox uitsluitend op de vaste previewhost', () => {
    expect(isCrmSandboxHost('bitovastgoed-git-crm-test-bitovastgoed.vercel.app')).toBe(true);
    expect(isCrmSandboxHost('BITOVASTGOED-GIT-CRM-TEST-BITOVASTGOED.VERCEL.APP')).toBe(true);
  });
  it('raakt productie of andere previews niet', () => {
    expect(isCrmSandboxHost('bitovastgoed.vercel.app')).toBe(false);
    expect(isCrmSandboxHost('www.bitovastgoed.nl')).toBe(false);
    expect(isCrmSandboxHost('bitovastgoed-git-crm-test-bitovastgoed.vercel.app.evil.test')).toBe(false);
    expect(isCrmSandboxHost('bitovastgoed-abcdef-bitovastgoed.vercel.app')).toBe(false);
  });
});
