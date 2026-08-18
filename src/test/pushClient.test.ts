import { describe, expect, it, vi } from 'vitest';
import { urlBase64ToUint8Array } from '@/lib/notifications/pushClient';

describe('pushClient — VAPID sleutelconversie', () => {
  it('decodeert URL-safe base64 deterministisch naar bytes', () => {
    const result = urlBase64ToUint8Array('AQIDBA');
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it('accepteert URL-safe - en _ tekens', () => {
    const originalAtob = globalThis.atob;
    const spy = vi.fn((value: string) => originalAtob(value));
    vi.stubGlobal('atob', spy);

    urlBase64ToUint8Array('-_8');

    expect(spy).toHaveBeenCalledWith('+/8=');
    vi.unstubAllGlobals();
  });
});
