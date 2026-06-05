import { useMemo, useState } from 'react';
import {
  Loader2, ShieldQuestion, ExternalLink, ArrowUpCircle, EyeOff,
  Search, RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useGeskipteRuwRecords, useNegeerGeskipt, usePromoteGeskipt,
} from '@/hooks/useGeskipteRuwRecords';
import { useOffMarketBronnen } from '@/hooks/useOffMarketBronnen';
import { filterGeskipt, type AuditFilters } from '@/lib/offMarket/import/audit';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface BronMeta {
  id: string;
  naam: string;
  gemeente: string | null;
  provincie: string | null;
}

function useBronMetaMap() {
  return useQuery({
    queryKey: ['off-market-bronnen-meta'],
    queryFn: async (): Promise<Map<string, BronMeta>> => {
      const { data, error } = await supabase
        .from('off_market_bronnen')
        .select('id, naam, config');
      if (error) throw error;
      const m = new Map<string, BronMeta>();
      (data ?? []).forEach((b: any) => {
        m.set(b.id, {
          id: b.id,
          naam: b.naam,
          gemeente: b.config?.gemeente ?? null,
          provincie: b.config?.provincie ?? null,
        });
      });
      return m;
    },
    refetchOnWindowFocus: false,
  });
}

function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const LEEG: AuditFilters = {
  bronId: undefined,
  minScore: undefined,
  maxScore: undefined,
  zoekterm: '',
  vanafDatum: undefined,
  alleenTwijfel: false,
  toonGenegeerd: false,
};

export default function OffMarketGeskiptRecordsSectie() {
  const { data: alle = [], isLoading } = useGeskipteRuwRecords(500);
  const { data: bronnen = [] } = useOffMarketBronnen();
  const { data: bronMeta } = useBronMetaMap();
  const negeer = useNegeerGeskipt();
  const promoot = usePromoteGeskipt();

  const [filters, setFilters] = useState<AuditFilters>(LEEG);

  const zichtbaar = useMemo(() => filterGeskipt(alle, filters), [alle, filters]);

  const setF = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const reset = () => setFilters(LEEG);

  const handlePromote = async (id: string) => {
    const record = alle.find(r => r.id === id);
    if (!record) return;
    const bron = bronMeta?.get(record.bron_id);
    if (!bron) {
      toast.error('Bron-info nog niet geladen — probeer opnieuw.');
      return;
    }
    try {
      await promoot.mutateAsync({ record, bron });
      toast.success('Signaal aangemaakt — zichtbaar in Off-Market lijst.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Promoveren mislukt');
    }
  };

  const handleNegeer = async (id: string) => {
    const record = alle.find(r => r.id === id);
    if (!record) return;
    try {
      await negeer.mutateAsync(record);
      toast.success('Verborgen uit auditlijst.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verbergen mislukt');
    }
  };

  return (
    <div className="space-y-4" data-testid="off-market-geskipt-sectie">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4 text-muted-foreground" />
            Afgekeurde records
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Geskipte bekendmakingen — controleer of de radar terecht filtert. Promoveer alsnog of verberg.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Zichtbaar: <span className="font-mono-data text-foreground">{zichtbaar.length}</span>
          {' '}/ totaal <span className="font-mono-data text-foreground">{alle.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Bron</label>
          <Select
            value={filters.bronId ?? '__all__'}
            onValueChange={v => setF('bronId', v === '__all__' ? undefined : v)}
          >
            <SelectTrigger><SelectValue placeholder="Alle bronnen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle bronnen</SelectItem>
              {bronnen.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.naam}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Score-range</label>
          <div className="flex gap-2 items-center">
            <Input type="number" min={0} max={100} placeholder="min"
              value={filters.minScore ?? ''}
              onChange={e => setF('minScore', e.target.value === '' ? undefined : Number(e.target.value))} />
            <span className="text-muted-foreground text-xs">–</span>
            <Input type="number" min={0} max={100} placeholder="max"
              value={filters.maxScore ?? ''}
              onChange={e => setF('maxScore', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Vanaf datum</label>
          <Input type="date"
            value={filters.vanafDatum ?? ''}
            onChange={e => setF('vanafDatum', e.target.value || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Zoeken in titel/tekst</label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
            <Input className="pl-7" placeholder="bijv. kamerverhuur, transformatie…"
              value={filters.zoekterm ?? ''}
              onChange={e => setF('zoekterm', e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={!!filters.alleenTwijfel}
              onCheckedChange={v => setF('alleenTwijfel', v)} />
            Alleen twijfelgevallen (score 25–39)
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={!!filters.toonGenegeerd}
              onCheckedChange={v => setF('toonGenegeerd', v)} />
            Toon ook verborgen records
          </label>
          <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Filters wissen
          </Button>
        </div>
      </div>

      {/* Lijst */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-12 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : zichtbaar.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Geen afgekeurde records met deze filters.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {zichtbaar.map(r => {
              const bron = bronMeta?.get(r.bron_id);
              const bronLabel = bron?.naam ?? '—';
              const gemeente = bron?.gemeente ?? null;
              const compTekst = r.score_componenten_tekst
                ?? '(geen componenten — oude run zonder breakdown)';
              const alGepromoveerd = !!r.signaal_id;
              return (
                <li key={r.id} className="px-4 sm:px-5 py-4 space-y-2"
                    data-testid="geskipt-record"
                    data-record-id={r.id}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground break-words">{r.titel}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                        <span>{bronLabel}{gemeente ? ` · ${gemeente}` : ''}</span>
                        <span>datum: {formatDatum(r.datum)}</span>
                        <span>verwerkt: {formatDatum(r.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="font-mono-data">score {r.score}</Badge>
                      {r.handmatig_genegeerd && (
                        <Badge variant="outline" className="text-muted-foreground">verborgen</Badge>
                      )}
                      {alGepromoveerd && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          gepromoveerd
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs">
                    <p className="text-muted-foreground">
                      <span className="text-foreground font-medium">skip:</span> {r.skip_reden}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      <span className="text-foreground font-medium">componenten:</span>{' '}
                      <span className="font-mono-data">{compTekst}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.link && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={r.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open bron
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline"
                      disabled={alGepromoveerd || promoot.isPending}
                      onClick={() => handlePromote(r.id)}>
                      <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                      {alGepromoveerd ? 'Reeds gepromoveerd' : 'Toch promoveren'}
                    </Button>
                    {!r.handmatig_genegeerd && !alGepromoveerd && (
                      <Button size="sm" variant="ghost"
                        disabled={negeer.isPending}
                        onClick={() => handleNegeer(r.id)}>
                        <EyeOff className="h-3.5 w-3.5 mr-1" /> Verbergen
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
