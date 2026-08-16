import { describe, expect, it } from 'vitest';
import { bepaalKadasterBronLabels } from '@/components/offmarket/acquisitie/KadasterBronOverzicht';

function record(id: string, zoekadres: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    product_code: 'rechten',
    status: 'geleverd',
    fetched_at: '2026-08-16T10:00:00Z',
    zoekadres: { waarde: zoekadres },
    ...extra,
  } as any;
}

describe('bepaalKadasterBronLabels', () => {
  it('markeert exact het eerste geleverde Rechten-record met PDF als actuele bron', () => {
    const labels = bepaalKadasterBronLabels(
      [
        record('nieuw', 'Zaanstraat 189, Amsterdam'),
        record('oud', 'Zaanstraat 189, Amsterdam', { fetched_at: '2026-08-15T10:00:00Z' }),
      ],
      new Set(['nieuw', 'oud']),
    );

    expect(labels).toEqual([
      { recordId: 'nieuw', soort: 'actueel', label: 'Actuele bron eigenaarsonderzoek' },
      { recordId: 'oud', soort: 'eerder', label: 'Eerdere aanvraag' },
    ]);
  });

  it('onderscheidt een ouder ander zoekadres als alternatieve adresquery', () => {
    const labels = bepaalKadasterBronLabels(
      [
        record('actueel', 'Leimuidenstraat 35 H, Amsterdam'),
        record('alternatief', 'Leimuidenstraat 35 2, Amsterdam'),
      ],
      new Set(['actueel', 'alternatief']),
    );

    expect(labels[1]).toEqual({
      recordId: 'alternatief',
      soort: 'alternatief',
      label: 'Alternatieve adresquery',
    });
  });

  it('noemt geen record actueel wanneer de kandidaat geen opgeslagen PDF heeft', () => {
    const labels = bepaalKadasterBronLabels(
      [record('zonder-pdf', 'Zaanstraat 189, Amsterdam')],
      new Set(),
    );

    expect(labels).toEqual([
      { recordId: 'zonder-pdf', soort: 'eerder', label: 'Eerdere aanvraag' },
    ]);
  });
});
