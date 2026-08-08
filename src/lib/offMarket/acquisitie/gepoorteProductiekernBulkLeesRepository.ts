import type { ProductieLeesActivatieBesluit } from './productieLeesActivatiePoort';
import { ProductiekernNietGeactiveerdError } from './productiekernRepository';
import type { ProductiekernBulkLeesRepository } from './productiekernSupabaseBulkLeesRepository';

export class GepoorteProductiekernBulkLeesRepository implements ProductiekernBulkLeesRepository {
  constructor(
    private readonly activatie: ProductieLeesActivatieBesluit,
    private readonly achterliggend: ProductiekernBulkLeesRepository,
  ) {}

  private eisLeestoegang(handeling: string): void {
    if (!this.activatie.lezenActief) throw new ProductiekernNietGeactiveerdError(handeling);
  }

  haalDossiersOpSelectieIds(selectieIds: readonly string[]) {
    this.eisLeestoegang('haalDossiersOpSelectieIds');
    return this.achterliggend.haalDossiersOpSelectieIds(selectieIds);
  }

  haalBrievenOpIds(ids: readonly string[]) {
    this.eisLeestoegang('haalBrievenOpIds');
    return this.achterliggend.haalBrievenOpIds(ids);
  }

  haalBriefversiesOpIds(ids: readonly string[]) {
    this.eisLeestoegang('haalBriefversiesOpIds');
    return this.achterliggend.haalBriefversiesOpIds(ids);
  }
}

export function maakGepoorteProductiekernBulkLeesRepository(
  activatie: ProductieLeesActivatieBesluit,
  achterliggend: ProductiekernBulkLeesRepository,
): ProductiekernBulkLeesRepository {
  return new GepoorteProductiekernBulkLeesRepository(activatie, achterliggend);
}
