import { describe, expect, it } from 'vitest';
import { buildQuickscanObjectHref, readRequestedQuickscanId } from '@/lib/vastgoedrekenen/quickscanNavigation';

describe('quickscan navigation', () => {
  it('neemt object, quickscan, tab en anchor expliciet mee', () => {
    expect(buildQuickscanObjectHref('object 1', 'quickscan/1')).toBe(
      '/objecten/object%201?tab=vastgoedrekenen&calculation=quickscan%2F1#vastgoedrekenen',
    );
  });

  it('leest het aangeklikte quickscan-id uit de query', () => {
    expect(readRequestedQuickscanId('?tab=vastgoedrekenen&calculation=abc-123')).toBe('abc-123');
    expect(readRequestedQuickscanId('?tab=vastgoedrekenen')).toBeNull();
  });
});
