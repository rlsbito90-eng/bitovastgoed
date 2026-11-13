import { describe, expect, it, vi } from 'vitest';
import {
  CRM_PRIMARY_ORIGIN,
  createPreviewNonce,
  isBitoPreviewOrigin,
  PREVIEW_LOGIN_ACK,
  PREVIEW_LOGIN_MESSAGE,
} from '@/lib/auth/previewSso';

describe('centrale previewaanmelding', () => {
  it('accepteert kandidaat-previewadressen, maar nooit vreemde of productiedomeinen', () => {
    expect(isBitoPreviewOrigin('https://bitovastgoed-5lfjp4vr0-bitovastgoed.vercel.app')).toBe(true);
    expect(isBitoPreviewOrigin('https://bitovastgoed-git-feat-crm-bitovastgoed.vercel.app')).toBe(true);
    expect(isBitoPreviewOrigin(CRM_PRIMARY_ORIGIN)).toBe(false);
    expect(isBitoPreviewOrigin('https://bitovastgoed.vercel.app.evil.example')).toBe(false);
    expect(isBitoPreviewOrigin('https://evil.example')).toBe(false);
    expect(isBitoPreviewOrigin('http://bitovastgoed-5lfjp4vr0-bitovastgoed.vercel.app')).toBe(false);
    expect(isBitoPreviewOrigin('https://bitovastgoed-5lfjp4vr0-bitovastgoed.vercel.app:444')).toBe(false);
    expect(isBitoPreviewOrigin('https://bitovastgoed-5lfjp4vr0-bitovastgoed.vercel.app/path')).toBe(false);
    expect(isBitoPreviewOrigin('https://bitovastgoed-5lfjp4vr0-bitovastgoed.vercel.app@evil.example')).toBe(false);
    expect(isBitoPreviewOrigin('//bitovastgoed-5lfjp4vr0-bitovastgoed.vercel.app')).toBe(false);
  });

  it('maakt voor iedere aanmelding een onvoorspelbaar 256-bits nonce', () => {
    const values = new Uint8Array(32).fill(0xa9);
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation((buffer) => {
      new Uint8Array((buffer as Uint8Array).buffer).set(values);
      return buffer;
    });
    try {
      const nonce = createPreviewNonce();
      expect(nonce).toBe('a9'.repeat(32));
      expect(nonce).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      random.mockRestore();
    }
  });

  it('gebruikt verschillende berichttypes voor grant en ontvangstbevestiging', () => {
    expect(PREVIEW_LOGIN_MESSAGE).toBe('bito-crm-preview-login-v1');
    expect(PREVIEW_LOGIN_ACK).toBe('bito-crm-preview-login-ack-v1');
  });
});
