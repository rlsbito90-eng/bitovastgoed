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

async function invoke<T>(body: Record<string, unknown>): Promise<BagTransportResultaat<T>> {
  const { data, error } = await supabase.functions.invoke('bag-query-service', { body });
  if (error) throw new Error('De BAG-queryservice is niet beschikbaar.');
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
