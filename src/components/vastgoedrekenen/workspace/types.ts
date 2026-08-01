import type { Calculation } from '@/lib/vastgoedrekenen/types';

export type OverviewCalculation = Calculation & {
  object_naam?: string;
  latest_activity_at: number;
};

export function formatLaatsteActiviteit(timestamp: number): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
