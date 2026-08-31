import { describe, expect, it } from 'vitest';

import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { bouwBulkEmailPlan } from './bulkEmail';

function signaal(id: string, email: string | null, bedrijf = 'Voorbeeld B.V.'): OffMarketSignaal {
  return {
    id,
    adres: `Teststraat ${id}`,
    plaats: 'Den Haag',
    eigenaar_email: email,
    eigenaar_bedrijfsnaam: bedrijf,
    eigenaar_naam: null,
  } as unknown as OffMarketSignaal;
}

function emailBrief(input: Partial<OffMarketBrief> & Pick<OffMarketBrief, 'id' | 'signaal_id'>): OffMarketBrief {
  return {
    eigenaar_naam: null,
    eigenaar_bedrijfsnaam: 'Voorbeeld B.V.',
    verzendadres: 'contact@voorbeeld.nl',
    objectadres: 'Teststraat 1',
    objectomschrijving: 'Teststraat 1',
    aanhef: null,
    onderwerp: 'Onderwerp',
    brieftekst: 'Tekst',
    status: 'verstuurd',
    verzonden_op: '2026-08-01T12:00:00.000Z',
    aangemaakt_door: null,
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-01T12:00:00.000Z',
    archived_at: null,
    archived_reason: null,
    kanaal: 'email',
    campagne_stap: 'email_1',
    geadresseerde_key: 'email:contact@voorbeeld.nl',
    ...input,
  } as OffMarketBrief;
}

describe('bouwBulkEmailPlan', () => {
  it('bundelt meerdere geselecteerde signalen met hetzelfde e-mailadres tot één partijactie', () => {
    const plan = bouwBulkEmailPlan([
      signaal('s1', 'contact@voorbeeld.nl'),
      signaal('s2', 'CONTACT@voorbeeld.nl'),
    ], []);

    expect(plan).toHaveLength(1);
    expect(plan[0].signaalIds).toEqual(['s1', 's2']);
    expect(plan[0].profiel).toBe('portefeuille');
    expect(plan[0].campagneStap).toBe('email_1');
    expect(plan[0].actie).toBe('aanmaken');
  });

  it('kiest E-mail 2 wanneer E-mail 1 al verzonden is en gebruikt opvolgcopy', () => {
    const plan = bouwBulkEmailPlan(
      [signaal('s1', 'contact@voorbeeld.nl')],
      [emailBrief({ id: 'b1', signaal_id: 's1', campagne_stap: 'email_1', status: 'verstuurd' })],
    );

    expect(plan[0].campagneStap).toBe('email_2');
    expect(plan[0].actie).toBe('aanmaken');
    expect(plan[0].onderwerp).toMatch(/^Re: /);
    expect(plan[0].brieftekst).toContain('kom daar graag nog even kort op terug');
  });

  it('hergebruikt een bestaand concept voor de actuele e-mailstap', () => {
    const concept = emailBrief({
      id: 'b2',
      signaal_id: 's1',
      campagne_stap: 'email_2',
      status: 'concept',
      verzonden_op: null,
    });
    const plan = bouwBulkEmailPlan(
      [signaal('s1', 'contact@voorbeeld.nl')],
      [emailBrief({ id: 'b1', signaal_id: 's1', campagne_stap: 'email_1' }), concept],
    );

    expect(plan[0].campagneStap).toBe('email_2');
    expect(plan[0].actie).toBe('hergebruiken');
    expect(plan[0].bestaandeBrief?.id).toBe('b2');
  });

  it('maakt na drie verzonden e-mails geen vierde standaardopvolging', () => {
    const plan = bouwBulkEmailPlan(
      [signaal('s1', 'contact@voorbeeld.nl')],
      [
        emailBrief({ id: 'b1', signaal_id: 's1', campagne_stap: 'email_1' }),
        emailBrief({ id: 'b2', signaal_id: 's1', campagne_stap: 'email_2' }),
        emailBrief({ id: 'b3', signaal_id: 's1', campagne_stap: 'email_3' }),
      ],
    );

    expect(plan[0].actie).toBe('reeks_compleet');
    expect(plan[0].campagneStap).toBeNull();
  });

  it('stopt standaardopvolging zodra een respons is geregistreerd', () => {
    const plan = bouwBulkEmailPlan(
      [signaal('s1', 'contact@voorbeeld.nl')],
      [emailBrief({ id: 'b1', signaal_id: 's1', responsstatus: 'interesse' })],
    );

    expect(plan[0].actie).toBe('respons_geregistreerd');
    expect(plan[0].blokkade).toContain('respons geregistreerd');
  });

  it('houdt een ontbrekend e-mailadres zichtbaar als blokkade', () => {
    const plan = bouwBulkEmailPlan([signaal('s1', null)], []);

    expect(plan).toHaveLength(1);
    expect(plan[0].actie).toBe('geen_email');
    expect(plan[0].blokkade).toBe('Geen bruikbaar e-mailadres bekend.');
  });

  it('herkent partijhistorie op hetzelfde e-mailadres ook wanneer die onder een ander signaal staat', () => {
    const plan = bouwBulkEmailPlan(
      [signaal('s2', 'contact@voorbeeld.nl')],
      [emailBrief({ id: 'b1', signaal_id: 's1', campagne_stap: 'email_1', status: 'verstuurd' })],
    );

    expect(plan[0].campagneStap).toBe('email_2');
  });
});
