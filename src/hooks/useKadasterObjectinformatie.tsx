// React Query mutation hook voor Kadaster Objectinformatie API.
// Roept alleen de eigen Supabase Edge Function aan. Geen retry, geen
// automatische call. Foutmeldingen komen al in NL terug; deze hook
// laat ze ongewijzigd door zodat de UI ze 1:1 kan tonen.
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KadasterDebug, KadasterPreview, KadasterRequestInput } from '@/lib/kadaster/types';

export class KadasterApiError extends Error {
  code?: string;
  httpStatus?: number;
  debug?: KadasterDebug | null;
  constructor(message: string, code?: string, httpStatus?: number, debug?: KadasterDebug | null) {
    super(message);
    this.name = 'KadasterApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.debug = debug ?? null;
  }
}

export function useKadasterObjectinformatie() {
  return useMutation<KadasterPreview, KadasterApiError, KadasterRequestInput>({
    retry: false,
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke(
        'kadaster-objectinformatie',
        { body: input },
      );
      if (error) {
        const ctx = (error as { context?: Response }).context;
        let parsed: { error?: string; code?: string; http_status?: number; debug?: KadasterDebug } | null = null;
        try {
          if (ctx && typeof ctx.json === 'function') parsed = await ctx.json();
        } catch { /* noop */ }
        const msg = parsed?.error ?? error.message ?? 'Kadaster-aanvraag mislukt';
        throw new KadasterApiError(msg, parsed?.code, parsed?.http_status, parsed?.debug ?? null);
      }
      return data as KadasterPreview;
    },
  });
}
