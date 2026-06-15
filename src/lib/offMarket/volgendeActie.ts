// Helper voor "Volgende actie" op off-market signaaldetail.
// Eerstvolgende open taak (status !== afgerond / geannuleerd) gekoppeld aan
// dit signaal, gesorteerd op deadline asc. Fallback: het oude signaal-veld
// `volgende_actie_datum` + `volgende_actie_omschrijving` als er geen taak is.
import type { Taak } from '@/data/mock-data';
import type { OffMarketSignaal } from './types';

export interface VolgendeActie {
  bron: 'taak' | 'signaal';
  titel: string;
  deadline: string | null; // YYYY-MM-DD
  taakId?: string;
}

const OPEN_STATUSSEN = new Set(['open', 'in_uitvoering', 'wacht_op_reactie']);

export function bepaalVolgendeActie(
  signaal: Pick<OffMarketSignaal, 'volgende_actie_datum' | 'volgende_actie_omschrijving'>,
  taken: Taak[],
  signaalId: string,
): VolgendeActie | null {
  const open = taken
    .filter((t) => t.offMarketSignaalId === signaalId)
    .filter((t) => OPEN_STATUSSEN.has(t.status))
    .filter((t) => !t.softDeletedAt)
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  if (open.length > 0) {
    const t = open[0];
    return {
      bron: 'taak',
      titel: t.titel,
      deadline: t.deadline || null,
      taakId: t.id,
    };
  }

  if (signaal.volgende_actie_omschrijving || signaal.volgende_actie_datum) {
    return {
      bron: 'signaal',
      titel: signaal.volgende_actie_omschrijving || 'Volgende actie',
      deadline: signaal.volgende_actie_datum || null,
    };
  }
  return null;
}

export function formatDeadlineNL(deadline: string | null): string {
  if (!deadline) return '—';
  try {
    return new Date(deadline + 'T00:00:00').toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return deadline;
  }
}
