import { describe, expect, it } from 'vitest';
import { biedAuditDetails, biedAuditTitel, type BiedAuditEvent } from './auditFormat';

const event = (patch: Partial<BiedAuditEvent> = {}): BiedAuditEvent => ({
  id: 'e1', bieding_id: 'b1', object_id: 'o1', relatie_id: 'r1', deal_id: null,
  operation: 'UPDATE', changed_fields: ['bedrag'], old_snapshot: { bedrag: 475000 },
  new_snapshot: { bedrag: 480000 }, actor_id: null, created_at: '2026-11-16T09:00:00Z',
  ...patch,
});

describe('biedboek-auditweergave', () => {
  it('laat bedrag van en naar zien in Nederlandse notatie', () => {
    expect(biedAuditDetails(event()).join(' ')).toContain('475.000');
    expect(biedAuditDetails(event()).join(' ')).toContain('480.000');
  });

  it('herkent een afgewezen bieding als aparte wijziging', () => {
    expect(biedAuditTitel(event({ changed_fields: ['status'], new_snapshot: { status: 'afgewezen' } }))).toBe('Bod afgewezen');
  });

  it('laat geen privé-notitietekst zien in de wijzigingssamenvatting', () => {
    const x = event({
      changed_fields: ['interne_notities'],
      old_snapshot: { interne_notities: 'Vertrouwelijk nummer 123' },
      new_snapshot: { interne_notities: 'Vertrouwelijk nummer 456' },
    });
    expect(biedAuditDetails(x)).toEqual(['Interne notities gewijzigd']);
  });

  it('laat aanpassing van karakter indicatief naar formeel expliciet zien', () => {
    const wijziging = event({
      changed_fields: ['bod_karakter'],
      old_snapshot: { bod_karakter: 'indicatief' },
      new_snapshot: { bod_karakter: 'formeel' },
    });
    expect(biedAuditDetails(wijziging)).toEqual(['Karakter bod: Indicatief → Formeel']);
  });

  it('houdt verwijderde biedingen inzichtelijk', () => {
    const x = event({ operation: 'DELETE', old_snapshot: { bedrag: 475000 }, new_snapshot: null });
    expect(biedAuditTitel(x)).toBe('Bieding verwijderd');
    expect(biedAuditDetails(x)[0]).toContain('475.000');
  });
});
