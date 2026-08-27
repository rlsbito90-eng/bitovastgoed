import { faseInfo, type SignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';

export interface KadasterReadinessAanwezigheid {
  rechtenAanwezig: boolean;
  internBerichtAanwezig: boolean;
}

/**
 * Bestaande Kadasterdata betekent niet automatisch dat een eigenaar al veilig
 * is vastgesteld. Het betekent wél dat het dossier niet meer generiek als
 * "nog niet onderzocht" mag worden gepresenteerd: er is concrete brondata die
 * verwerkt/gecontroleerd moet worden, zonder nieuwe betaalde aanvraag.
 */
export function pasKadasterAanwezigheidToeOpReadiness(
  readiness: SignaalReadiness,
  aanwezigheid: KadasterReadinessAanwezigheid | undefined,
): SignaalReadiness {
  if (!aanwezigheid?.rechtenAanwezig || !aanwezigheid.internBerichtAanwezig) return readiness;
  if (readiness.geadresseerden.length > 0) return readiness;
  if (readiness.fase !== 'onderzoek_nodig' && readiness.fase !== 'eigenaar_ontbreekt') return readiness;

  const fase = 'eigenaar_controleren' as const;
  return {
    ...readiness,
    fase,
    info: faseInfo(fase),
    blokkadeReden: 'Kadasterrechten en intern Kadasterbericht zijn al aanwezig. Verwerk of controleer de bestaande eigenaar/rechthebbenden; er is geen nieuwe betaalde Kadasteraanvraag nodig.',
  };
}
