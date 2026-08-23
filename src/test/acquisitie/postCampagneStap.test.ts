import { describe, expect, it } from 'vitest';
import { bepaalVolgendePostCampagneStap } from '@/lib/acquisitie/postCampagneStap';

const brief = (overrides: Record<string, unknown> = {}) => ({
  id: 'b1',
  signaal_id: 's1',
  eigenaar_naam: 'J. de Vries',
  eigenaar_bedrijfsnaam: null,
  verzendadres: 'Straat 1\n1234 AB Plaats',
  objectadres: null,
  objectomschrijving: null,
  aanhef: 'Geachte heer/mevrouw,',
  onderwerp: 'Onderwerp',
  brieftekst: 'Tekst',
  status: 'verstuurd',
  verzonden_op: '2026-08-01T10:00:00Z',
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  kanaal: 'post',
  campagne_stap: 'brief_1',
  geadresseerde_key: 'j. de vries|straat 1 1234ab plaats',
  ...overrides,
}) as any;

describe('post campagnestap', () => {
  it('start bij Brief 1 zonder eerdere verzending', () => {
    expect(bepaalVolgendePostCampagneStap({ brieven: [], geadresseerdeKey: 'x' })).toBe('brief_1');
  });

  it('gaat na verstuurde Brief 1 naar Brief 2', () => {
    expect(bepaalVolgendePostCampagneStap({
      brieven: [brief()],
      geadresseerdeKey: 'j. de vries|straat 1 1234ab plaats',
    })).toBe('brief_2');
  });

  it('gaat na Brief 1 en 2 naar Brief 3', () => {
    expect(bepaalVolgendePostCampagneStap({
      brieven: [brief(), brief({ id: 'b2', campagne_stap: 'brief_2' })],
      geadresseerdeKey: 'j. de vries|straat 1 1234ab plaats',
    })).toBe('brief_3');
  });

  it('telt e-mail en concepten niet als afgesloten poststap', () => {
    expect(bepaalVolgendePostCampagneStap({
      brieven: [brief({ kanaal: 'email', campagne_stap: 'email_1' }), brief({ id: 'c1', status: 'concept' })],
      geadresseerdeKey: 'j. de vries|straat 1 1234ab plaats',
    })).toBe('brief_1');
  });
});
