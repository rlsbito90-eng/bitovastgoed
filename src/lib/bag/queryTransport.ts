import { supabase } from '@/integrations/supabase/client';
import {
  valideerPandZoekAanvraag,
  valideerPandZoekAanvraagV2,
  valideerViewportAanvraag,
  type BagPandZoekAanvraag,
  type BagPandZoekAanvraagV2,
  type BagViewportAanvraag,
} from './queryService';
import {
  BAG_STANDAARD_ACTIEVE_SCOPECODES,
  bepaalActieveBagScopes,
} from './scopeRegistry';

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

async function invoke<T>(body: Record<string, unknown>): Promise<BagTransportResultaat<T>> {
  const configuredUrl = import.meta.env.VITE_BAG_QUERY_FUNCTION_URL?.trim();
  if (configuredUrl !== SHADOW_FUNCTION_URL) {
    throw new Error('De BAG-queryservice is niet veilig geconfigureerd.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error('Log opnieuw in om de BAG-queryservice te gebruiken.');
  }

  let response: Response;
  try {
    response = await fetch(configuredUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('De BAG-queryservice is niet beschikbaar.');
  }

  if (!response.ok) throw new Error('De BAG-queryservice is niet beschikbaar.');
  const data = await response.json().catch(() => null) as { rows?: unknown } | null;
  if (!data || !Array.isArray(data.rows)) throw new Error('Ongeldig antwoord van de BAG-queryservice.');
  return { rows: data.rows as T[] };
}

export async function haalPandenInViewport<T>(
  aanvraag: BagViewportAanvraag,
): Promise<BagTransportResultaat<T>> {
  const validatie = valideerViewportAanvraag(aanvraag);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
  controleerScope(aanvraag.scopeCode);
  return invoke<T>({
    action: 'viewport',
    scopeCode: aanvraag.scopeCode,
    minX: aanvraag.viewport.minX,
    minY: aanvraag.viewport.minY,
    maxX: aanvraag.viewport.maxX,
    maxY: aanvraag.viewport.maxY,
    limit: aanvraag.limiet,
  });
}

export async function zoekPandenViaService<T>(
  aanvraag: BagPandZoekAanvraag,
): Promise<BagTransportResultaat<T>> {
  const validatie = valideerPandZoekAanvraag(aanvraag);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
  controleerScope(aanvraag.scopeCode);
  return invoke<T>({
    action: 'search',
    scopeCode: aanvraag.scopeCode,
    cursor: aanvraag.naIdentificatie,
    limit: aanvraag.limiet,
  });
}

export async function zoekPandenViaServiceV2<T>(
  aanvraag: BagPandZoekAanvraagV2,
): Promise<BagTransportResultaat<T>> {
  const validatie = valideerPandZoekAanvraagV2(aanvraag);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
  controleerScope(aanvraag.scopeCode);
  return invoke<T>({
    action: 'search_v2',
    scopeCode: aanvraag.scopeCode,
    cursor: aanvraag.naIdentificatie,
    limit: aanvraag.limiet,
    bouwjaarVan: aanvraag.bouwjaarVan,
    bouwjaarTot: aanvraag.bouwjaarTot,
    status: aanvraag.status,
    vboOppervlakteSomVan: aanvraag.vboOppervlakteSomVan,
    vboOppervlakteSomTot: aanvraag.vboOppervlakteSomTot,
    vboOppervlakteMaxVan: aanvraag.vboOppervlakteMaxVan,
    vboOppervlakteMaxTot: aanvraag.vboOppervlakteMaxTot,
    vboAantalVan: aanvraag.vboAantalVan,
    vboAantalTot: aanvraag.vboAantalTot,
    gebruiksdoel: aanvraag.gebruiksdoel,
    isGemengd: aanvraag.isGemengd,
    vboModus: aanvraag.vboModus,
  });
}
