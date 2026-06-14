import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  geocodeSignaalLocatie,
  pdokAdresZoek,
  beoordeelKandidaten,
  maakGeocodeDebug,
  type GeocodeKandidaat,
  type GeocodeDebugInfo,
  type GeocodeResultaat,
} from '@/lib/offMarket/kaart/geocode';
import { verfijnAdresUitTekst } from '@/lib/offMarket/import/normalize';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export interface GeocodeOnzeker {
  signaal_id: string;
  titel: string;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  reden: string;
  kandidaten: GeocodeKandidaat[];
  debug?: GeocodeDebugInfo;
}

export interface GeocodeVoortgang {
  bezig: boolean;
  totaal: number;
  klaar: number;
  auto: number;
  controleren: number;
  geen: number;
  overslaan: number;
}

const CONCURRENCY = 3;

function heeftLatLng(s: OffMarketSignaal): boolean {
  const lat = (s as any).lat as number | null;
  const lng = (s as any).lng as number | null;
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && !(lat === 0 && lng === 0);
}

/**
 * Automatische veilige PDOK-geocoding voor signalen zonder lat/lng.
 * Draait alleen wanneer `enabled` true is (Kaart-tab open).
 * Slaat enkel betrouwbare matches automatisch op.
 */
export function useKaartGeocoding(signalen: OffMarketSignaal[], enabled: boolean) {
  const qc = useQueryClient();
  const geprobeerd = useRef<Set<string>>(new Set());
  const draait = useRef(false);
  const [onzeker, setOnzeker] = useState<GeocodeOnzeker[]>([]);
  const [voortgang, setVoortgang] = useState<GeocodeVoortgang>({
    bezig: false, totaal: 0, klaar: 0, auto: 0, controleren: 0, geen: 0, overslaan: 0,
  });

  const verwerk = useCallback(async (kandidaatSignalen: OffMarketSignaal[]) => {
    if (draait.current) return;
    if (kandidaatSignalen.length === 0) return;
    draait.current = true;

    const totaal = kandidaatSignalen.length;
    let klaar = 0, auto = 0, controleren = 0, geen = 0, overslaan = 0;
    setVoortgang({ bezig: true, totaal, klaar, auto, controleren, geen, overslaan });

    const queue = [...kandidaatSignalen];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const s = queue.shift();
        if (!s) break;
        geprobeerd.current.add(s.id);
        let resultaat: GeocodeResultaat;
        try {
          resultaat = await geocodeSignaalLocatie({
            adres: s.adres ?? null,
            postcode: s.postcode ?? null,
            plaats: s.plaats ?? null,
            titel: s.titel ?? null,
          }, { signaal_id: s.id });
        } catch (err) {
          // eslint-disable-next-line no-console
          if (import.meta.env.DEV) console.warn('[kaart-geocode] mislukt', s.id, err);
          resultaat = { status: 'geen', reden: 'PDOK-call mislukt', redenCode: 'no_candidates' };
        }
        if (resultaat.status === 'auto') {
          const { error } = await supabase
            .from('off_market_signalen')
            .update({ lat: resultaat.lat, lng: resultaat.lng } as never)
            .eq('id', s.id);
          if (error) {
            // eslint-disable-next-line no-console
            if (import.meta.env.DEV) console.warn('[kaart-geocode] update mislukt', s.id, error);
            geen += 1;
          } else {
            auto += 1;
          }
        } else if (resultaat.status === 'controleren') {
          controleren += 1;
          setOnzeker(prev => {
            if (prev.some(p => p.signaal_id === s.id)) return prev;
            return [...prev, {
              signaal_id: s.id,
              titel: s.titel,
              adres: s.adres ?? null,
              postcode: s.postcode ?? null,
              plaats: s.plaats ?? null,
              reden: resultaat.reden,
              kandidaten: resultaat.kandidaten,
              debug: resultaat.debug,
            }];
          });
        } else if (resultaat.status === 'geen') {
          geen += 1;
        } else {
          overslaan += 1;
        }
        klaar += 1;
        setVoortgang({ bezig: true, totaal, klaar, auto, controleren, geen, overslaan });
      }
    });
    await Promise.all(workers);

    setVoortgang({ bezig: false, totaal, klaar, auto, controleren, geen, overslaan });
    draait.current = false;
    if (auto > 0) {
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
    }
  }, [qc]);

  useEffect(() => {
    if (!enabled) return;
    const todo = signalen.filter(s =>
      !heeftLatLng(s)
      && !geprobeerd.current.has(s.id)
      && (s.adres || s.postcode),
    );
    if (todo.length === 0) return;
    void verwerk(todo);
    // we willen niet bij elke render opnieuw; geprobeerd-set voorkomt herhaling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signalen, verwerk]);

  const opnieuwProberen = useCallback(() => {
    geprobeerd.current.clear();
    setOnzeker([]);
    const todo = signalen.filter(s => !heeftLatLng(s) && (s.adres || s.postcode));
    void verwerk(todo);
  }, [signalen, verwerk]);

  const kiesKandidaat = useCallback(async (signaal_id: string, kandidaat: GeocodeKandidaat) => {
    const { error } = await supabase
      .from('off_market_signalen')
      .update({ lat: kandidaat.lat, lng: kandidaat.lng } as never)
      .eq('id', signaal_id);
    if (error) throw error;
    setOnzeker(prev => prev.filter(p => p.signaal_id !== signaal_id));
    qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
  }, [qc]);

  const handmatigZoeken = useCallback(async (signaal: OffMarketSignaal) => {
    const inv = { adres: signaal.adres ?? null, postcode: signaal.postcode ?? null, plaats: signaal.plaats ?? null, titel: signaal.titel ?? null };
    const kandidaten = await pdokAdresZoek(inv);
    const resultaat = beoordeelKandidaten(inv, kandidaten, { signaal_id: signaal.id });
    if (resultaat.status === 'auto') {
      await supabase
        .from('off_market_signalen')
        .update({ lat: resultaat.lat, lng: resultaat.lng } as never)
        .eq('id', signaal.id);
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      return { status: 'auto' as const };
    }
    setOnzeker(prev => {
      const filtered = prev.filter(p => p.signaal_id !== signaal.id);
      if (kandidaten.length === 0) return filtered;
      return [...filtered, {
        signaal_id: signaal.id,
        titel: signaal.titel,
        adres: signaal.adres ?? null,
        postcode: signaal.postcode ?? null,
        plaats: signaal.plaats ?? null,
        reden: resultaat.status === 'controleren' ? resultaat.reden : 'Geen automatische match.',
        kandidaten,
        debug: resultaat.debug ?? maakGeocodeDebug(inv, kandidaten, resultaat.redenCode, { signaal_id: signaal.id }),
      }];
    });
    return { status: resultaat.status, aantal: kandidaten.length };
  }, [qc]);

  return { onzeker, voortgang, opnieuwProberen, kiesKandidaat, handmatigZoeken };
}
