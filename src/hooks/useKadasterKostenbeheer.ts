import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type KadasterPeriode = 'week' | 'maand' | 'jaar';

export interface KadasterProductRow {
  code: string;
  naam: string;
  categorie: 'gratis' | 'betaald';
  tarief_per_eenheid: number | null;
  valuta: string;
  actief: boolean;
  bevestiging_verplicht: boolean;
  tarief_geldig_vanaf: string | null;
}

export interface KadasterBudgetRow {
  id: string;
  scope_type: 'bedrijf' | 'gebruiker' | 'campagne';
  scope_id: string;
  daglimiet: number | null;
  maandlimiet: number | null;
  bevestiging_vanaf: number | null;
  harde_blokkade: boolean;
  beheerder_override: boolean;
  waarschuwing_percentages: number[];
  geldig_vanaf: string;
  geldig_tot: string | null;
}

export interface KadasterKostenEventRow {
  id: string;
  product_code: string;
  status: string;
  aantal_eenheden: number;
  geraamde_kosten: number;
  werkelijke_kosten: number | null;
  valuta: string;
  gebruiker_id: string;
  adres_label: string | null;
  aangevraagd_op: string;
  geleverd_op: string | null;
}

function periodeStart(periode: KadasterPeriode): Date {
  const now = new Date();
  if (periode === 'week') {
    const dag = (now.getDay() + 6) % 7;
    now.setDate(now.getDate() - dag);
  } else if (periode === 'maand') {
    now.setDate(1);
  } else {
    now.setMonth(0, 1);
  }
  now.setHours(0, 0, 0, 0);
  return now;
}

export function useKadasterKostenbeheer(periode: KadasterPeriode) {
  const [producten, setProducten] = useState<KadasterProductRow[]>([]);
  const [budgetten, setBudgetten] = useState<KadasterBudgetRow[]>([]);
  const [events, setEvents] = useState<KadasterKostenEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaBeschikbaar, setSchemaBeschikbaar] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLoading(true);
    setFout(null);
    const client = supabase as any;
    const start = periodeStart(periode).toISOString();
    const [productResult, budgetResult, eventResult] = await Promise.all([
      client.from('kadaster_producten').select('*').order('naam'),
      client.from('kadaster_budgetten').select('*').order('scope_type').order('scope_id'),
      client.from('kadaster_kosten_events').select('*').gte('aangevraagd_op', start).order('aangevraagd_op', { ascending: false }),
    ]);
    const error = productResult.error ?? budgetResult.error ?? eventResult.error;
    if (error) {
      const message = String(error.message ?? 'Kadasterkosten konden niet worden geladen.');
      setSchemaBeschikbaar(!/does not exist|schema cache|relation/i.test(message));
      setFout(message);
      setProducten([]);
      setBudgetten([]);
      setEvents([]);
    } else {
      setSchemaBeschikbaar(true);
      setProducten((productResult.data ?? []) as KadasterProductRow[]);
      setBudgetten((budgetResult.data ?? []) as KadasterBudgetRow[]);
      setEvents((eventResult.data ?? []) as KadasterKostenEventRow[]);
    }
    setLoading(false);
  }, [periode]);

  useEffect(() => { void laad(); }, [laad]);

  const samenvatting = useMemo(() => {
    const geleverd = events.filter(event => ['geleverd', 'gedeeltelijk_geleverd'].includes(event.status));
    const werkelijk = geleverd.reduce((som, event) => som + Number(event.werkelijke_kosten ?? 0), 0);
    const geraamd = events.reduce((som, event) => som + Number(event.geraamde_kosten ?? 0), 0);
    const perProduct = producten.map(product => {
      const productEvents = events.filter(event => event.product_code === product.code);
      const geleverdeEvents = productEvents.filter(event => ['geleverd', 'gedeeltelijk_geleverd'].includes(event.status));
      return {
        code: product.code,
        naam: product.naam,
        aanvragen: productEvents.length,
        eenheden: productEvents.reduce((som, event) => som + Number(event.aantal_eenheden), 0),
        werkelijk: geleverdeEvents.reduce((som, event) => som + Number(event.werkelijke_kosten ?? 0), 0),
        geraamd: productEvents.reduce((som, event) => som + Number(event.geraamde_kosten ?? 0), 0),
      };
    }).filter(item => item.aanvragen > 0 || item.werkelijk > 0);
    return { aanvragen: events.length, geleverd: geleverd.length, werkelijk, geraamd, perProduct };
  }, [events, producten]);

  const slaBedrijfsbudgetOp = async (waarden: Partial<KadasterBudgetRow>) => {
    const client = supabase as any;
    const payload = {
      scope_type: 'bedrijf',
      scope_id: 'bito-vastgoed',
      geldig_vanaf: new Date().toISOString().slice(0, 10),
      daglimiet: waarden.daglimiet ?? null,
      maandlimiet: waarden.maandlimiet ?? null,
      bevestiging_vanaf: waarden.bevestiging_vanaf ?? null,
      harde_blokkade: Boolean(waarden.harde_blokkade),
      beheerder_override: waarden.beheerder_override !== false,
      waarschuwing_percentages: waarden.waarschuwing_percentages ?? [70, 85, 100],
    };
    const result = await client.from('kadaster_budgetten').upsert(payload, { onConflict: 'scope_type,scope_id,geldig_vanaf' });
    if (result.error) throw result.error;
    await laad();
  };

  const werkProductBij = async (code: string, waarden: Partial<KadasterProductRow>) => {
    const client = supabase as any;
    const result = await client.from('kadaster_producten').update({
      tarief_per_eenheid: waarden.tarief_per_eenheid ?? null,
      tarief_geldig_vanaf: waarden.tarief_geldig_vanaf ?? null,
      actief: Boolean(waarden.actief),
      bevestiging_verplicht: waarden.bevestiging_verplicht !== false,
      updated_at: new Date().toISOString(),
    }).eq('code', code);
    if (result.error) throw result.error;
    await laad();
  };

  return { producten, budgetten, events, loading, fout, schemaBeschikbaar, samenvatting, laad, slaBedrijfsbudgetOp, werkProductBij };
}
