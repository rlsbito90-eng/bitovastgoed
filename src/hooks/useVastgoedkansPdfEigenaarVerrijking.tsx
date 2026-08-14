import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKadasterDocumentenForVastgoedkans } from '@/hooks/useKadasterDocumenten';
import type { EigenaarKoppelingRecord } from '@/hooks/useEigenaarsregister';

interface PdfExtractieMeta {
  document_id?: string | null;
  status?: string | null;
}

function extractieMeta(koppeling: EigenaarKoppelingRecord): PdfExtractieMeta | null {
  const details = koppeling.eigenaar?.bron_details;
  if (!details || typeof details !== 'object') return null;
  const value = (details as Record<string, unknown>).pdf_adres_extractie;
  return value && typeof value === 'object' ? value as PdfExtractieMeta : null;
}

export function useVastgoedkansPdfEigenaarVerrijking(
  vastgoedkansId: string,
  koppelingen: EigenaarKoppelingRecord[],
  enabled = true,
) {
  const queryClient = useQueryClient();
  const documenten = useKadasterDocumentenForVastgoedkans(vastgoedkansId);
  const laatstePoging = useRef('');

  const laatsteRechtenPdf = useMemo(
    () => (documenten.data ?? []).find((d) => (d.product_codes ?? []).includes('rechten')) ?? null,
    [documenten.data],
  );

  const teVerrijken = useMemo(() => {
    if (!laatsteRechtenPdf) return [];
    return koppelingen.filter((k) => {
      const eigenaar = k.eigenaar;
      if (!eigenaar || eigenaar.archived_at) return false;
      const mistAdres = !eigenaar.adres || !eigenaar.postcode || !eigenaar.plaats;
      if (!mistAdres) return false;
      return extractieMeta(k)?.document_id !== laatsteRechtenPdf.id;
    });
  }, [koppelingen, laatsteRechtenPdf]);

  const extractie = useMutation({
    mutationFn: async () => {
      if (!laatsteRechtenPdf) return null;
      const { data, error } = await supabase.functions.invoke('kadaster-pdf-eigenaar-extractie', {
        body: {
          vastgoedkans_id: vastgoedkansId,
          document_id: laatsteRechtenPdf.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      return data as {
        ok: boolean;
        status: string;
        document_id?: string;
        owners_checked?: number;
        matched?: number;
        updated?: number;
      } | null;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['eigenaarsregister', 'vastgoedkans', vastgoedkansId] }),
        queryClient.invalidateQueries({ queryKey: ['vastgoedkansen'] }),
      ]);
    },
    onError: () => {
      laatstePoging.current = '';
    },
  });

  useEffect(() => {
    if (!enabled || !laatsteRechtenPdf || teVerrijken.length === 0 || extractie.isPending) return;
    const signature = `${laatsteRechtenPdf.id}:${teVerrijken.map((k) => k.eigenaar_id).sort().join(',')}`;
    if (laatstePoging.current === signature) return;
    laatstePoging.current = signature;
    extractie.mutate();
  }, [enabled, laatsteRechtenPdf?.id, teVerrijken.length, extractie.isPending]);

  return {
    isPending: extractie.isPending,
    error: extractie.error,
    result: extractie.data,
    heeftRechtenPdf: !!laatsteRechtenPdf,
    aantalTeVerrijken: teVerrijken.length,
    retry: () => {
      laatstePoging.current = '';
      extractie.mutate();
    },
  };
}
