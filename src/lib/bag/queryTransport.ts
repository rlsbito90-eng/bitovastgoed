import { supabase } from '@/integrations/supabase/client';
import {
  valideerPandZoekAanvraag,
  valideerPandZoekAanvraagV2,
  valideerPandZoekAanvraagV3,
  valideerViewportAanvraag,
  type BagPandZoekAanvraag,
  type BagPandZoekAanvraagV2,
  type BagPandZoekAanvraagV3,
  type BagViewportAanvraag,
} from './queryService';
import {
  BAG_STANDAARD_ACTIEVE_SCOPECODES,
  bepaalActieveBagScopes,
} from './scopeRegistry';
import {
  assertBagV2ResultatenVoldoenAanFilters,
  assertBagV3ResultatenVoldoenAanFilters,
} from './zoekResultaatGuard';

export interface BagTransportResultaat<T> {
  rows: T[];
}

const SHADOW_PROJECT_REF = 'xfygspvpeugxowxbcvnm';
const SHADOW_FUNCTION_URL = `https://${SHADOW_PROJECT_REF}.supabase.co/functions/v1/bag-query-service`;
const ACTIEVE_SCOPES = bepaalActieveBagScopes(
  import.meta.env.VITE_BAG_QUERY_ALLOWED_SCOPES || BAG_STANDAARD_ACTIEVE_SCOPECODES,
);
const ACTIEVE_SCOPE_CODES = new Set(ACTIEVE_SCOPES.map(scope => scope.code));

function controleerScope(scopeCode: string): void {
  if (!ACTIEVE_SCOPE_CODES.has(scopeCode)) {
    throw new TypeError('Deze BAG-regio is nog niet geactiveerd.');
  }
}

