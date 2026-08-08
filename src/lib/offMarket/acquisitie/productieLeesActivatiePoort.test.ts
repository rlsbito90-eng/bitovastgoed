import { describe, expect, it } from 'vitest';

import {
  bepaalProductieLeesActivatie,
  productiekernLezenStandaardUitgeschakeld,
} from './productieLeesActivatiePoort';

const volledigLeesbewijs = {
  actueleDdlGeverifieerd: true,
  actueleRlsGeverifieerd: true,
  geisoleerdeMigratieproefGroen: true,
  gerichteReadmodelTestsGroen: true,
  productiebuildGroen: true,
  explicietLeesakkoord: true,
};

describe('bepaalProductieLeesActivatie', () => {
  it('blijft standaard uitgeschakeld', () => {
    expect(productiekernLezenStandaardUitgeschakeld.lezenActief).toBe(false);
    expect(productiekernLezenStandaardUitgeschakeld.ontbrekendBewijs).toHaveLength(6);
  });

  it('weigert gedeeltelijk bewijs', () => {
    const besluit = bepaalProductieLeesActivatie({
      ...volledigLeesbewijs,
      explicietLeesakkoord: false,
    });

    expect(besluit).toEqual({
      lezenActief: false,
      ontbrekendBewijs: [
        'Expliciet akkoord voor productiekern-lezen ontbreekt.',
      ],
    });
  });

  it('activeert uitsluitend read-only na alle zes bewijzen', () => {
    expect(bepaalProductieLeesActivatie(volledigLeesbewijs)).toEqual({
      lezenActief: true,
      ontbrekendBewijs: [],
    });
  });

  it('behandelt ontbrekende configuratie fail-closed', () => {
    expect(bepaalProductieLeesActivatie(null).lezenActief).toBe(false);
  });
});
