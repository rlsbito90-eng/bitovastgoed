import { describe, expect, it } from 'vitest';

import {
  bepaalProductieActivatie,
  productiekernStandaardUitgeschakeld,
} from './productieActivatiePoort';

const volledigBewijs = {
  actueleDdlGeverifieerd: true,
  actueleRlsGeverifieerd: true,
  geisoleerdeMigratieproefGroen: true,
  concurrencyproefGroen: true,
  volledigeTestsuiteGroen: true,
  productiebuildGroen: true,
  explicietProductieakkoord: true,
};

describe('bepaalProductieActivatie', () => {
  it('blijft standaard volledig uitgeschakeld', () => {
    expect(productiekernStandaardUitgeschakeld.lezenActief).toBe(false);
    expect(productiekernStandaardUitgeschakeld.schrijvenActief).toBe(false);
    expect(productiekernStandaardUitgeschakeld.ontbrekendBewijs).toHaveLength(7);
  });

  it('weigert gedeeltelijk bewijs', () => {
    const besluit = bepaalProductieActivatie({
      ...volledigBewijs,
      explicietProductieakkoord: false,
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
    expect(besluit.ontbrekendBewijs).toEqual([
      'Expliciet productieakkoord ontbreekt.',
    ]);
  });

  it('activeert uitsluitend wanneer alle zeven poorten expliciet groen zijn', () => {
    expect(bepaalProductieActivatie(volledigBewijs)).toEqual({
      lezenActief: true,
      schrijvenActief: true,
      ontbrekendBewijs: [],
    });
  });

  it('behandelt ontbrekende configuratie fail-closed', () => {
    const besluit = bepaalProductieActivatie(null);
    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
  });
});
