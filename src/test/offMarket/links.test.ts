// Smoke tests voor off-market koppelingen.
// - bevestigt dat Taak en ContactMoment het offMarketSignaalId-veld doorgeven
// - bevestigt dat de DB-mappers heen-en-weer het off_market_signaal_id veld bewaren
import { describe, it, expect } from 'vitest';
import { contactMomentFromDb, contactMomentToDb } from '@/lib/contactMoments';

describe('off-market koppelingen', () => {
  it('contactmoment mapt off_market_signaal_id correct heen en weer', () => {
    const dbRow = {
      id: 'cm-1',
      moment_date: '2026-06-05',
      type: 'notitie',
      direction: 'intern',
      title: 'Notitie',
      is_system: false,
      off_market_signaal_id: 'sig-123',
      created_at: '2026-06-05T10:00:00Z',
      updated_at: '2026-06-05T10:00:00Z',
    };
    const cm = contactMomentFromDb(dbRow);
    expect(cm.offMarketSignaalId).toBe('sig-123');

    const payload = contactMomentToDb({ offMarketSignaalId: 'sig-456' });
    expect(payload.off_market_signaal_id).toBe('sig-456');

    const cleared = contactMomentToDb({ offMarketSignaalId: '' });
    expect(cleared.off_market_signaal_id).toBeNull();
  });

  it('contactmoment mapper laat off_market_signaal_id ongemoeid wanneer veld niet meegegeven', () => {
    const payload = contactMomentToDb({ title: 'Alleen titel' });
    expect('off_market_signaal_id' in payload).toBe(false);
  });
});
