// Render-tests voor de mobiele Gebiedsindeling- en Brongegevens-kaarten.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignaalMobileGebiedsindeling from '@/components/offmarket/mobile/SignaalMobileGebiedsindeling';
import SignaalMobileBronregel from '@/components/offmarket/mobile/SignaalMobileBronregel';
import { maakTestSignaal } from './_fixture';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('SignaalMobileGebiedsindeling', () => {
  it('toont statusbadge "Verrijkt" en stacked rows', () => {
    const s = maakTestSignaal({
      lat: 52.37, lng: 4.9, geo_status: 'verrijkt' as any,
      geo_gemeente_naam: 'Amsterdam',
      geo_wijk_naam: 'Frederik Hendrikbuurt',
      geo_buurt_naam: 'Frederik Hendrikbuurt-Zuidoost-lange-naam-test',
      geo_bron: 'pdok_locatieserver',
      geo_verrijkt_op: '2026-06-16T10:00:00.000Z',
    } as any);
    wrap(<SignaalMobileGebiedsindeling signaal={s} />);
    expect(screen.getByTestId('geo-status-badge').textContent).toBe('Verrijkt');
    expect(screen.getByText('Amsterdam')).toBeTruthy();
    expect(screen.getByText('Frederik Hendrikbuurt')).toBeTruthy();
    const buurt = screen.getByText(/Frederik Hendrikbuurt-Zuidoost/);
    expect(buurt.className).toContain('line-clamp-2');
  });

  it('toont placeholder als niet verrijkt', () => {
    const s = maakTestSignaal({ lat: 52.37, lng: 4.9 } as any);
    wrap(<SignaalMobileGebiedsindeling signaal={s} />);
    expect(screen.getByTestId('geo-status-badge').textContent).toBe('Niet verrijkt');
    expect(screen.getByText(/Nog geen gebiedsindeling/)).toBeTruthy();
  });
});

describe('SignaalMobileBronregel', () => {
  it('toont Bron, Brondatum, Toegevoegd op en Toegevoegd via', () => {
    const s = maakTestSignaal();
    render(<SignaalMobileBronregel signaal={s} />);
    expect(screen.getByText('Bron')).toBeTruthy();
    expect(screen.getByText('Brondatum')).toBeTruthy();
    expect(screen.getByText('Toegevoegd op')).toBeTruthy();
    expect(screen.getByText('Toegevoegd via')).toBeTruthy();
    expect(screen.getByText('Handmatig')).toBeTruthy();
  });
});