async function invoke<T>(
  body: Record<string, unknown>,
  opties: { retryBijNetwerkfout?: boolean } = {},
): Promise<BagTransportResultaat<T>> {
  const configuredUrl = import.meta.env.VITE_BAG_QUERY_FUNCTION_URL?.trim();
  if (configuredUrl !== SHADOW_FUNCTION_URL) {
    throw new Error('De BAG-queryservice is niet veilig geconfigureerd.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error('Log opnieuw in om de BAG-queryservice te gebruiken.');
  }

  const maximaalPogingen = opties.retryBijNetwerkfout ? 2 : 1;
  let response: Response | null = null;
  for (let poging = 1; poging <= maximaalPogingen; poging += 1) {
    try {
      response = await fetch(configuredUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      break;
    } catch {
      if (poging === maximaalPogingen) {
        throw new Error('De BAG-queryservice is niet beschikbaar.');
      }
    }
  }

  if (!response?.ok) throw new Error('De BAG-queryservice is niet beschikbaar.');
  const data = await response.json().catch(() => null) as { rows?: unknown } | null;
  if (!data || !Array.isArray(data.rows)) throw new Error('Ongeldig antwoord van de BAG-queryservice.');
  return { rows: data.rows as T[] };
}

export async function haalPandenInViewport<T>(aanvraag: BagViewportAanvraag): Promise<BagTransportResultaat<T>> {
  const validatie = valideerViewportAanvraag(aanvraag);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
  controleerScope(aanvraag.scopeCode);
  return invoke<T>({
    action: 'viewport', scopeCode: aanvraag.scopeCode,
    minX: aanvraag.viewport.minX, minY: aanvraag.viewport.minY,
    maxX: aanvraag.viewport.maxX, maxY: aanvraag.viewport.maxY, limit: aanvraag.limiet,
  });
}

export async function zoekPandenViaService<T>(aanvraag: BagPandZoekAanvraag): Promise<BagTransportResultaat<T>> {
  const validatie = valideerPandZoekAanvraag(aanvraag);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
  controleerScope(aanvraag.scopeCode);
  return invoke<T>({ action: 'search', scopeCode: aanvraag.scopeCode, cursor: aanvraag.naIdentificatie, limit: aanvraag.limiet });
}

type BagPandZoekAanvraagV2MetAliases = BagPandZoekAanvraagV2 & {
  vboSomVan?: number | null; vboSomTot?: number | null; vboMaxVan?: number | null; vboMaxTot?: number | null;
};

export function normaliseerPandZoekAanvraagV2(aanvraag: BagPandZoekAanvraagV2 | Record<string, unknown>): BagPandZoekAanvraagV2 {
  const bron = aanvraag as BagPandZoekAanvraagV2MetAliases;
  return {
    scopeCode: bron.scopeCode, naIdentificatie: bron.naIdentificatie ?? null, limiet: bron.limiet,
    bouwjaarVan: bron.bouwjaarVan ?? null, bouwjaarTot: bron.bouwjaarTot ?? null, status: bron.status ?? null,
    vboOppervlakteSomVan: bron.vboOppervlakteSomVan ?? bron.vboSomVan ?? null,
    vboOppervlakteSomTot: bron.vboOppervlakteSomTot ?? bron.vboSomTot ?? null,
    vboOppervlakteMaxVan: bron.vboOppervlakteMaxVan ?? bron.vboMaxVan ?? null,
    vboOppervlakteMaxTot: bron.vboOppervlakteMaxTot ?? bron.vboMaxTot ?? null,
    vboAantalVan: bron.vboAantalVan ?? null, vboAantalTot: bron.vboAantalTot ?? null,
    gebruiksdoel: bron.gebruiksdoel ?? null, isGemengd: bron.isGemengd ?? null, vboModus: bron.vboModus,
  };
}

export async function zoekPandenViaServiceV2<T>(aanvraag: BagPandZoekAanvraagV2 | Record<string, unknown>): Promise<BagTransportResultaat<T>> {
  const genormaliseerd = normaliseerPandZoekAanvraagV2(aanvraag);
  const validatie = valideerPandZoekAanvraagV2(genormaliseerd);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
  controleerScope(genormaliseerd.scopeCode);
  const resultaat = await invoke<T>({
    action: 'search_v2', scopeCode: genormaliseerd.scopeCode, cursor: genormaliseerd.naIdentificatie, limit: genormaliseerd.limiet,
    bouwjaarVan: genormaliseerd.bouwjaarVan, bouwjaarTot: genormaliseerd.bouwjaarTot, status: genormaliseerd.status,
    vboOppervlakteSomVan: genormaliseerd.vboOppervlakteSomVan, vboOppervlakteSomTot: genormaliseerd.vboOppervlakteSomTot,
    vboOppervlakteMaxVan: genormaliseerd.vboOppervlakteMaxVan, vboOppervlakteMaxTot: genormaliseerd.vboOppervlakteMaxTot,
    vboAantalVan: genormaliseerd.vboAantalVan, vboAantalTot: genormaliseerd.vboAantalTot,
    gebruiksdoel: genormaliseerd.gebruiksdoel, isGemengd: genormaliseerd.isGemengd, vboModus: genormaliseerd.vboModus,
  });
  assertBagV2ResultatenVoldoenAanFilters(resultaat.rows, genormaliseerd);
  return resultaat;
}

export async function zoekPandenViaServiceV3<T>(aanvraag: BagPandZoekAanvraagV3): Promise<BagTransportResultaat<T>> {
  const validatie = valideerPandZoekAanvraagV3(aanvraag);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
  controleerScope(aanvraag.scopeCode);
  const resultaat = await invoke<T>({
    action: 'search_v3', scopeCode: aanvraag.scopeCode, cursor: aanvraag.naIdentificatie, limit: aanvraag.limiet,
    bouwjaarVan: aanvraag.bouwjaarVan, bouwjaarTot: aanvraag.bouwjaarTot, statussen: aanvraag.statussen,
    vboOppervlakteSomVan: aanvraag.vboOppervlakteSomVan, vboOppervlakteSomTot: aanvraag.vboOppervlakteSomTot,
    vboOppervlakteMaxVan: aanvraag.vboOppervlakteMaxVan, vboOppervlakteMaxTot: aanvraag.vboOppervlakteMaxTot,
    vboAantalVan: aanvraag.vboAantalVan, vboAantalTot: aanvraag.vboAantalTot,
    gebruiksdoelen: aanvraag.gebruiksdoelen, isGemengd: aanvraag.isGemengd, vboModus: aanvraag.vboModus,
  }, { retryBijNetwerkfout: true });
  assertBagV3ResultatenVoldoenAanFilters(resultaat.rows, aanvraag);
  return resultaat;
}
