import type { ProductieActivatieBesluit } from './productieActivatiePoort';
import type {
  AcquisitieProductieTransactieRepository,
  BriefDefinitiefResultaat,
} from './productieTransactieRepository';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';
import type {
  BatchDocumentenRegistrerenInput,
  BatchGeprintMarkerenInput,
  BriefDefinitiefMakenInput,
  BriefGepostMarkerenInput,
} from './productieTransactieContract';

/**
 * Decorator die de centrale activatiebeslissing afdwingt vóórdat een concrete
 * repository ook maar één beveiligde RPC kan aanroepen.
 */
export class GepoorteAcquisitieProductieTransactieRepository
implements AcquisitieProductieTransactieRepository {
  constructor(
    private readonly activatie: ProductieActivatieBesluit,
    private readonly achterliggendeRepository: AcquisitieProductieTransactieRepository,
  ) {}

  private eisSchrijftoegang(handeling: string): void {
    if (!this.activatie.schrijvenActief) {
      throw new ProductieTransactiesNietGeactiveerdError(handeling);
    }
  }

  maakBriefDefinitief(
    input: BriefDefinitiefMakenInput,
  ): Promise<BriefDefinitiefResultaat> {
    this.eisSchrijftoegang('maakBriefDefinitief');
    return this.achterliggendeRepository.maakBriefDefinitief(input);
  }

  registreerBatchdocumenten(
    input: BatchDocumentenRegistrerenInput,
  ): Promise<void> {
    this.eisSchrijftoegang('registreerBatchdocumenten');
    return this.achterliggendeRepository.registreerBatchdocumenten(input);
  }

  markeerBatchGeprint(input: BatchGeprintMarkerenInput): Promise<void> {
    this.eisSchrijftoegang('markeerBatchGeprint');
    return this.achterliggendeRepository.markeerBatchGeprint(input);
  }

  markeerBriefGepost(input: BriefGepostMarkerenInput): Promise<void> {
    this.eisSchrijftoegang('markeerBriefGepost');
    return this.achterliggendeRepository.markeerBriefGepost(input);
  }
}

export function maakGepoorteProductieTransactieRepository(
  activatie: ProductieActivatieBesluit,
  achterliggendeRepository: AcquisitieProductieTransactieRepository,
): AcquisitieProductieTransactieRepository {
  return new GepoorteAcquisitieProductieTransactieRepository(
    activatie,
    achterliggendeRepository,
  );
}
