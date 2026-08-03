import { supabase } from '@/integrations/supabase/client';
import {
  valideerPandZoekAanvraag,
  valideerViewportAanvraag,
  type BagPandZoekAanvraag,
  type BagViewportAanvraag,
} from './queryService';

export interface BagTransportResultaat<T> {
  rows: T[];
}

const SHADOW_PROJECT_REF = 'xfygspvpeugxowxbcvnm';
const SHADOW_FUNCTION_URL = `https://${SHADOW_PROJECT_REF}.supabase.co/functions/v1/bag-query-service`;

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
  const data: unknown = await response.json().catch(() => null);
  if (!data || !Array.isArray(data.rows)) throw new Error('Ongeldig antwoord van de BAG-queryservice.');
  return { rows: data.rows as T[] };
}

export async function haalPandenInViewport<T>(
  aanvraag: BagViewportAanvraag,
): Promise<BagTransportResultaat<T>> {
  const validatie = valideerViewportAanvraag(aanvraag);
  if (!validatie.geldig) throw new TypeError(validatie.fouten.join(' '));
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
  return invoke<T>({
    action: 'search',
    scopeCode: aanvraag.scopeCode,
    cursor: aanvraag.naIdentificatie,
    limit: aanvraag.limiet,
  });
}
