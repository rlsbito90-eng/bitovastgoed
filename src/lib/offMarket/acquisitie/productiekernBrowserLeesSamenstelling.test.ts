import { describe, expect, it, vi } from 'vitest';

import type {
  ProductiekernSupabaseClientLike,
  ProductiekernSupabaseQueryBuilder,
} from './productiekernSupabaseQueryUitvoerder';
import { ProductiekernNietGeactiveerdError } from './productiekernRepository';
import { stelProductiekernBrowserLezenSamen } from './productiekernBrowserLeesSamenstelling';

const volledigLeesbewijs = {
  actueleDdlGeverifieerd: true,
  actueleRlsGeverifieerd: true,
  geisoleerdeMigratieproefGroen: true,
  gerichteReadmodelTestsGroen: true,
  productiebuildGroen: true,
  explicietLeesakkoord: true,
} as const;

function maakBuilder(resultaat: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => resultaat),
    then(onfulfilled: ((waarde: typeof resultaat) => unknown) | null | undefined, onrejected?: ((reden: unknown) => unknown) | null) {
      return Promise.resolve(resultaat).then(onfulfilled ?? undefined, onrejected ?? undefined);
    },
  } as unknown as ProductiekernSupabaseQueryBuilder & {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

describe('stelProductiekernBrowserLezenSamen', () => {
  it('raakt de geïnjecteerde Supabase-client niet zolang leesbewijs ontbreekt', async () => {
    const client: ProductiekernSupabaseClientLike = { from: vi.fn() as never };
    const samenstelling = stelProductiekernBrowserLezenSamen(client, undefined);

    expect(samenstelling.activatie.lezenActief).toBe(false);
    await expect(samenstelling.repository.haalDossier('selectie-1'))
      .rejects.toBeInstanceOf(ProductiekernNietGeactiveerdError);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('gebruikt na volledig expliciet leesbewijs uitsluitend de geïnjecteerde allowlisted readketen', async () => {
    const builder = maakBuilder({
      data: {
        selectie_id: 'selectie-1',
        signaal_id: 'signaal-1',
        object_id: null,
        verwerking_gestart_op: '2026-08-08T12:00:00Z',
        verwerking_gestart_door: 'actor-1',
        primaire_werkbak: 'eigenaar_achterhalen',
        volgende_actie_op: null,
        volgende_actie_omschrijving: null,
      },
      error: null,
    });
    const client: ProductiekernSupabaseClientLike = { from: vi.fn(() => builder) };
    const samenstelling = stelProductiekernBrowserLezenSamen(client, volledigLeesbewijs);

    await expect(samenstelling.repository.haalDossier('selectie-1')).resolves.toMatchObject({
      selectieId: 'selectie-1',
      signaalId: 'signaal-1',
      primaireWerkbak: 'eigenaar_achterhalen',
    });
    expect(client.from).toHaveBeenCalledWith('off_market_acquisitie_dossiers');
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('selectie_id', 'selectie-1');
    expect(builder.limit).toHaveBeenCalledWith(1);
  });
});
