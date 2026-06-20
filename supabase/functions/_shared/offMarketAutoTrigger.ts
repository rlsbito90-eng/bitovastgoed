// Server-side port van src/lib/offMarket/bag/autoTrigger.ts (pure functies, geen netwerkcalls).
// Gebruikt door off-market-normalize-ruw om server-side te bepalen of automatische
// AI-verrijking is toegestaan voor een nieuw gepromoveerd off_market_signaal.
//
// Houd deze logica in sync met de client-helper. Kadaster wordt nooit geraakt.

export interface SignaalAutoInput {
  id?: string;
  titel?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  bron_url?: string | null;
  status?: string | null;
  gearchiveerd_op?: string | null;
  ai_status?: string | null;
  ai_skip_reden?: string | null;
}

export interface TriggerBeslissing {
  toegestaan: boolean;
  reden: string;
}

function isArchief(s: SignaalAutoInput): boolean {
  if (s.gearchiveerd_op) return true;
  return s.status === 'archief' || s.status === 'afgevallen' || s.status === 'niet_interessant';
}

function heeftMinimaleData(s: SignaalAutoInput): boolean {
  const titel = (s.titel ?? '').trim();
  const heeftLocatie = !!(
    (s.plaats ?? '').trim() ||
    (s.adres ?? '').trim() ||
    (s.bron_url ?? '').trim()
  );
  return titel.length > 0 && heeftLocatie;
}

export function magAiAutoVerrijken(s: SignaalAutoInput): TriggerBeslissing {
  if (isArchief(s)) return { toegestaan: false, reden: 'gearchiveerd of afgevallen' };
  if (s.ai_skip_reden && s.ai_skip_reden.trim()) {
    return { toegestaan: false, reden: 'AI heeft signaal eerder geskipt' };
  }
  const status = s.ai_status ?? 'niet_verrijkt';
  if (status !== 'niet_verrijkt') {
    return { toegestaan: false, reden: `ai_status=${status}` };
  }
  if (!heeftMinimaleData(s)) {
    return { toegestaan: false, reden: 'onvoldoende data (titel/locatie)' };
  }
  return { toegestaan: true, reden: 'voldoet aan criteria' };
}

/** Hard cap voor automatische AI-triggers per normalize-run. */
export const AI_TRIGGER_CAP_PER_RUN = 50;
