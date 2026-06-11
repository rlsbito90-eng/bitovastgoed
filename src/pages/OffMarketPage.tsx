import { useEffect, useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SortDropdown from '@/components/SortDropdown';
import { useSortPreference } from '@/hooks/useSortPreference';
import { byDate, byString, combine } from '@/lib/sorting/comparators';
import type { SortOption } from '@/lib/sorting/types';
import OffMarketKpi from '@/components/offmarket/OffMarketKpi';
import SignalenTable from '@/components/offmarket/SignalenTable';
import SignaalFormDialog from '@/components/offmarket/SignaalFormDialog';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { saveListContext } from '@/lib/listNavigation';
import { compareRelevantie, relevantieBucket } from '@/lib/offMarket/relevantie';
import OffMarketKaart from '@/components/offmarket/kaart/OffMarketKaart';
import { matchBucket, DATUMBUCKET_LABEL, type DatumBucket } from '@/lib/offMarket/kaart/datumbucket';
import {
  ASSETTYPE_LABEL, BRON_TYPE_LABEL, PRIORITEIT_LABEL, PRIORITEIT_VOLGORDE,
  STATUS_LABEL, STATUS_VOLGORDE, PROVINCIES, prioriteitRang,
  AI_STATUS_LABEL, AI_STATUS_VOLGORDE,
  type OffMarketAssettype, type OffMarketBronType, type OffMarketPrioriteit,
  type OffMarketStatus, type OffMarketSignaal, type OffMarketAiStatus,
} from '@/lib/offMarket/types';

type Tab = 'dashboard' | 'signalen' | 'kaart';

const selectCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

export default function OffMarketPage() {
  const { data: signalen = [], isLoading } = useOffMarketSignalen();
  const [tab, setTabState] = useState<Tab>(() => {
    try {
      const t = sessionStorage.getItem('off-market-filter:tab');
      return (t === 'signalen' || t === 'dashboard' || t === 'kaart') ? t : 'dashboard';
    } catch { return 'dashboard'; }
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    try { sessionStorage.setItem('off-market-filter:tab', t); } catch {}
  };
  const [datumBucket, setDatumBucketRaw] = useState<DatumBucket>(() => {
    try {
      const v = sessionStorage.getItem('off-market-filter:datumbucket');
      return (v === 'actueel' || v === 'komend' || v === 'historisch' || v === 'alles') ? v : 'actueel';
    } catch { return 'actueel'; }
  });
  const setDatumBucket = (b: DatumBucket) => {
    setDatumBucketRaw(b);
    try { sessionStorage.setItem('off-market-filter:datumbucket', b); } catch {}
  };
  const [createOpen, setCreateOpen] = useState(false);


  const useStored = <T extends string>(key: string, init: T) => {
    const [v, setV] = useState<T>(() => {
      try { return (sessionStorage.getItem(`off-market-filter:${key}`) as T) ?? init; } catch { return init; }
    });
    const setter = (next: T) => { setV(next); try { sessionStorage.setItem(`off-market-filter:${key}`, next); } catch {} };
    return [v, setter] as const;
  };
  const [zoek, setZoek] = useStored<string>('zoek', '');
  const [statusFilter, setStatusFilter] = useStored<OffMarketStatus | ''>('status', '');
  const [prioFilter, setPrioFilter] = useStored<OffMarketPrioriteit | ''>('prio', '');
  const [assetFilter, setAssetFilter] = useStored<OffMarketAssettype | ''>('asset', '');
  const [regioFilter, setRegioFilter] = useStored<string>('regio', '');
  const [bronFilter, setBronFilter] = useStored<OffMarketBronType | ''>('bron', '');
  const [aiStatusFilter, setAiStatusFilter] = useStored<OffMarketAiStatus | ''>('ai_status', '');
  const [bucketFilter, setBucketFilterRaw] = useState<number | null>(() => {
    try {
      const v = sessionStorage.getItem('off-market-filter:bucket');
      return v ? Number(v) : null;
    } catch { return null; }
  });
  const setBucketFilter = (r: number | null) => {
    setBucketFilterRaw(r);
    try {
      if (r === null) sessionStorage.removeItem('off-market-filter:bucket');
      else sessionStorage.setItem('off-market-filter:bucket', String(r));
    } catch {}
  };

  const sortOptions = useMemo<SortOption<OffMarketSignaal>[]>(() => [
    {
      value: 'relevantie', label: 'Vastgoedrelevantie',
      compare: compareRelevantie,
    },
    {
      value: 'ai_score', label: 'AI-score hoog → laag',
      compare: (a, b) => (b.ai_score ?? -1) - (a.ai_score ?? -1),
    },
    {
      value: 'prioriteit', label: 'Prioriteit',
      compare: combine(
        (a, b) => prioriteitRang(b.prioriteit) - prioriteitRang(a.prioriteit),
        byDate<OffMarketSignaal>(s => s.created_at, 'desc'),
      ),
    },
    {
      value: 'volgende_actie', label: 'Volgende actie eerst',
      compare: byDate<OffMarketSignaal>(s => s.volgende_actie_datum, 'asc'),
    },
    {
      value: 'nieuwste', label: 'Nieuwste eerst',
      compare: byDate<OffMarketSignaal>(s => s.created_at, 'desc'),
    },
    {
      value: 'plaats', label: 'Plaats A-Z',
      compare: byString<OffMarketSignaal>(s => s.plaats ?? ''),
    },
  ], []);
  const [sortValue, setSortValue] = useSortPreference(
    'off-market-signalen', 'relevantie', sortOptions.map(o => o.value),
  );
  const activeSort = sortOptions.find(o => o.value === sortValue) ?? sortOptions[0];

  // Tellingen per vergunningtype (bucket) — vóór bucket-filter, ná overige filters.
  const preBucket = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return signalen.filter(s => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (prioFilter && s.prioriteit !== prioFilter) return false;
      if (assetFilter && s.assettype !== assetFilter) return false;
      if (bronFilter && s.bron_type !== bronFilter) return false;
      if (aiStatusFilter && (s as any).ai_status !== aiStatusFilter) return false;
      if (regioFilter) {
        const blob = `${s.provincie ?? ''} ${s.regio ?? ''}`.toLowerCase();
        if (!blob.includes(regioFilter.toLowerCase())) return false;
      }
      if (q) {
        const blob = `${s.titel} ${s.adres ?? ''} ${s.plaats ?? ''} ${s.omschrijving ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [signalen, zoek, statusFilter, prioFilter, assetFilter, regioFilter, bronFilter, aiStatusFilter]);

  const bucketTellingen = useMemo(() => {
    const tellingen = new Map<number, { label: string; aantal: number }>();
    for (const s of preBucket) {
      const b = relevantieBucket(s);
      const cur = tellingen.get(b.rang);
      if (cur) cur.aantal += 1;
      else tellingen.set(b.rang, { label: b.label, aantal: 1 });
    }
    return Array.from(tellingen.entries())
      .map(([rang, v]) => ({ rang, ...v }))
      .sort((a, b) => a.rang - b.rang);
  }, [preBucket]);

  const gefilterd = useMemo(() => {
    const list = bucketFilter === null
      ? preBucket
      : preBucket.filter(s => relevantieBucket(s).rang === bucketFilter);
    return [...list].sort(activeSort.compare);
  }, [preBucket, bucketFilter, activeSort]);

  // Bewaar de huidige gefilterde+gesorteerde volgorde voor Vorige/Volgende op de detailpagina.
  useEffect(() => {
    saveListContext('off-market-signalen', gefilterd.map(s => s.id));
  }, [gefilterd]);

  return (
    <div className="space-y-5 px-4 sm:px-6 py-4 sm:py-6">
      <PageHeader
        title="Off-Market Radar"
        subtitle="Vind, beoordeel en prioriteer potentiële off-market objecten en verkopers."
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> Nieuw signaal
          </Button>
        }
      />
      <SignaalFormDialog open={createOpen} onOpenChange={setCreateOpen} />


      <div className="flex items-center gap-1 border-b border-border/60">
        {(['dashboard', 'signalen'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-accent text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'dashboard' ? 'Dashboard' : `Signalen (${signalen.length})`}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <section className="space-y-4">
          <OffMarketKpi />
          {signalen.length === 0 && (
            <div className="rounded-lg border border-border/70 bg-card px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nog geen signalen geregistreerd. Zodra signalen binnenkomen of handmatig worden toegevoegd, zie je hier de KPI's en pipeline.
              </p>
            </div>
          )}
        </section>
      )}

      {tab === 'signalen' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Zoek op titel, adres, plaats…" value={zoek} onChange={e => setZoek(e.target.value)} />
            </div>
            <select className={selectCls} value={statusFilter} onChange={e => setStatusFilter(e.target.value as OffMarketStatus | '')}>
              <option value="">Alle statussen</option>
              {STATUS_VOLGORDE.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select className={selectCls} value={prioFilter} onChange={e => setPrioFilter(e.target.value as OffMarketPrioriteit | '')}>
              <option value="">Alle prioriteiten</option>
              {PRIORITEIT_VOLGORDE.map(p => <option key={p} value={p}>{PRIORITEIT_LABEL[p]}</option>)}
            </select>
            <select className={selectCls} value={assetFilter} onChange={e => setAssetFilter(e.target.value as OffMarketAssettype | '')}>
              <option value="">Alle assettypes</option>
              {(Object.keys(ASSETTYPE_LABEL) as OffMarketAssettype[]).map(a => (
                <option key={a} value={a}>{ASSETTYPE_LABEL[a]}</option>
              ))}
            </select>
            <select className={selectCls} value={regioFilter} onChange={e => setRegioFilter(e.target.value)}>
              <option value="">Alle regio's</option>
              {PROVINCIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className={selectCls} value={bronFilter} onChange={e => setBronFilter(e.target.value as OffMarketBronType | '')}>
              <option value="">Alle bronnen</option>
              {(Object.keys(BRON_TYPE_LABEL) as OffMarketBronType[]).map(b => (
                <option key={b} value={b}>{BRON_TYPE_LABEL[b]}</option>
              ))}
            </select>
            <select className={selectCls} value={aiStatusFilter} onChange={e => setAiStatusFilter(e.target.value as OffMarketAiStatus | '')}>
              <option value="">Alle AI-statussen</option>
              {AI_STATUS_VOLGORDE.map(a => <option key={a} value={a}>{AI_STATUS_LABEL[a]}</option>)}
            </select>
            <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex justify-end">
              <SortDropdown options={sortOptions} value={sortValue} onChange={setSortValue} />
            </div>
          </div>

          {bucketTellingen.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setBucketFilter(null)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  bucketFilter === null
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                Alle ({preBucket.length})
              </button>
              {bucketTellingen.map(b => (
                <button
                  key={b.rang}
                  type="button"
                  onClick={() => setBucketFilter(bucketFilter === b.rang ? null : b.rang)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    bucketFilter === b.rang
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-card text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {b.label} ({b.aantal})
                </button>
              ))}
            </div>
          )}

          <section className="section-card overflow-hidden">
            <SignalenTable signalen={gefilterd} laden={isLoading} />
          </section>
        </>
      )}
    </div>
  );
}
